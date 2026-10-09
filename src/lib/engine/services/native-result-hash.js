// Reconnect the compiled SHA-512 implementation to its missing result factory.
// Text encoding is an explicit uppercase-hex host profile, independently checked.
export const installNativeResultHash = function(app){
 if(app.resultHash)return app.resultHash;
 const table=app.exports.Fb,view=()=>new DataView(app.exports.Cb.buffer),heap=()=>new Uint8Array(app.exports.Cb.buffer);
 const alloc=table.get(5),free=table.get(app.tableMetadata.find(x=>x.functionIndex===136).slot);
 const get=p=>view().getUint32(p,true),put=(p,n)=>view().setUint32(p,n,true);
 const zero=n=>{const p=alloc(n);heap().fill(0,p,p+n);return p};
 const state={registered:false,hash:'original native SHA-512',textEncoding:'host uppercase hexadecimal',nativeHashesCreated:0,encoded:[]};
 const factories=new Map(),encoders=new Set(),used=new Set();
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 const section=(id,a)=>[id,...leb(a.length),...a];
 function hook(arity,result,thisIndex,matches,handler){
  // Keep separate from the low-numbered slots multiplexed by PKCS11/HSM,
  // whose callbacks can suspend across WebCrypto operations.
  const meta=app.tableMetadata.find(x=>x.slot>12000&&!used.has(x.slot)&&x.result===(result?'i32':'nil')&&x.params.length===arity&&x.params.every(t=>t==='i32'));
  if(!meta)throw Error('No compatible result-factory callback slot');used.add(meta.slot);
  const original=table.get(meta.slot),body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];
  const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),...(result?[1,127]:[0])]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);
  table.set(meta.slot,new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:(...a)=>matches(a[thisIndex])?handler(...a):original(...a)}}).exports.f);
  return meta.slot;
 }
 if(app.tableMetadata.find(x=>x.slot===6280)?.functionIndex!==2684)throw Error('Unexpected native SHA-512 constructor');
 const encoderVtable=zero(12);
 put(encoderVtable,hook(1,true,0,p=>encoders.has(p),p=>p));
 put(encoderVtable+4,hook(1,false,0,p=>encoders.has(p),p=>{encoders.delete(p);free(p)}));
 put(encoderVtable+8,hook(3,false,1,p=>encoders.has(p),(out,self,input)=>{
  const a=get(input),b=get(input+4),capacity=get(input+8);
  if(a<1024||b<a||b>capacity||capacity>heap().length||b-a>1024*1024)throw Error('Invalid result digest vector');
  const data=heap().slice(a,b),text=Array.from(data,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase(),encoded=new TextEncoder().encode(text),p=zero(encoded.length+1);
  heap().set(encoded,p);put(out,p);put(out+4,encoded.length);put(out+8,0x80000000|(encoded.length+1));
  state.encoded.push({bytes:Array.from(data),text});
 }));
 const factoryVtable=zero(12);
 put(factoryVtable,hook(1,true,0,p=>factories.has(p),p=>p));
 put(factoryVtable+4,hook(1,false,0,p=>factories.has(p),p=>{factories.delete(p);free(p)}));
 put(factoryVtable+8,hook(1,true,0,p=>factories.has(p),p=>{
  if(factories.get(p)==='hash'){const object=zero(28);table.get(6280)(object);state.nativeHashesCreated++;return object;}
  const object=zero(4);put(object,encoderVtable);encoders.add(object);return object;
 }));
 function register(name,address,kind){
  const registry=table.get(284)(),begin=get(registry),oldEnd=get(registry+4),capacity=get(registry+8);
  if((oldEnd-begin)%24||oldEnd>capacity)throw Error('Unexpected singleton registry');
  for(let p=begin;p<oldEnd;p+=24){const long=heap()[p+11]&128,a=long?get(p):p,n=long?get(p+4):heap()[p+11];if(new TextDecoder().decode(heap().slice(a,a+n))===name)throw Error('Result factory already registered');}
  let end=oldEnd;
  if(end+24>capacity){const size=end-begin,next=zero(size+192);heap().copyWithin(next,begin,end);put(registry,next);put(registry+4,next+size);put(registry+8,next+size+192);free(begin);end=next+size;}
  const bytes=new TextEncoder().encode(name),text=zero(bytes.length+1),rtti=zero(8),object=zero(4);heap().set(bytes,text);put(rtti+4,address);put(object,factoryVtable);factories.set(object,kind);
  heap().fill(0,end,end+24);put(end,text);put(end+4,bytes.length);put(end+8,0x80000000|(bytes.length+1));put(end+12,rtti);put(end+16,object);put(registry+4,end+24);
 }
 register('N3api15IGenericFactoryIN7ecourna3api8security5IHashEEE',547627,'hash');
 register('N3api15IGenericFactoryIN7ecourna3api8security13ITextEncodingEEE',547682,'encoding');
 state.registered=true;app.resultHash={state};return app.resultHash;
};
