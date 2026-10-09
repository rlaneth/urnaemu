// Experimental reconstruction of the omitted operator thread pump.
// Native evidence: funcs270,2073,3842,3843,10204. The vendor files are unchanged.
export const createOperatorEventPump = function(app) {
 const memory=()=>new DataView(app.exports.Cb.buffer),table=app.exports.Fb;
 const u32=p=>memory().getUint32(p,true);
 const check=(p,n)=>{if(!Number.isInteger(p)||!Number.isInteger(n)||n<0||p<1024||p%4||p+n>memory().byteLength)throw Error('Operator queue address outside memory');};
 function queue(){const p=u32(0x1d2b9c);check(p,0x84);if(u32(p)!==0x186eb8)throw Error('Unexpected operator thread vtable');return p+0x24;}
 function pop(){const q=queue(),begin=u32(q+4),end=u32(q+8),capacity=u32(q+12);if(begin===end)return null;check(begin,end-begin);if((end-begin)%16||end>capacity||capacity>memory().byteLength||(end-begin)/16>4096)throw Error('Invalid operator message queue');
  const m=memory(),bytes=new Uint8Array(m.buffer),entries=[];
  for(let p=begin;p<end;p+=16)entries.push({bytes:bytes.slice(p,p+16),priority:m.getInt32(p+8,true),sequence:m.getUint32(p+12,true)});
  // A descending priority / ascending sequence array is also a valid max heap.
  // This preserves the comparator used by native pop2073 without inventing events.
  entries.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);
  const entry=entries.shift(),id=new DataView(entry.bytes.buffer).getUint16(0,true);
  entries.forEach((e,i)=>bytes.set(e.bytes,begin+i*16));m.setUint32(q+8,end-16,true);if(!entries.length)m.setUint32(q+28,0,true);
  return {id,priority:entry.priority,sequence:entry.sequence};
 }
 async function drain(){const processed=[];for(let i=0;i<128;i++){const item=pop();if(!item)return processed;if(item.id===0||item.id===16)throw Error('Native operator termination/error event '+item.id);const p=app.experiments.state.active,vt=u32(p);if(memory().getUint8(p+8)&1)await app.keys.as(app.experiments.activeKeypad(),()=>app.native.callTable(u32(vt+24),[p,item.id&255]));await app.experiments.tick();processed.push(item)}throw Error('Operator message limit reached');}
 // Tick delivery, the other half of the native thread loops (e.g. vota::CThreadOperador::Run(),
 // func10204) that the web build never runs. Screens register ticks with api::CTickManager
 // (AddTick/StartTick/StopTick, funcs 3644/700/5451), held by their thread object:
 //   operator thread  vota::CThreadOperador (GetInst func270, global 0x1d2b9c, vtable 0x186eb8)
 //   voter thread     vota::CThreadEleitor  (GetInst func316, global 0x1bf8fc, vtable 0x176aa0),
 //                    whose boot screens (keyboard test, zerésima, voting start) the harness runs
 // in a std::map at +20 (root at +24, size at +28). Each node: key (tick id)
 // at +16, period in ms (int64) at +24, next deadline as seconds (int64) at +32 and microseconds
 // at +40 (gettimeofday through import a.R, i.e. the emulator clock), stopped flag at +48.
 // A due tick calls the active screen's ProcessTick(id) (vtable slot 8, offset 32) and moves
 // its deadline one period ahead, as the native loop does.
 const THREADS={operador:{global:0x1d2b9c,vtable:0x186eb8},eleitor:{global:0x1bf8fc,vtable:0x176aa0}};
 function ticks(thread='operador'){const t=THREADS[thread],p=u32(t.global);if(!p||u32(p)!==t.vtable)return [];const m=memory(),size=u32(p+28);if(size>64)throw Error('Unexpected operator tick table');
  const found=[];(function walk(n,depth){if(!n||depth>32||found.length>64)return;check(n,52);walk(u32(n),depth+1);found.push({node:n,id:m.getUint8(n+16),period:Number(m.getBigInt64(n+24,true)),sec:Number(m.getBigInt64(n+32,true)),usec:m.getInt32(n+40,true),stopped:!!m.getUint8(n+48)});walk(u32(n+4),depth+1);})(u32(p+24),0);
  if(found.length!==size)throw Error('Operator tick table walk mismatch');return found;}
 async function deliverTicks(nowMs,thread='operador'){const due=ticks(thread).filter(t=>!t.stopped&&t.period>=30&&t.sec*1000+t.usec/1000<=nowMs);const delivered=[];
  for(const t of due){const m=memory();
   // Next deadline: one period later; after a clock jump, one period from now (no burst of ticks).
   let next=t.sec*1000+t.usec/1000+t.period;if(next<=nowMs)next=nowMs+t.period;
   m.setBigInt64(t.node+32,BigInt(Math.floor(next/1000)),true);m.setInt32(t.node+40,Math.round((next%1000)*1000),true);
   const p=app.experiments.state.active;if(!p)break;const vt=u32(p);
   await app.keys.as(app.experiments.activeKeypad(),()=>app.native.callTable(u32(vt+32),[p,t.id]));await app.experiments.tick();delivered.push(t.id);}
  return delivered;}
 let appPointer=0;
 async function voterTick(){if(!appPointer)appPointer=await app.native.callTable(54,[]);const vt=u32(appPointer),slot=u32(vt+28);if(slot!==863)throw Error('Unexpected native voter executor');return app.keys.as('voter',()=>app.native.callTable(slot,[appPointer]));}
 return {pop,drain,ticks,deliverTicks,voterTick};
};
