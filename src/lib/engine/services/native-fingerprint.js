import { installVoterBiometrics } from './native-voter-biometrics.js';
// Scanner lifecycle plus an explicit host-injected registration acceptance.
// Acceptance bypasses image/template/matching; it is not a biometric match.
export const installNativeFingerprint = function(app) {
  if (app.fingerprint) return app.fingerprint;
  const table=app.exports.Fb, view=()=>new DataView(app.exports.Cb.buffer), heap=()=>new Uint8Array(app.exports.Cb.buffer);
  const alloc=table.get(5), freeIndex=app.tableMetadata.find(x=>x.functionIndex===136)?.slot;
  if(freeIndex===undefined)throw Error('Native deallocator unavailable');
  const free=table.get(freeIndex),get=p=>view().getUint32(p,true),put=(p,n)=>view().setUint32(p,n,true);
  const check=(p,n)=>{if(!Number.isInteger(p)||!Number.isInteger(n)||p<1024||n<0||p+n>view().byteLength)throw Error('Invalid fingerprint ABI range')};
  const zero=n=>{const p=alloc(n);check(p,n);heap().fill(0,p,p+n);return p};
  const state={simulated:true,registered:false,capturing:false,indicator:0,sample:'none',matchingSupported:false,simulatedAcceptanceSupported:true,acceptances:[],calls:[]};
  const trace=(method,extra={})=>{state.calls.push({method,...extra});app.log?.('simulated-fingerprint',{method,...extra})};
  const object=zero(4),vtable=zero(0x20);put(object,vtable);
  const leb=n=>{const r=[];do{let b=n&127;n>>>=7;if(n)b|=128;r.push(b)}while(n);return r};
  const section=(i,a)=>[i,...leb(a.length),...a];
  function thunk(arity,result,host,original,target,thisIndex){
    const type=[1,0x60,arity,...Array(arity).fill(0x7f),...(result?[1,0x7f]:[0])];
    const args=Array.from({length:arity},(_,i)=>[0x20,i]).flat();
    const pointer=leb(target);if(pointer.at(-1)&0x40){pointer[pointer.length-1]|=0x80;pointer.push(0)}
    // Dispatch in WASM: unrelated calls go straight to the original WASM function.
    // A JavaScript fallback frame here prevents JSPI suspension during key decryption.
    const body=[0,0x20,thisIndex,0x41,...pointer,0x46,0x04,result?0x7f:0x40,
      ...args,0x10,0,0x05,...args,0x10,1,0x0b,0x0b];
    const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,type),...section(2,[2,1,104,1,102,0,0,1,104,1,111,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,2]),...section(10,[1,...leb(body.length),...body])]);
    return new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:host,o:original}}).exports.f;
  }
  const hooks=[],used=new Set();
  function hook(offset,arity,result,thisIndex,handler,target=object,table_=vtable){
    const meta=app.tableMetadata.find(x=>x.slot>0&&!used.has(x.slot)&&x.result===(result?'i32':'nil')&&x.params.length===arity&&x.params.every(t=>t==='i32'));
    if(!meta)throw Error('No compatible fingerprint callback slot');
    used.add(meta.slot);const original=table.get(meta.slot),wrapped=thunk(arity,result,handler,original,target,thisIndex);
    table.set(meta.slot,wrapped);hooks.push({slot:meta.slot,original,wrapped});put(table_+offset,meta.slot);
  }
  try{
    // Polling protocol (CPedeDigitalMesario::ProcessTick, func 10316): each tick VOTA asks for an
    // image (vtable+0x10, sret shared_ptr<vector<uint8>>) and treats the finger as captured only
    // when the image size equals vtable+0 (expected bytes). No image is ever produced here: an
    // empty vector against a non-zero expected size means "no finger yet", so VOTA keeps waiting
    // (its own timeout and the explicit acceptance below still apply).
    const emptyImage=zero(12);
    hook(0,1,true,0,()=>1);
    for(const offset of [4,8])hook(offset,1,true,0,()=>0);
    hook(0x0c,1,false,0,()=>{state.capturing=true;trace('capture-start')});
    hook(0x10,2,false,1,(out)=>{check(out,8);put(out,emptyImage);put(out+4,0);if(!state.polled){state.polled=true;trace('image-poll',{image:'empty'})}});
    hook(0x18,1,false,0,()=>{state.capturing=false;trace('capture-stop')});
    hook(0x1c,2,false,0,(self,mode)=>{if(![0,1,2,3].includes(mode))throw Error('Unknown fingerprint indicator mode');state.indicator=mode;trace('indicator',{mode})});
    // VOTA's PolySingleton registry: entries of 24 bytes {std::string type name, rtti, instance}.
    const registry=table.get(284)();check(registry,0x94);
    function register(typeName,nameAddress,instance){
      let begin=get(registry),end=get(registry+4),capacity=get(registry+8);
      check(begin,end-begin);if((end-begin)%24||end>capacity||capacity>view().byteLength)throw Error('Unexpected native singleton registry');
      const name=new TextEncoder().encode(typeName);
      for(let p=begin;p<end;p+=24){const long=heap()[p+11]&128,a=long?get(p):p,n=long?get(p+4):heap()[p+11];check(a,n);if(n===name.length&&name.every((b,i)=>heap()[a+i]===b))throw Error(`Native ${typeName} already registered`)}
      const size=(name.length+8)&~7,text=zero(size);heap().set(name,text);
      const rtti=zero(8);put(rtti+4,nameAddress);
      if(end+24>capacity){const used_=end-begin,next=zero(used_+192);heap().copyWithin(next,begin,end);put(registry,next);put(registry+4,next+used_);put(registry+8,next+used_+192);free(begin);end=next+used_}
      heap().fill(0,end,end+24);put(end,text);put(end+4,name.length);put(end+8,(0x80000000|size)>>>0);put(end+12,rtti);put(end+16,instance);put(registry+4,end+24);
    }
    register('N3api14IFingerScannerE',0x83b8c,object);
    // api::IFingerDetection: CPedeDigitalMesario::ProcessTick (func 10316) looks it up on every
    // tick, and calls its method at vtable+8 (object, image) -> bool only for a captured image.
    // No image is ever captured here, so it answers "no finger" and is logged if ever called.
    const detection=zero(4),detectionVtable=zero(0x10);put(detection,detectionVtable);
    for(const offset of [0,4])hook(offset,1,false,0,()=>trace('detection-release'),detection,detectionVtable);
    hook(8,2,true,0,()=>{trace('detection-check',{result:false});return 0},detection,detectionVtable);
    register('N3api16IFingerDetectionE',539555,detection);
    // Recognition result screens request IFingerMatcher for the diagnostic score.
    // No real matching occurs: result injection is explicit and the score is zero.
    const matcher=zero(4),matcherVtable=zero(0x14);put(matcher,matcherVtable);
    for(const offset of [0,4])hook(offset,1,false,0,()=>{},matcher,matcherVtable);
    hook(8,4,true,0,()=>{throw Error('Real fingerprint matching is not supported')},matcher,matcherVtable);
    hook(12,3,false,0,()=>{throw Error('Training template matching is not supported')},matcher,matcherVtable);
    hook(16,1,true,0,()=>0,matcher,matcherVtable);
    register('N3api14IFingerMatcherE',0x83bbc,matcher);
    state.registered=true;trace('registered',{object});
  }catch(error){for(const h of hooks.reverse())if(table.get(h.slot)===h.wrapped)table.set(h.slot,h.original);throw error}
  // Caller must serialize this with native execution and then settle transitions
  // through the ordinary EndState/GetNext/StartState lifecycle.
  function timeout(statePointer){
    check(statePointer,0x20);
    if(get(statePointer)!==0x1857c8)throw Error('Fingerprint timeout requires CPedeDigitalMesario');
    if(!state.capturing)throw Error('Fingerprint capture is not active');
    const timerId=heap()[statePointer+0xb],slot=get(get(statePointer)+32);
    if(slot!==4394)throw Error('Unexpected fingerprint timer handler');
    trace('explicit-simulated-timeout',{timerId});
    return table.get(slot)(statePointer,timerId);
  }
  function accept(statePointer){
    check(statePointer,0x20);
    if(get(statePointer)!==0x1857c8||!state.capturing)throw Error('Simulated acceptance requires the active mesário fingerprint prompt');
    const registry=table.get(284)();let controller=0;
    for(let p=get(registry);p<get(registry+4);p+=24){const n=heap()[p+11],a=n&128?get(p):p,len=n&128?get(p+4):n;
      if(new TextDecoder().decode(heap().slice(a,a+len))==='N5comum28IControladorRegistraMesariosE')controller=get(p+16);
    }
    if(!controller||get(controller)!==1586608)throw Error('Unexpected registration controller');
    for(const [slot,index] of [[3690,10799],[3704,10788],[4378,10327]])if(app.tableMetadata.find(x=>x.slot===slot)?.functionIndex!==index)throw Error('Unexpected registration acceptance ABI');
    const titleObject=table.get(3704)(controller),long=heap()[titleObject+11]&128;
    const title=new TextDecoder().decode(heap().slice(long?get(titleObject):titleObject,(long?get(titleObject):titleObject)+(long?get(titleObject+4):heap()[titleObject+11])));
    if(!/^\d{12}$/.test(title))throw Error('No selected mesário title');
    // Explicit response injection, not a scanner/matcher implementation.
    // func1149 defines this result context; func10316 uses status 3 in its
    // captured/no-stored-template branch. No fingerprint/template file is made.
    let result=get(1909960);
    if(!result){result=zero(24);put(result+4,20);put(1909960,result);}
    check(result,24);put(result,0);put(result+8,3);put(result+12,0);put(result+16,0);
    const continuation=zero(12);put(continuation,1595176);put(continuation+4,continuation);
    table.get(3690)(controller,heap()[statePointer+11]);table.get(3690)(controller,heap()[statePointer+12]);
    const event={title,mode:'host-injected-registration-acceptance',biometricMatchPerformed:false,templateCreated:false};
    state.acceptances.push(event);trace('explicit-simulated-acceptance',event);
    // Normal EndState stops the scanner; original GestorDadoMesario selects
    // the registration phase, writes the record and updates the native count.
    put(statePointer+4,continuation);
  }
  const api={state,object,vtable,timeout,accept};app.fingerprint=api;installVoterBiometrics(app);return api;
};
