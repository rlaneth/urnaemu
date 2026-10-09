// Synthetic session-only IKernelHSM secret and native BER vote-key fixture.
// The envelope uses the original supported plaintext branch; no HSM encryption claim.
export const installNativeTestKey = function(app) {
  if (app.testKey) return app.testKey;
  const table=app.exports.Fb, view=()=>new DataView(app.exports.Cb.buffer), heap=()=>new Uint8Array(app.exports.Cb.buffer);
  const alloc=table.get(5), freeIndex=app.tableMetadata.find(x=>x.functionIndex===136)?.slot;
  if(freeIndex===undefined)throw Error('Native deallocator unavailable');
  const free=table.get(freeIndex),get=p=>view().getUint32(p,true),put=(p,n)=>view().setUint32(p,n,true);
  const check=(p,n)=>{if(!Number.isInteger(p)||!Number.isInteger(n)||p<1024||n<0||p+n>view().byteLength)throw Error('Invalid test-key ABI range')};
  const zero=n=>{const p=alloc(n);check(p,n);heap().fill(0,p,p+n);return p};
  const state={simulated:true,registered:false,encryptedEnvelope:false,keyBytes:16,keyPairId:1,calls:[]};
  const secret=crypto.getRandomValues(new Uint8Array(32));
  const voteKey=crypto.getRandomValues(new Uint8Array(16));
  const trace=(method,extra={})=>{state.calls.push({method,...extra});app.log?.('simulated-test-key',{method,...extra})};
  const object=zero(4),vtable=zero(0x20),rtti=zero(8);put(object,vtable);put(rtti+4,0x790a8);
  const leb=n=>{const r=[];do{let b=n&127;n>>>=7;if(n)b|=128;r.push(b)}while(n);return r};
  const section=(i,a)=>[i,...leb(a.length),...a];
  function thunk(arity,result,host){
    const type=[1,0x60,arity,...Array(arity).fill(0x7f),...(result?[1,0x7f]:[0])];
    const body=[0,...Array.from({length:arity},(_,i)=>[0x20,i]).flat(),0x10,0,0x0b];
    const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,type),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);
    return new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:host}}).exports.f;
  }
  const hooks=[],used=new Set();
  function hook(offset,arity,result,thisIndex,handler){
    const meta=app.tableMetadata.find(x=>x.slot>0&&!used.has(x.slot)&&x.result===(result?'i32':'nil')&&x.params.length===arity&&x.params.every(t=>t==='i32'));
    if(!meta)throw Error('No compatible test-key callback slot');
    used.add(meta.slot);const original=table.get(meta.slot),wrapped=thunk(arity,result,(...a)=>a[thisIndex]===object?handler(...a):original(...a));
    table.set(meta.slot,wrapped);hooks.push({slot:meta.slot,original,wrapped});put(vtable+offset,meta.slot);
  }
  let path,registeredRegistry=0,registeredEnd=0;
  try{
    hook(0x0c,2,false,1,(out)=>{check(out,12);const data=zero(secret.length);heap().set(secret,data);put(out,data);put(out+4,data+secret.length);put(out+8,data+secret.length);trace('session-secret',{bytes:secret.length})});
    const registry=table.get(284)();check(registry,0x94);let begin=get(registry),end=get(registry+4),capacity=get(registry+8);
    check(begin,end-begin);if((end-begin)%24||end>capacity||capacity>view().byteLength)throw Error('Unexpected native singleton registry');
    const name=new TextEncoder().encode('N3api10IKernelHSME');
    for(let p=begin;p<end;p+=24){const long=heap()[p+11]&128,a=long?get(p):p,n=long?get(p+4):heap()[p+11];check(a,n);if(n===name.length&&name.every((b,i)=>heap()[a+i]===b))throw Error('Native HSM service already registered')}
    const text=zero(24);heap().set(name,text);
    if(end+24>capacity){const size=end-begin,next=zero(size+192);heap().copyWithin(next,begin,end);put(registry,next);put(registry+4,next+size);put(registry+8,next+size+192);free(begin);end=next+size}
    heap().fill(0,end,end+24);put(end,text);put(end+4,name.length);put(end+8,0x80000018);put(end+12,rtti);put(end+16,object);put(registry+4,end+24);
    registeredRegistry=registry;registeredEnd=end;state.registered=true;trace('registered',{object});
    // Original path resolver6048 prepends its configurable base path string.
    const base=0x1c0e08,long=heap()[base+11]&128,a=long?get(base):base,n=long?get(base+4):heap()[base+11];
    if(n)check(a,n);const prefix=new TextDecoder().decode(heap().slice(a,a+n));
    path=prefix+'/dsk/fi/estatico/chave/cv.ber.pri';
    const fs=globalThis.Module.FS;
    if(fs.analyzePath(path).exists)throw Error('Refusing to overwrite an existing native vote-key file');
    const textBytes=s=>Array.from(new TextEncoder().encode(s));
    const tlv=(tag,data)=>{const length=[];let n=data.length;do{length.unshift(n&255);n=Math.floor(n/256)}while(n);return [tag,...(data.length<128?[data.length]:[128|length.length,...length]),...data]};
    // NumericString(12), SEQUENCE(holder GeneralString, nonzero INTEGER),
    // BOOLEAN encrypted=false, ENUMERATED chaveSecreta=0, OCTETSTRING payload.
    const envelope=new Uint8Array(tlv(0x30,[...tlv(0x12,textBytes('000000000001')),...tlv(0x30,[...tlv(0x1b,textBytes('VOTA EMULATOR TEST ONLY')),...tlv(2,[1])]),...tlv(1,[0]),...tlv(0x0a,[0]),...tlv(4,Array.from(voteKey))]));
    fs.mkdirTree(path.slice(0,path.lastIndexOf('/')));fs.writeFile(path,envelope);
    state.path=path;state.envelopeBytes=envelope.length;trace('test-key-provisioned',{path,keyBytes:16,encrypted:false});
    if(app.fullSession){
      const publicKey=app.pkcs11?.provider?.spki;
      if(!publicKey?.length)throw Error('Test public key required for full-session JUFA fixture');
      const owned=[];let control=0;
      const block=n=>{const p=zero(n);owned.push(p);return p};
      const vector=bytes=>{const p=block(12),data=block(bytes.length);heap().set(bytes,data);put(p,data);put(p+4,data+bytes.length);put(p+8,data+bytes.length);return p};
      const invoke=(slot,args)=>{const meta=app.tableMetadata.find(x=>x.slot===slot);if(!meta||meta.params.length!==args.length||!meta.params.every(t=>t==='i32')||meta.result!=='nil')throw Error('Unexpected key-wrapping ABI');return table.get(slot)(...args)};
      try{
        if(app.tableMetadata.find(x=>x.slot===6288)?.functionIndex!==1884)throw Error('Unexpected native cipher factory');
        const factory=block(4);put(factory,0x10fef0);
        const secretString=block(12),secretBytes=block(secret.length+1);heap().set(secret,secretBytes);put(secretString,secretBytes);put(secretString+4,secret.length);put(secretString+8,0x80000000|secret.length+1);
        const shared=block(8);invoke(6288,[shared,factory,secretString]);const cipher=get(shared);control=get(shared+4);
        if(get(cipher)!==0x10ff48)throw Error('Unexpected native symmetric cipher object');
        const plain=vector(publicKey),encrypted=block(12),decrypted=block(12);
        invoke(get(get(cipher)+8),[cipher,plain,encrypted]);if(get(encrypted))owned.push(get(encrypted));
        invoke(get(get(cipher)+12),[cipher,encrypted,decrypted]);if(get(decrypted))owned.push(get(decrypted));
        const decoded=heap().slice(get(decrypted),get(decrypted+4));
        if(decoded.length!==publicKey.length||decoded.some((b,i)=>b!==publicKey[i]))throw Error('Native JUFA key wrapping round trip failed');
        const wrapped=heap().slice(get(encrypted),get(encrypted+4)),jufaPath=prefix+'/dsk/fi/estatico/chave/jufa.pk1';
        if(fs.analyzePath(jufaPath).exists)throw Error('Refusing to replace existing JUFA key');
        const keyEnvelope=new Uint8Array(tlv(0x30,[...tlv(0x12,textBytes('000000000001')),...tlv(0x30,[...tlv(0x1b,textBytes('VOTA EMULATOR TEST ONLY')),...tlv(2,[1])]),...tlv(1,[255]),...tlv(0x0a,[1]),...tlv(4,Array.from(wrapped))]));
        fs.writeFile(jufaPath,keyEnvelope);
        const wsqPath=prefix+'/dsk/fi/estatico/chave/wsq.pk1';
        if(fs.analyzePath(wsqPath).exists)throw Error('Refusing to replace existing WSQ key');
        fs.writeFile(wsqPath,keyEnvelope);
        state.wsq={path:wsqPath,synthetic:true,publicKeyFormat:app.pkcs11.provider.algorithm+' SPKI test identity',productionAlgorithmCompatible:false};
        trace('wsq-test-public-key-provisioned',state.wsq);
        state.jufa={path:jufaPath,synthetic:true,publicKeyFormat:app.pkcs11.provider.algorithm+' SPKI test identity',wrappedBytes:wrapped.length,envelopeBytes:keyEnvelope.length,nativeCipherRoundTripVerified:true,productionAlgorithmCompatible:false,nativeCepescPayloadEncrypted:false};
        trace('jufa-test-public-key-provisioned',state.jufa);
      }finally{
        if(control){const vt=get(control);invoke(get(vt+8),[control]);invoke(get(vt+16),[control]);}
        for(const p of owned.reverse())free(p);
      }
    }
  }catch(error){if(registeredRegistry&&get(registeredRegistry+4)===registeredEnd+24){put(registeredRegistry+4,registeredEnd);heap().fill(0,registeredEnd,registeredEnd+24)}for(const h of hooks.reverse())if(table.get(h.slot)===h.wrapped)table.set(h.slot,h.original);throw error}
  const api={state,object,vtable};app.testKey=api;return api;
};
