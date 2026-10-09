// Emulator trust identity: generated or explicitly imported user keys.
// Ed25519 is this provider's explicit test profile, not a recovered
// claim about the production device's key algorithm.
//
// The self-signed X.509 certificate is built from `certificateFields` ({CN, O, OU, L, ST, C,
// emailAddress, serial (hex), notBefore, notAfter}) or, with `certificate` (DER), reused as
// stored: it must carry this key's public key.
export const DEFAULT_CERTIFICATE_FIELDS = { C: 'BR', ST: 'RJ', L: 'Rio de Janeiro', O: 'UrnaEmu', OU: 'UrnaEmu', CN: 'UrnaEmu', emailAddress: 'contato@rlaneth.com' };
export const createWebCryptoProvider = async function({profile='Ed25519',privateJwk=null,certificateFields=null,certificate:storedCertificate=null}={}) {
 if(!['Ed25519','P-521'].includes(profile))throw Error('Perfil de assinatura de teste não suportado');
 if (!globalThis.crypto?.subtle) throw Error('As assinaturas exigem um contexto seguro do navegador (HTTPS ou localhost)');
 const subtle=crypto.subtle, encoder=new TextEncoder();
 const bytes=x=>x instanceof Uint8Array?x:new Uint8Array(x);
 const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let n=0;for(const p of parts){out.set(p,n);n+=p.length}return out};
 const length=n=>{if(n<128)return Uint8Array.of(n);const a=[];while(n){a.unshift(n&255);n=Math.floor(n/256)}return Uint8Array.of(128|a.length,...a)};
 const der=(tag,...parts)=>{const value=concat(...parts);return concat(Uint8Array.of(tag),length(value.length),value)};
 const seq=(...x)=>der(0x30,...x), oid=(...x)=>der(6,Uint8Array.from(x));
 const integer=value=>{let v=bytes(value);while(v.length>1&&v[0]===0)v=v.slice(1);if(v[0]&128)v=concat(Uint8Array.of(0),v);return der(2,v)};
 const ec=profile==='P-521',algorithm=ec?{name:'ECDSA',hash:'SHA-512'}:{name:'Ed25519'};
 const keyAlgorithm=ec?{name:'ECDSA',namedCurve:'P-521'}:algorithm;
 let keys;
 if(privateJwk){
  if(privateJwk.crv!==(ec?'P-521':'Ed25519')||!privateJwk.d)throw Error('A chave privada não é do tipo esperado (P-521)');
  const {d,key_ops,...publicJwk}=privateJwk;
  keys={privateKey:await subtle.importKey('jwk',privateJwk,keyAlgorithm,true,['sign']),publicKey:await subtle.importKey('jwk',publicJwk,keyAlgorithm,true,['verify'])};
 }else keys=await subtle.generateKey(keyAlgorithm,true,['sign','verify']);
 const spki=bytes(await subtle.exportKey('spki',keys.publicKey));
 const signatureAlgorithm=ec?seq(oid(0x2a,0x86,0x48,0xce,0x3d,4,3,4)):seq(oid(0x2b,0x65,0x70));
 // WebCrypto ECDSA uses fixed-width r||s; X.509 and TSE's ECDSA reader use DER.
 const encodeSignature=raw=>ec?seq(integer(raw.slice(0,66)),integer(raw.slice(66))):raw;
 const decodeSignature=encoded=>{
  if(!ec)return encoded;
  let at=0;const octet=()=>{if(at>=encoded.length)throw Error('Truncated ECDSA signature');return encoded[at++]};
  const size=()=>{let n=octet();if(n<128)return n;const count=n&127;if(!count||count>2)throw Error('Invalid DER length');n=0;for(let i=0;i<count;i++)n=n*256+octet();return n};
  if(octet()!==48)throw Error('Invalid ECDSA sequence');const total=size();if(at+total!==encoded.length)throw Error('Invalid ECDSA length');
  const raw=new Uint8Array(132);
  for(let component=0;component<2;component++){
   if(octet()!==2)throw Error('Invalid ECDSA integer');const n=size();if(!n||at+n>encoded.length||encoded[at]&128)throw Error('Invalid ECDSA integer length/sign');
   let value=encoded.slice(at,at+n);at+=n;if(value.length>1&&value[0]===0){if(!(value[1]&128))throw Error('Nonminimal DER integer');value=value.slice(1)}
   if(value.length>66)throw Error('Oversized ECDSA component');raw.set(value,component*66+66-value.length);
  }
  if(at!==encoded.length)throw Error('Trailing ECDSA data');return raw;
 };
 // Distinguished name attributes in the usual order (RFC 5280 / X.520 OIDs).
 const ATTRIBUTES=[['C',[0x55,4,6],0x13],['ST',[0x55,4,8],0x0c],['L',[0x55,4,7],0x0c],['O',[0x55,4,10],0x0c],['OU',[0x55,4,11],0x0c],['CN',[0x55,4,3],0x0c],['emailAddress',[0x2a,0x86,0x48,0x86,0xf7,0x0d,1,9,1],0x16]];
 const fields={...DEFAULT_CERTIFICATE_FIELDS,...(certificateFields||{})};
 const subject=seq(...ATTRIBUTES.filter(([k])=>String(fields[k]??'').trim()).map(([k,o,tag])=>der(0x31,seq(oid(...o),der(tag,encoder.encode(String(fields[k]).trim()))))));
 if(!ATTRIBUTES.some(([k])=>String(fields[k]??'').trim()))throw Error('Preencha pelo menos um campo do titular do certificado');
 // UTCTime until 2049, GeneralizedTime afterwards (RFC 5280, 4.1.2.5).
 const time=date=>{const iso=date.toISOString().replace(/[-:T]/g,'').replace(/\.\d{3}Z$/,'Z');return date.getUTCFullYear()<2050?der(0x17,encoder.encode(iso.slice(2))):der(0x18,encoder.encode(iso))};
 const notBefore=fields.notBefore?new Date(fields.notBefore):new Date(Date.now()-60000);
 const notAfter=fields.notAfter?new Date(fields.notAfter):new Date(notBefore.getTime()+86400000*365*2);
 if(!Number.isFinite(notBefore.getTime())||!Number.isFinite(notAfter.getTime())||notAfter<=notBefore)throw Error('Validade do certificado inválida: o fim precisa ser depois do início');
 const serialHex=String(fields.serial||'').replace(/[^0-9a-f]/gi,'');
 const serial=serialHex?Uint8Array.from(serialHex.padStart(serialHex.length+(serialHex.length%2),'0').match(/../g),h=>parseInt(h,16)):crypto.getRandomValues(new Uint8Array(16));
 if(serial.length>20||serial.every(b=>b===0))throw Error('O número de série precisa ter de 1 a 20 bytes e não ser zero');
 // Self-signed X.509 v3: digitalSignature, CA=false. No external trust chain.
 const extensions=der(0xa3,seq(seq(oid(0x55,0x1d,0x13),der(1,Uint8Array.of(255)),der(4,seq())),seq(oid(0x55,0x1d,0x0f),der(1,Uint8Array.of(255)),der(4,der(3,Uint8Array.of(7,128))))));
 let certificate,certSignatureRaw=null,tbs=null;
 if(storedCertificate){
  certificate=bytes(storedCertificate);
  // The stored certificate must carry this key: its SubjectPublicKeyInfo appears verbatim.
  const hay=certificate,needle=spki;let found=false;
  for(let i=0;i<=hay.length-needle.length&&!found;i++){let j=0;while(j<needle.length&&hay[i+j]===needle[j])j++;found=j===needle.length}
  if(!found)throw Error('O certificado não corresponde à chave privada');
 }else{
  tbs=seq(der(0xa0,integer(Uint8Array.of(2))),integer(serial),signatureAlgorithm,subject,seq(time(notBefore),time(notAfter)),subject,spki,extensions);
  certSignatureRaw=bytes(await subtle.sign(algorithm,keys.privateKey,tbs));
  certificate=seq(tbs,signatureAlgorithm,der(3,Uint8Array.of(0),encodeSignature(certSignatureRaw)));
 }
 const stats={signatures:0,verifications:0,digests:0};
 const api={profile:'SIMULATED IDENTITY / real '+profile+' signing of supplied bytes',algorithm:profile,certificate:certificate.slice(),spki:spki.slice(),stats,
  async exportPrivateJwk(){return subtle.exportKey('jwk',keys.privateKey)},
  async exportPkcs8(){return bytes(await subtle.exportKey('pkcs8',keys.privateKey))},
  async sign(data){const result=encodeSignature(bytes(await subtle.sign(algorithm,keys.privateKey,bytes(data))));stats.signatures++;return result},
  async verify(data,signature){let decoded;try{decoded=decodeSignature(bytes(signature))}catch{return false}const valid=await subtle.verify(algorithm,keys.publicKey,decoded,bytes(data));stats.verifications++;return valid},
  async digest(data){const result=bytes(await subtle.digest('SHA-512',bytes(data)));stats.digests++;return result},
  async selfTest(){const data=encoder.encode('VOTA emulator WebCrypto self-test'),signature=await api.sign(data),changed=data.slice();changed[0]^=1;const valid=await api.verify(data,signature),rejectsTampering=!await api.verify(changed,signature),certificateSignatureValid=tbs?await subtle.verify(algorithm,keys.publicKey,certSignatureRaw,tbs):true;if(!valid||!rejectsTampering||!certificateSignatureValid)throw Error('O autoteste criptográfico falhou');return {valid,rejectsTampering,certificateSignatureValid,signatureBytes:signature.length,certificateBytes:certificate.length,profile:api.profile}}
 };
 return api;
};
