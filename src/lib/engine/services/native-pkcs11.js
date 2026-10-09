// Narrow, opt-in reconstruction of the three observed IPkcs11 callers.
// Runtime memory/table adapters only; original files and WASM bytes stay intact.
export const installNativePkcs11 = async function(app,provider) {
 if(app.pkcs11) return app.pkcs11;
 if(!WebAssembly.Suspending)throw Error('Native crypto adapter requires JSPI');
 const table=app.exports.Fb, memory=()=>new DataView(app.exports.Cb.buffer), heap=()=>new Uint8Array(app.exports.Cb.buffer);
 const alloc=table.get(5),freeSlot=app.tableMetadata.find(x=>x.functionIndex===136)?.slot;
 if(freeSlot===undefined)throw Error('Native deallocator unavailable');const free=table.get(freeSlot);
 const u32=p=>memory().getUint32(p,true),put=(p,v)=>memory().setUint32(p,v,true);
 const check=(p,n)=>{if(!Number.isInteger(p)||!Number.isInteger(n)||p<1024||n<0||p+n>memory().byteLength)throw Error('Invalid crypto ABI memory range')};
 const zero=n=>{const p=alloc(n);check(p,n);heap().fill(0,p,p+n);return p};
 const vector=p=>{check(p,12);const a=u32(p),b=u32(p+4),c=u32(p+8);if(!a&&!b&&!c)return new Uint8Array();check(a,b-a);if(b>c||c>memory().byteLength||b-a>1024*1024)throw Error('Invalid crypto input vector');return heap().slice(a,b)};
 const writeVector=(p,data)=>{check(p,12);const n=data.length,a=n?zero(n):0;if(n)heap().set(data,a);put(p,a);put(p+4,a+n);put(p+8,a+n)};
 const object=zero(4),vtable=zero(0x64),rtti=zero(8);put(object,vtable);put(rtti+4,0x7e3d1);
 const state={simulated:true,profile:provider.profile,registered:false,locked:false,calls:[],signatures:[],publicMaterialFormat:'self-signed DER X.509 certificate; experimental format assumption'};
 function trace(method,extra={}){state.calls.push({method,...extra});app.log?.('simulated-pkcs11',{method,...extra});}
 // A small separate module supplies typed funcref wrappers; the fixed original
 // table cannot grow. Multiplexed slots preserve original behavior for every
 // pointer except this adapter's allocated object.
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 const section=(id,data)=>[id,...leb(data.length),...data];
 function thunk(arity,host,suspending,original,thisIndex){
  const type=[1,0x60,arity,...Array(arity).fill(0x7f),0];
  const args=Array.from({length:arity},(_,i)=>[32,i]).flat(),pointer=leb(object);
  if(pointer.at(-1)&64){pointer[pointer.length-1]|=128;pointer.push(0)}
  // Only the PKCS#11 handler may suspend. Native uses this shared table slot
  // through synchronous invoke_* imports too; their fallback must stay in WASM.
  const body=[0,32,thisIndex,65,...pointer,70,4,64,...args,16,0,5,...args,16,1,11,11];
  const binary=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,type),...section(2,[2,1,104,1,102,0,0,1,104,1,111,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,2]),...section(10,[1,...leb(body.length),...body])]);
  return new WebAssembly.Instance(new WebAssembly.Module(binary),{h:{f:suspending?new WebAssembly.Suspending(host):host,o:original}}).exports.f;
 }
 const hooks=[],used=new Set();
 function hook(offset,arity,thisIndex,handler,suspending=false){const meta=app.tableMetadata.find(x=>x.slot>0&&!used.has(x.slot)&&x.result==='nil'&&x.params.length===arity&&x.params.every(p=>p==='i32'));if(!meta)throw Error('No compatible table callback slot');used.add(meta.slot);const original=table.get(meta.slot),wrapped=thunk(arity,handler,suspending,original,thisIndex);table.set(meta.slot,wrapped);hooks.push({slot:meta.slot,original,wrapped});put(vtable+offset,meta.slot)}
 try{
  hook(0x5c,1,0,()=>{if(state.locked)throw Error('Nested simulated PKCS11 scope');state.locked=true;trace('begin')});
  hook(0x60,1,0,()=>{if(!state.locked)throw Error('Unbalanced simulated PKCS11 scope');state.locked=false;trace('end')});
  hook(0x28,2,1,(out)=>{if(!state.locked)throw Error('Certificate requested outside PKCS11 scope');writeVector(out,provider.certificate);trace('public-material',{bytes:provider.certificate.length})});
  hook(0x18,3,1,async(out,self,input)=>{if(!state.locked)throw Error('Signature requested outside PKCS11 scope');check(out,20);const data=vector(input);if(data.length!==64)throw Error('Unrecognized native signature input: expected recovered SHA-512 digest (64 bytes)');const signature=await provider.sign(data);if(app.native?.state.cancelled)throw Error('Native crypto cancelled; reload required');if(!await provider.verify(data,signature))throw Error('Generated signature failed verification');if(app.native?.state.cancelled)throw Error('Native crypto cancelled; reload required');heap().fill(0,out,out+20);writeVector(out+8,signature);state.signatures.push({input:Array.from(data),signature:Array.from(signature)});trace('sign',{inputBytes:data.length,signatureBytes:signature.length,verified:true})},true);
  const registry=table.get(284)();check(registry,0x94);let begin=u32(registry),end=u32(registry+4),capacity=u32(registry+8);check(begin,end-begin);if((end-begin)%24||end>capacity||capacity>memory().byteLength)throw Error('Unexpected native singleton registry');
  const name=new TextEncoder().encode('N3api6pkcs117IPkcs11E');
  for(let p=begin;p<end;p+=24){const long=heap()[p+11]&128,a=long?u32(p):p,n=long?u32(p+4):heap()[p+11];check(a,n);if(n===name.length&&name.every((b,i)=>heap()[a+i]===b))throw Error('Native PKCS11 service already registered')}
  const text=zero(24);heap().set(name,text);
  if(end+24>capacity){const size=end-begin,next=zero(size+24*8);heap().copyWithin(next,begin,end);put(registry,next);put(registry+4,next+size);put(registry+8,next+size+24*8);free(begin);begin=next;end=next+size}
  heap().fill(0,end,end+24);put(end,text);put(end+4,name.length);put(end+8,0x80000018);put(end+12,rtti);put(end+16,object);put(end+20,0);put(registry+4,end+24);
  state.registered=true;trace('registered',{object,profile:provider.profile});
 }catch(error){for(const h of hooks)if(table.get(h.slot)===h.wrapped)table.set(h.slot,h.original);throw error}
 const api={state,provider,object,vtable};app.pkcs11=api;return api;
};
