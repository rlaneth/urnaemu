// Edit the original web IPower snapshot, then notify original native image observers.
// Install before votaInit so widget timer lifetimes can be tracked without heap scans.
export const installNativePower = function(app) {
  if (app.power) return Promise.resolve(app.power);
  return app.native.transaction(() => {
    if (app.power) return app.power;
    const table=app.exports.Fb, view=()=>new DataView(app.exports.Cb.buffer);
    const get=p=>view().getUint32(p,true), put=(p,n)=>view().setUint32(p,n,true);
    const valid=(p,n)=>Number.isInteger(p)&&p>=1024&&p+n<=view().byteLength;
    const callbacks=new Map(), hooks=[];
    const state={simulated:true,source:'mains',level:'full',icon:0,flags:null,registered:false,widgets:0,refreshes:0};
    const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
    const section=(id,a)=>[id,...leb(a.length),...a];
    function wrap(slot,arity,host){
      const original=table.get(slot), body=[0,...Array.from({length:arity},(_,i)=>[0x20,i]).flat(),0x10,0,0x0b];
      const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,0x60,arity,...Array(arity).fill(0x7f),0]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);
      const wrapped=new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:(...a)=>host(original,...a)}}).exports.f;
      table.set(slot,wrapped);hooks.push({slot,original,wrapped});
    }
    try {
      for(const factorySlot of [849,3586])wrap(factorySlot,4,(original,out,factory,interval,fn)=>{
        original(out,factory,interval,fn);
        const timer=get(out);if(!valid(timer,0x24))return;
        const callbackField=factorySlot===849?get(timer+4)+0x28:timer+0x20;
        if(!valid(callbackField,4))return;
        const cb=get(callbackField);if(!valid(cb,8))return;
        const vt=get(cb), slot=vt===0x182288?3433:vt===0x182248?3425:null;
        if(slot!==null){callbacks.set(cb,{callbackField,vt,slot,data:get(cb+4)});state.widgets=callbacks.size;}
      });
      // Both inline and heap std::function target destructors; temporary copies
      // do not remove the different, persistent timer-owned callback address.
      for(const slot of [3431,3432,3423,3424])wrap(slot,1,(original,cb)=>{callbacks.delete(cb);state.widgets=callbacks.size;original(cb)});
    } catch(error) {for(const h of hooks.reverse())if(table.get(h.slot)===h.wrapped)table.set(h.slot,h.original);throw error;}
    function backend(){
      const registry=table.get(284)();if(!valid(registry,12))throw Error('Invalid singleton registry');
      const start=get(registry),end=get(registry+4);if(!valid(start,end-start)||end<start||(end-start)%24)throw Error('Invalid singleton entries');
      const bytes=new Uint8Array(app.exports.Cb.buffer);
      for(let p=start;p<end;p+=24){const long=bytes[p+11]&128,a=long?get(p):p,n=long?get(p+4):bytes[p+11];if(!valid(a,n))continue;
        if(n===13&&new TextDecoder().decode(bytes.subarray(a,a+n))==='N3api6IPowerE'){
          const object=get(p+16);if(!valid(object,0x30)||get(object)!==0x175c48)throw Error('Unsupported IPower backend');
          state.registered=true;return object;
        }
      }
      throw Error('Original IPower service is not initialized yet');
    }
    function snapshot(object){
      const flags=get(object+0x14),source=flags&6,levelBits=(flags&0x18)>>3;
      state.flags=flags;state.source=source===0?'mains':source===4?'external':'battery';
      state.level=['full','partial','critical','absent'][levelBits];
      state.icon=levelBits===3?3:(source===0?0:4)+levelBits;
      if(source===4){const external=(flags&0x60)>>5;state.level=['full','partial','critical','absent'][external];state.icon=external===3?3:7+external;}
      state.widgets=callbacks.size;return {...state};
    }
    async function refreshIn(ctx,object){
      for(const [cb,record] of [...callbacks]){
        if(!valid(cb,8)||get(cb)!==record.vt||get(cb+4)!==record.data||!valid(record.callbackField,4)||get(record.callbackField)!==cb){callbacks.delete(cb);continue;}
        await ctx.table(record.slot,[cb]);
      }
      state.refreshes++;const result=snapshot(object);app.powerCompanion?.render?.();return result;
    }
    const api={state,
      set(change={}){return app.native.transaction(async ctx=>{
        const object=backend();snapshot(object);
        const source=change.source??state.source,level=change.level??state.level;
        if(!['mains','battery'].includes(source))throw Error('Power source must be mains or battery');
        const index=['full','partial','critical','absent'].indexOf(level);if(index<0)throw Error('Unknown native battery level');
        put(object+0x14,(get(object+0x14)&~0x1e)|(source==='battery'?2:0)|(index<<3));
        const result=await refreshIn(ctx,object);app.log?.('simulated-power',result);return result;
      },'Set simulated native power');},
      refresh(){return app.native.transaction(ctx=>refreshIn(ctx,backend()),'Refresh native battery widgets');}
    };
    app.power=api;return api;
  },'Install native power observer tracking');
};
