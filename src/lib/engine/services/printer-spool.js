// Browser-printer transport, not the physical urna's undocumented spool format.
// Both producer and replay consumer belong to this host implementation.
export const VotaPrinterSpool = (()=>{
 const magic='VOTA-EMULATOR-SPOOL/1\n';
 function validate(document){
  if(document?.format!=='vota-emulator-printer-spool-v1'||!Array.isArray(document.operations)||document.operations.length>20000)throw Error('Unsupported browser printer spool');
  for(const op of document.operations){
   if(!['text','newline','cut','qr'].includes(op.kind))throw Error('Unsupported spool operation '+op.kind);
   if(op.kind==='text'&&(typeof op.text!=='string'||!Number.isInteger(op.style)||!Number.isInteger(op.textAttribute)))throw Error('Invalid spool text');
   if(op.kind==='text'||op.kind==='qr'){
    if(!Array.isArray(op.bytes)||op.bytes.length>1024*1024||op.bytes.some(b=>!Number.isInteger(b)||b<0||b>255))throw Error('Invalid spool byte vector');
   }
   if(op.kind==='qr'&&(!Number.isInteger(op.width)||op.width<1||op.width>400||op.height!==op.width||op.bytes.length!==Math.ceil(op.width*op.width/8)||op.encoding!=='row-major-lsb-first-1-black'||!Number.isInteger(op.scale)||op.scale<1||op.scale>4))throw Error('Invalid spool QR bitmap');
  }
  return document;
 }
 function encode(operations){
  const document=validate({format:'vota-emulator-printer-spool-v1',physicalPrinterCompatible:false,operations:operations.map(({index,capture,...op})=>op)});
  return new TextEncoder().encode(magic+JSON.stringify(document));
 }
 function decode(bytes){
  if(bytes.length>32*1024*1024)throw Error('Printer spool exceeds host limit');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!text.startsWith(magic))throw Error('Not a browser printer spool; physical printer formats are unsupported');
  return validate(JSON.parse(text.slice(magic.length)));
 }
 const signatureMagic='VOTA-EMULATOR-SPOOL-SIGNATURE/1\n';
 async function sign(bytes,provider){
  const signature=await provider.sign(bytes);
  if(!await provider.verify(bytes,signature))throw Error('Spool test signature verification failed');
  return new TextEncoder().encode(signatureMagic+JSON.stringify({format:'vota-emulator-spool-signature-v1',official:false,algorithm:provider.algorithm||'Ed25519',certificate:Array.from(provider.certificate),signature:Array.from(signature)}));
 }
 async function verify(bytes,sidecar,provider){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(sidecar);
  if(!text.startsWith(signatureMagic))throw Error('Unsupported spool signature format');
  const envelope=JSON.parse(text.slice(signatureMagic.length));
  if(envelope.format!=='vota-emulator-spool-signature-v1'||envelope.official!==false||envelope.algorithm!==(provider.algorithm||'Ed25519')||!Array.isArray(envelope.certificate)||envelope.certificate.length!==provider.certificate.length||envelope.certificate.some((b,i)=>b!==provider.certificate[i])||!Array.isArray(envelope.signature)||(envelope.signature.length<8||envelope.signature.length>144)||envelope.signature.some(b=>!Number.isInteger(b)||b<0||b>255)||!await provider.verify(bytes,new Uint8Array(envelope.signature)))throw Error('Invalid browser spool test signature');
  return true;
 }
 return {encode,decode,sign,verify};
})();
