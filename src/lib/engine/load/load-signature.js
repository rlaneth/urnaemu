// Host input signature adapter: observed standalone EntidadeAssinatura envelope.
// Published ASN.1 types from the TSE (assinatura.asn1).
// Deliberately P-521 emulator credentials, not original CEPESC/tagChaves trust.
import { VotaLoadFormat } from './load-format.js';
export const VotaLoadSignatures = (() => {
 const F=VotaLoadFormat;
 const seq=(...children)=>({tag:48,children}),str=text=>({tag:27,text}),oct=b=>({tag:4,hex:F.hex(b)});
 function num(n,tag=2){if(!Number.isSafeInteger(n)||n<0)throw Error('Inteiro inválido na assinatura');let h=n.toString(16);if(h.length%2)h='0'+h;if(parseInt(h.slice(0,2),16)&128)h='00'+h;return {tag,hex:h};}
 const value=n=>{const b=F.unhex(n.hex);let v=0;for(const x of b)v=v*256+x;if(!Number.isSafeInteger(v)||b[0]&128)throw Error('Inteiro sem sinal inválido');return v};
 async function create(entries,provider){
  if(provider.algorithm!=='P-521')throw Error('As assinaturas .vsc exigem uma identidade P-521');
  async function signed(bytes){const hash=await provider.digest(bytes);return seq(num(bytes.length),oct(hash),oct(await provider.sign(hash)))}
  const list=[];for(const {name,bytes} of entries)list.push(seq(str(name),await signed(bytes)));
  const content=F.encode(seq(seq(...list)));
  return F.encode(seq(str(new Date().toISOString().replace(/[-:]/g,'').slice(0,15)),num(2),seq(seq(str('EMULATOR LOAD P521'),num(1)),seq(num(4,10)),seq(num(2,10),num(521)),await signed(content)),oct(content),{tag:129,hex:F.hex(provider.certificate)}));
 }
 async function verify(bytes,files){
  const root=F.parse(bytes),c=root.children;
  if(root.tag!==48||c?.length!==5||c[4].tag!==129||value(c[1])!==2)throw Error('Envelope de assinatura de entrada não suportado');
  const alg=c[2].children;if(value(alg[1].children[0])!==4||value(alg[2].children[0])!==2||value(alg[2].children[1])!==521)throw Error('Algoritmo de assinatura de entrada não suportado');
  const cert=F.parse(F.unhex(c[4].hex)),tbs=cert.children[0].children,spki=F.encode(tbs[tbs[0].tag===160?6:5]);
  const key=await crypto.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-521'},false,['verify']);
  async function check(tuple,data){const [size,hash,sig]=tuple.children;if(value(size)!==data.length)throw Error('Tamanho do arquivo não confere com a assinatura: arquivo alterado depois de assinado');const computed=new Uint8Array(await crypto.subtle.digest('SHA-512',data));if(F.hex(computed)!==hash.hex)throw Error('Resumo (digest) do arquivo não confere com a assinatura: arquivo alterado depois de assinado');const integers=F.parse(F.unhex(sig.hex)).children;if(integers?.length!==2)throw Error('Assinatura ECDSA inválida');const raw=new Uint8Array(132);integers.forEach((n,i)=>{if(n.tag!==2)throw Error('Inteiro inválido na assinatura');let b=F.unhex(n.hex);if(b[0]===0)b=b.slice(1);if(b.length>66)throw Error('Assinatura grande demais');raw.set(b,i*66+66-b.length)});if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-512'},key,raw,computed))throw Error('Assinatura de arquivo de entrada não confere');}
  const content=F.unhex(c[3].hex);await check(alg[3],content);const entries=F.parse(content).children[0].children,names=new Set();for(const n of entries){const name=n.children[0].text;if(names.has(name)||!files.has(name))throw Error('Arquivo assinado ausente ou repetido: '+name);names.add(name);await check(n.children[1],files.get(name));}return {files:names.size,spki:F.base64(spki)};
 }
 async function resign(files,provider){
  const work=new Map(files),catalogs=new Map(),omitted=[];
  for(const [path,bytes] of work){if(!path.endsWith('.vsc'))continue;let names=[];
   if(bytes.length){const n=F.parse(bytes);if(n.tag!==48||n.children?.length!==5||n.children[3].tag!==4)throw Error('Envelope de assinatura não suportado: '+path);names=F.parse(F.unhex(n.children[3].hex)).children[0].children.map(n=>n.children[0].text);}
   // Every catalog also covers its own files (X.vsc → X.dat, X.pid). The simulator's t00000br-pu.vsc is a
   // copy of t02400ac-pu.vsc and lists only the state package; empty fixture catalogs list nothing.
   for(const ext of ['dat','pid']){const p=path.replace(/vsc$/,ext),name=p.split('/').pop();if(work.has(p)&&!names.includes(name))names.push(name);}
   const dir=path.slice(0,path.lastIndexOf('/')+1);catalogs.set(path,names.filter(name=>{if(!/^[a-z0-9_.-]+$/.test(name)||name.includes('..'))throw Error('Nome de arquivo inválido no catálogo de assinaturas');if(work.has(dir+name))return true;omitted.push({catalog:path,missing:name});return false;}));
  }
  const done=new Set(),active=new Set();async function sign(path){if(done.has(path))return;if(active.has(path))throw Error('Catálogo de assinaturas com ciclo');active.add(path);const dir=path.slice(0,path.lastIndexOf('/')+1),names=catalogs.get(path);if(!names.length)throw Error('Arquivo não encontrado para assinar: '+path);for(const n of names)if(n.endsWith('.vsc'))await sign(dir+n);const bytes=await create(names.map(name=>({name,bytes:work.get(dir+name)})),provider);work.set(path,bytes);active.delete(path);done.add(path);}
  for(const path of catalogs.keys())await sign(path);
  return {files:work,paths:[...done].sort(),omitted};
 }
 async function verifyAll(p){if(!p.inputSignatures)return {verified:0};if(p.inputSignatures.profile!=='emulator-p521-entity/1'||!Array.isArray(p.inputSignatures.paths)||p.inputSignatures.paths.length>2000)throw Error('Perfil de assinatura de entrada não suportado');const files=new Map(p.files.map(f=>[f.path,F.unbase64(f.data)]));let count=0;const seen=new Set();for(const path of p.inputSignatures.paths){if(seen.has(path)||!files.has(path)||!path.endsWith('.vsc'))throw Error('Caminho inválido no catálogo de assinaturas');seen.add(path);const dir=path.slice(0,path.lastIndexOf('/')+1),local=new Map([...files].filter(([p])=>p.startsWith(dir)).map(([p,b])=>[p.slice(dir.length),b]));const result=await verify(files.get(path),local);if(p.signature&&result.spki!==p.signature.spki)throw Error('Os arquivos de entrada foram assinados por outra identidade, não a que assinou a mídia');count++;}return {verified:count};}
 // Files of a package not listed in any of its .vsc catalogs. serialv.dat never had a catalog.
 function uncovered(p){const files=new Map(p.files.map(f=>[f.path,F.unbase64(f.data)])),covered=new Set();
  for(const [path,bytes] of files){if(!path.endsWith('.vsc')||!bytes.length)continue;const n=F.parse(bytes);if(n.children?.[3]?.tag!==4)continue;const dir=path.slice(0,path.lastIndexOf('/')+1);
   for(const entry of F.parse(F.unhex(n.children[3].hex)).children?.[0]?.children??[])covered.add(dir+entry.children[0].text);}
  return [...files.keys()].filter(path=>!path.endsWith('.vsc')&&path!=='/dsk/fi/serialv.dat'&&!covered.has(path));}
 return {create,verify,resign,verifyAll,uncovered};
})();
