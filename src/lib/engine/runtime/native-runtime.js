// Promise-aware entry to the vendor WASM (in-memory patches: runtime/wasm-patches.js). All managed native calls share one
// lock; marshalling allocations remain alive until the suspended call returns.
export const createNativeRuntime = function({app,log,onError,onStatus}){
 const supported=typeof WebAssembly.Suspending==='function'&&typeof WebAssembly.promising==='function';
 const state={supported,busy:false,suspended:false,cancelled:false,queued:0,active:0,maxActive:0,calls:0,sleeps:0,sleepMilliseconds:0,current:null};
 let tail=Promise.resolve();const wrappers=new WeakMap(),sleepers=new Set(),callbacks=new Set(),soundWaits=new Map(),currentFinalizers=new Set();
 const emit=()=>onStatus?.(state);
 function check(){if(state.cancelled)throw Error('Native call cancelled; reload the runtime before continuing');}
 function text(pointer,max=8192,encoding='utf-8'){const bytes=new Uint8Array(app.exports.Cb.buffer);if(!Number.isInteger(pointer)||pointer<0||pointer>=bytes.length)throw Error('Invalid native string pointer');let end=pointer;while(end<bytes.length&&end-pointer<max&&bytes[end])end++;const input=bytes.subarray(pointer,end);try{return new TextDecoder(encoding,{fatal:true}).decode(input)}catch{return new TextDecoder('windows-1252').decode(input)}}
 const diagnostic=pointer=>text(pointer,65536,'windows-1252');
 function describe(error){
  if(!error?.excPtr)return error instanceof Error?error:Error(String(error));
  try{const m=new DataView(app.exports.Cb.buffer),p=error.excPtr;if(!Number.isInteger(p)||p<1024||p+20>m.byteLength)throw Error('Invalid exception pointer');const vt=m.getUint32(p,true);if(vt<1024||vt+12>m.byteLength)throw Error('Invalid exception vtable');const slot=m.getUint32(vt+8,true),meta=app.tableMetadata.find(x=>x.slot===slot);if(!meta||meta.params.join()!=='i32'||meta.result!=='i32')throw Error('Unverified exception what signature');const message=diagnostic(app.exports.Fb.get(slot)(p));const decoded=Error(message||`Native C++ exception at0x${p.toString(16)}`,{cause:error});decoded.excPtr=p;decoded.nativeException=true;return decoded;}catch{return Error(`Native C++ exception at0x${error.excPtr.toString(16)}`,{cause:error});}
 }
 async function invoke(fn,args=[]){check();if(typeof fn!=='function')throw Error('Native target is not callable');let wrapped=wrappers.get(fn);if(!wrapped){wrapped=supported?WebAssembly.promising(fn):fn;wrappers.set(fn,wrapped);}return await wrapped(...args);}
 const context={
  export:async(name,args=[])=>invoke(app.exports[name],args),
  table:async(slot,args=[])=>invoke(app.exports.Fb.get(slot),args),
  function:invoke,
  text,
  async ccall(name,result,types=[],args=[]){
   if(types.length!==args.length)throw Error('Native argument count mismatch');
   const target=Module[`_${name}`];if(typeof target!=='function')throw Error(`Missing native function ${name}`);
   let stack=null;
   try{
    const converted=[];
    for(let i=0;i<args.length;i++){
     const type=types[i],arg=args[i];
     if(type==='string'||type==='array'){
      if(type==='string'&&(arg===null||arg===undefined||arg===0)){converted.push(0);continue;}
      if(stack===null)stack=await context.export('Wb');
      const bytes=type==='string'?new TextEncoder().encode(String(arg)+'\0'):new Uint8Array(arg);
      const pointer=(await context.export('Vb',[bytes.length]))>>>0;
      new Uint8Array(app.exports.Cb.buffer,pointer,bytes.length).set(bytes);converted.push(pointer);
     }else converted.push(arg);
    }
    const value=await invoke(target,converted);
    return result==='string'?text(value):result==='boolean'?Boolean(value):value;
   }finally{if(stack!==null&&!state.cancelled)await context.export('Ub',[stack]);}
  }
 };
 function transaction(fn,label='native operation'){
  state.queued++;emit();
  const result=tail.then(async()=>{state.queued--;check();state.busy=true;state.current=label;state.active++;state.maxActive=Math.max(state.maxActive,state.active);state.calls++;emit();try{return await fn(context);}catch(error){throw describe(error);}finally{for(const cleanup of currentFinalizers){try{cleanup();}catch(error){onError(error);}}currentFinalizers.clear();state.active--;state.busy=false;state.current=null;emit();}});
  tail=result.catch(()=>{});return result;
 }
 function sleep(milliseconds){
  check();if(!Number.isFinite(milliseconds)||milliseconds<0)throw Error('Invalid native sleep duration');
  state.suspended=true;state.sleeps++;state.sleepMilliseconds+=milliseconds;emit();
  return new Promise((resolve,reject)=>{const record={timer:null,reject};record.timer=setTimeout(()=>{sleepers.delete(record);state.suspended=sleepers.size>0;emit();resolve();},milliseconds);sleepers.add(record);});
 }
 function cancel(){
  if(!state.busy&&!state.queued)return;
  state.cancelled=true;for(const s of sleepers){clearTimeout(s.timer);s.reject(Error('Native call cancelled; reload required'));}sleepers.clear();state.suspended=false;
  for(const timer of callbacks)clearTimeout(timer);callbacks.clear();for(const token of soundWaits.values())clearTimeout(token.timer);soundWaits.clear();log('native-cancel','Pending native work cancelled; reload required');emit();
 }
 function installImports(imports){
  // Decode raw diagnostic bytes before the vendor's UTF8ToString can replace
  // Windows-1252 characters. Host strings and valid UTF-8 JSON stay Unicode.
  imports.a.A=pointer=>log('thread',diagnostic(pointer));
  imports.a.Oa=pointer=>log('error',diagnostic(pointer));
  imports.a.J=pointer=>{if(Module.uenuxDebug)log('screen',diagnostic(pointer));};
  imports.a.D=(action,resource,path,size)=>{if(Module.uenuxDebug)log('resource',diagnostic(action),diagnostic(resource),diagnostic(path),size);};
  imports.a.Qa=(name,detail)=>{const eventName=text(name),raw=text(detail,1024*1024);let parsed={};try{parsed=raw?JSON.parse(raw):{}}catch(error){parsed={raw,parseError:String(error)}}window.dispatchEvent(new CustomEvent(eventName,{detail:parsed}));};
  if(supported)imports.a.s=new WebAssembly.Suspending(sleep);
  imports.a.$=(slot,arg,milliseconds)=>{const timer=setTimeout(()=>{callbacks.delete(timer);transaction(ctx=>ctx.table(slot,[arg]),`async callback table${slot}`).catch(onError);},Math.max(0,milliseconds));callbacks.add(timer);};
  // The vendor audio timer assumes synchronous ccall. Replace just its host
  // scheduling with awaited, serialized calls; preserve status semantics.
  function cancelSound(id){const token=soundWaits.get(id);if(token)clearTimeout(token.timer);soundWaits.delete(id);if(Module.uenuxWebSoundWaits)delete Module.uenuxWebSoundWaits[id];}
  imports.a.Ja=cancelSound;
  imports.a.Ka=id=>{
   cancelSound(id);const token={timer:null};soundWaits.set(id,token);Module.uenuxWebSoundWaits??={};
   function audioStatus(){const s=Module.uenuxWebSound;if(!s?.audio)return s?.queue?.length?1:0;if(s.audio.ended)return s.queue?.length?1:0;if(s.status===2)return 2;if(s.status===1)return 1;return s.audio.paused?2:1;}
   async function poll(){
    try{const result=await transaction(async ctx=>{
      if(soundWaits.get(id)!==token)return null;
      const cancelled=await ctx.ccall('uenux_wasm_web_sound_wait_cancel_requested','number',['number'],[id]);
      if(cancelled||audioStatus()!==1){cancelSound(id);await ctx.ccall('uenux_wasm_web_sound_wait_finished',null,['number','number'],[id,cancelled?0:1]);return true;}
      return false;
     },`audio wait${id}`);
     if(result===false&&soundWaits.get(id)===token){token.timer=setTimeout(poll,20);Module.uenuxWebSoundWaits[id]=token.timer;}
    }catch(error){cancelSound(id);onError(error);}
   }
   token.timer=setTimeout(poll,20);Module.uenuxWebSoundWaits[id]=token.timer;
  };
 }
 return {state,installImports,transaction,afterCurrent:fn=>{if(!state.busy)throw Error('No active native call');currentFinalizers.add(fn);},callTable:(slot,args=[])=>transaction(ctx=>ctx.table(slot,args),`table${slot}`),callExport:(name,args=[])=>transaction(ctx=>ctx.export(name,args),`export ${name}`),callFunction:(fn,args=[],label='native function')=>transaction(ctx=>ctx.function(fn,args),label),ccall:(...args)=>transaction(ctx=>ctx.ccall(...args),args[0]),cancel,describeError:describe};
};
