// Host implementation of the published BER structure. Synthetic P-521 keys;
// the SW profile is deliberately not the production CEPESC hybrid profile.
export const createTestResultSignature = async function(files,provider,createdAt=new Date()){
 if(provider.algorithm!=='P-521')throw Error('Result container requires explicit P-521 test profile');
 const join=(...parts)=>{const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){b.set(p,i);i+=p.length}return b};
 const tlv=(tag,...parts)=>{const b=join(...parts),a=[];let n=b.length;do{a.unshift(n&255);n=Math.floor(n/256)}while(n);return join(Uint8Array.of(tag,...(b.length<128?[b.length]:[128|a.length,...a])),b)};
 const num=(tag,n)=>{if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid BER integer');const b=[];do{b.unshift(n&255);n=Math.floor(n/256)}while(n);if(b[0]&128)b.unshift(0);return tlv(tag,Uint8Array.from(b))};
 const seq=(...p)=>tlv(48,...p),int=n=>num(2,n),en=n=>num(10,n),oct=b=>tlv(4,b),str=s=>tlv(27,new TextEncoder().encode(s));
 const names=new Set();
 async function signed(bytes){const hash=await provider.digest(bytes),signature=await provider.sign(hash);if(!await provider.verify(hash,signature))throw Error('Test result signature failed self-verification');return seq(int(bytes.length),oct(hash),oct(signature))}
 const entries=[];
 for(const {name,bytes} of files){if(!/^[a-z0-9-]+\.(dat|jez|ver)$/.test(name)||names.has(name))throw Error('Invalid/duplicate signed filename');names.add(name);entries.push(seq(str(name),await signed(bytes)))}
 if(!entries.length)throw Error('Cannot sign an empty result set');
 const content=seq(seq(...entries)),stamp=createdAt.toISOString().replace(/[-:]/g,'').slice(0,15);
 const entity=async label=>seq(str(stamp),int(2),seq(seq(str(label),int(1)),seq(en(4)),seq(en(2),int(521)),await signed(content)),oct(content),tlv(0x81,provider.certificate));
 // Both test sets use the same laboratory key. Model 15 describes only the
 // selected test signature profile; it is not a claim about emulated hardware.
 return seq(await entity('EMULATOR TEST SW P521'),await entity('EMULATOR TEST HW P521'),seq(en(15),en(2)));
};
