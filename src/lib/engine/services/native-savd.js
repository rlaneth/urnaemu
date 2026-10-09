// Replace only the recovered CWasmSavd send/receive boundary. Other original
// success-only commands remain explicitly recorded as unverified web stubs.
import { createTestResultSignature } from './result-signature.js';
export const installNativeSavd = function(app){
 if(app.savd)return app.savd;
 const provider=app.pkcs11?.provider;if(provider?.algorithm!=='P-521')throw Error('SAVD test service requires P-521 identity');
 const table=app.exports.Fb,view=()=>new DataView(app.exports.Cb.buffer),get=p=>view().getUint32(p,true);
 for(const [slot,index] of [[310,425],[311,10949]])if(app.tableMetadata.find(x=>x.slot===slot)?.functionIndex!==index)throw Error('Unexpected SAVD ABI');
 const registry=table.get(284)();let object;
 for(let p=get(registry);p<get(registry+4);p+=24){const v=view(),long=v.getUint8(p+11)&128,a=long?get(p):p,n=long?get(p+4):v.getUint8(p+11);if(new TextDecoder().decode(new Uint8Array(v.buffer,a,n))==='N5comum14IInterfaceSavdE')object=get(p+16)}
 if(!object||get(object)!==1526688)throw Error('Original CWasmSavd not registered');
 const state={synthetic:true,profile:'P-521 test SW/HW sets; same laboratory key; schema model 15; no CEPESC',requests:[],unverifiedCommands:[],outputs:[],optionalAbsent:[],active:false};
 const suffixes={35:'bu.dat',37:'rdv.dat',39:'jufa.dat',43:'imgbu.dat',44:'imgze.dat',46:'hash.dat',48:'wsqbio.jez',49:'wsqman.jez',50:'wsqmes.jez',70:'mr.ver',60:'log.jez'};
 let header=null,payload=null,ids=[],identity=null;
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 const section=(id,a)=>[id,...leb(a.length),...a];
 function hook(slot,arity,callback){const original=WebAssembly.promising(table.get(slot)),body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];const binary=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),0]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);table.set(slot,new WebAssembly.Instance(new WebAssembly.Module(binary),{h:{f:new WebAssembly.Suspending((...a)=>callback(original,...a))}}).exports.f)}
 hook(310,2,async(original,self,input)=>{
  if(self!==object)return await original(self,input);
  const a=get(input),b=get(input+4),cap=get(input+8);if(a<1024||b<a||b>cap||cap>view().byteLength||b-a>1048576)throw Error('Invalid SAVD vector');
  const bytes=new Uint8Array(view().buffer,a,b-a).slice();
  if(!header){if(bytes.length!==8||bytes[0]!==254)throw Error('Invalid SAVD header');const v=new DataView(bytes.buffer);header={application:bytes[1],command:v.getUint16(2,true),size:v.getUint32(4,true)};if(header.size>1048576)throw Error('Oversized SAVD request');payload=header.size===0?new Uint8Array():null;}
  else{if(payload||bytes.length!==header.size)throw Error('SAVD payload mismatch');payload=bytes;}
 });
 async function finish(){
  if(!identity||!ids.length)throw Error('Incomplete result signing scope');
  const dir='/dsk/fi/dinamico/res'+(app.sessionConfig?.turno||1),all=Module.FS.readdir(dir),files=[];let prefix;
  for(const id of ids){const suffix=suffixes[id];if(!suffix)throw Error('Unknown result signing ID '+id);const matches=all.filter(n=>n.endsWith('-'+suffix)&&n.slice(6,21)===identity);
   if(matches.length===0&&[48,49,50].includes(id)){state.optionalAbsent.push(suffix);continue}
   if(matches.length!==1)throw Error('Missing/ambiguous SAVD result '+suffix+' in '+dir);
   const name=matches[0],p=name.slice(0,name.length-suffix.length);if(prefix&&prefix!==p)throw Error('Mixed result prefixes');prefix=p;files.push({name,bytes:Module.FS.readFile(dir+'/'+name).slice()});
  }
  const data=await createTestResultSignature(files,provider);if(app.native.state.cancelled)throw Error('SAVD signing cancelled');
  const path=dir+'/'+prefix+'vota.vsc';if(Module.FS.analyzePath(path).exists)throw Error('Refusing to replace signature container');
  Module.FS.writeFile(path,data);state.outputs.push({path,bytes:data.length,files:files.map(f=>f.name),hostGenerated:true});
  app.log?.('simulated-savd',{path,profile:state.profile,files:files.length});
 }
 hook(311,4,async(original,self,status,out,size)=>{
  if(self!==object)return await original(self,status,out,size);
  if(!header||!payload||size!==12)throw Error('Incomplete SAVD exchange');const h=header,p=payload;header=payload=null;
  state.requests.push({...h,payload:Array.from(p)});
  if(h.application!==1)throw Error('Unsupported SAVD application');
  if(h.command===0x1604){if(p.length!==2||p[0]!==254||p[1]>1)throw Error('Invalid SAVD scope');if(p[1]===0){if(state.active)throw Error('Nested SAVD scope');state.active=true;ids=[];identity=null;}else{if(!state.active)throw Error('No active SAVD scope');await finish();state.active=false;}}
  else if(h.command===0x404){if(!state.active||p.length!==16||p[0]!==254)throw Error('Invalid SAVD section identity');identity=new TextDecoder().decode(p.slice(1));if(!/^[a-z]{2}\d{13}$/.test(identity))throw Error('Invalid section identifier');}
  else if(h.command===0x80){if(!state.active||p.length!==3||p[0]!==254||p[1]!==61||!(p[2] in suffixes)||ids.includes(p[2]))throw Error('Invalid result signing request');ids.push(p[2]);}
  else if([0x42,0x2021].includes(h.command)){state.unverifiedCommands.push(h.command);}
  else throw Error('Unimplemented SAVD command 0x'+h.command.toString(16));
  // A success response is returned only after supported signing has completed.
  await original(self,status,out,size);
 });
 return app.savd={state};
};
