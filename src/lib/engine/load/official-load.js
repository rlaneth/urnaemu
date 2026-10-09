// Generates an emulator load for VOTA's native official phase. Fictional bundled
// election records are retained; original snapshots and the WASM are untouched.
import { VotaLoadFormat } from './load-format.js';
import { VotaLoadSignatures } from './load-signature.js';
export const generateOfficialLoad = async function(source,provider){
 const F=VotaLoadFormat;F.validatePackage(source);
 if(provider?.algorithm!=='P-521')throw Error('Escolha ou crie uma identidade de teste antes de gerar a mídia oficial');
 if(source.config.fase!=='te')throw Error('A mídia já está na fase oficial');
 const rename=s=>s.replace(/(^|\/)t(?=\d{5})/g,'$1o').replace(/infomidia-fv-(\d)-t\./g,'infomidia-fv-$1-o.').replace(/scueconf-t(\d)\./g,'scueconf-o$1.');
 const files=new Map(),changes=[],sources=[];let date,loadTimestamp;
 const process=source.files.find(f=>f.path.endsWith('-cp.dat'));if(!process)throw Error('Falta o arquivo do processo eleitoral (-cp.dat)');
 const cp=F.parse(F.unbase64(process.data));
 if(parseInt(cp.children?.[0]?.children?.[1]?.hex,16)!==source.config.pe)throw Error('O processo eleitoral da configuração difere do arquivo do processo');
 const expectedVoter='/dsk/fi/estatico/t'+String(source.config.pe).padStart(5,'0')+source.config.uf.toLowerCase()+String(source.config.municipio).padStart(5,'0')+String(source.config.zona).padStart(4,'0')+String(source.config.secao).padStart(4,'0')+'-el.dat';
 if(!source.files.some(f=>f.path===expectedVoter))throw Error('Falta o eleitorado da seção: '+expectedVoter);
 date=cp.children[source.config.turno===2?3:2]?.children?.[2]?.text;
 if(!/^\d{8}$/.test(date||''))throw Error('Formato de data da eleição não suportado no arquivo do processo');
 const local=new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T08:00:00`);
 if(!Number.isFinite(local.getTime())||local.getFullYear()!==Number(date.slice(0,4))||local.getMonth()+1!==Number(date.slice(4,6))||local.getDate()!==Number(date.slice(6,8)))throw Error('Data da eleição inválida');
 function packageId(n){const c=n.children;return n.tag===48&&c?.length===5&&c[0].tag===10&&c[1].tag===48&&c[1].children?.[1]?.tag===10&&c[2].tag===27&&c[3].tag===18&&c[4].tag===10;}
 function walk(n){if(n.text!==undefined)n.text=rename(n.text);if(packageId(n)){if(!['03','02'].includes(n.children[1].children[1].hex))throw Error('Fase inesperada em um pacote da mídia');n.children[1].children[1].hex='02';}n.children?.forEach(walk);}
 for(const f of source.files){const bytes=F.unbase64(f.data),path=rename(f.path);sources.push({path:f.path,sha256:await F.digest(bytes)});let output=bytes;
  if(f.path!=='/dsk/fi/serialv.dat'&&!f.path.endsWith('-rdj.dat')&&bytes.length){const n=F.parse(bytes);walk(n);
   if(f.path.endsWith('.vsc')){if(n.children?.[3]?.tag!==4)throw Error('Envelope de assinatura de entrada não suportado');const catalog=F.parse(F.unhex(n.children[3].hex));walk(catalog);n.children[3].hex=F.hex(F.encode(catalog));}
   if(/infomidia-fv-\d-t\.dat$/.test(f.path)){if(n.children?.[1]?.tag!==10||n.children[1].hex!=='03')throw Error('Fase inesperada nos metadados da mídia');n.children[1].hex='02';loadTimestamp=n.children[5]?.children?.[3]?.text;}
   if(f.path.endsWith('-cp.dat'))n.children[1].text=n.children[1].text.replace(/^Treinamento\s+/i,'')+' - EMULADOR';
   if(f.path.endsWith('-ce.dat')){if(n.children?.[5]?.tag!==2)throw Error('Campo de ano da eleição não suportado');n.children[5].hex=Number(date.slice(0,4)).toString(16).padStart(4,'0');}
   output=F.encode(n);
  }
  if(files.has(path))throw Error('Conversão gerou dois arquivos com o mesmo nome: '+path);files.set(path,output);
  if(path!==f.path||F.hex(output)!==F.hex(bytes))changes.push({from:f.path,to:path,bytesChanged:F.hex(output)!==F.hex(bytes)});
 }
 if(!/^\d{8}T\d{6}$/.test(loadTimestamp||'')||loadTimestamp.slice(0,8)>date)throw Error('A data de geração da mídia falta ou é posterior à eleição');
 const signed=await VotaLoadSignatures.resign(files,provider);
 const result={format:source.format,scenario:source.scenario,description:'Fictional emulator data for native official-phase execution; not a TSE-authenticated or bootable physical load.',config:{...source.config,fase:'of'},clock:{mode:'running',iso:local.toISOString()},generation:{profile:'vota-official-emulator/1',nativePhaseToken:'oficial',phaseEnum:2,electionDate:date,loadTimestamp,loadCode:'000000000000000000001',sourceFiles:sources,changes},inputSignatures:{profile:'emulator-p521-entity/1',paths:signed.paths,omitted:signed.omitted},files:[...signed.files].map(([path,b])=>({path,data:F.base64(b)}))};
 await F.signPackage(result,provider);await VotaLoadSignatures.verifyAll(result);return result;
};
