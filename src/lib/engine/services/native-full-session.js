// The browser bridge posts an unconditional enable-voter event (func11026, table slot 57)
// during votaInit: the TSE simulator's voting-only mode starts with the urna unlocked. Any
// session with a poll-worker terminal must let the operator authorize voters instead;
// otherwise the first voter is enabled behind the operator's back, and the ballot can never
// be synchronized ("Gravando" forever).
export function installNoAutoVoter(app,events=[]){
 if(app.noAutoVoter)return;
 const table=app.exports.Fb;
 if(app.tableMetadata.find(x=>x.slot===57)?.functionIndex!==11026)throw Error('Unexpected auto-voter ABI');
 const original=table.get(57);
 hookSlot(table,57,1,(object)=>{
  if(!app.initialized){events.push({method:'omit-web-auto-voter',object});return;}
  return original(object);
 });
 app.noAutoVoter={events};
}
// Speech in sessions. votaInit initializes the RHVoice synthesizer (table 42 → func11264,
// "/etc/RHVoice") only when the bridge flag audioEleitorHabilitado is set, and with the same flag
// makes every voter start with audio (IExecucaoVota::GetInst(), table 54, then table 55 →
// func11100). Sessions set the flag so the synthesizer exists, and skip only that second step
// during votaInit: voters start without audio until the mesário enables it on the terminal.
export function installSessionVoice(app,events=[]){
 if(app.sessionVoice)return;
 const table=app.exports.Fb;
 if(app.tableMetadata.find(x=>x.slot===55)?.functionIndex!==11100)throw Error('Unexpected voter-audio ABI');
 const original=table.get(55);
 hookSlot(table,55,1,(value)=>{
  if(!app.initialized){events.push({method:'omit-all-voters-audio',value});return;}
  return original(value);
 });
 app.sessionVoice={events};
}
function hookSlot(table,slot,arity,callback){
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 const section=(id,a)=>[id,...leb(a.length),...a];
 const body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];
 const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),0]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);
 table.set(slot,new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:callback}}).exports.f);
}

// Experimental initialization route, installed before the bridge's votaInit.
// Preserve the selected election phase and initialize native voter attendance.
export const installNativeFullSession = function(app){
 if(app.fullSession)return;
 const table=app.exports.Fb,view=()=>new DataView(app.exports.Cb.buffer);
 const state={experimental:true,configured:false,dynamicLoaded:false,events:[],metadataFixtures:[]};
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 const section=(id,a)=>[id,...leb(a.length),...a];
 function hook(slot,arity,callback){
  const original=table.get(slot),body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];
  const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),0]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);
  table.set(slot,new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{f:(...args)=>callback(original,...args)}}).exports.f);
 }
 for(const [slot,index] of [[57,11026],[51,11266],[39,7787],[41,6737],[1800,11865],[33,185],[50,261]])if(app.tableMetadata.find(x=>x.slot===slot)?.functionIndex!==index)throw Error('Unexpected full-session initialization ABI');
 // The web votaInit forcibly marks the section as already voting (ASCII '8').
 // A full boot must retain the state produced by native DynamicCreate instead.
 hook(51,2,(original,object,status)=>{
  if(!app.initialized&&state.dynamicLoaded&&object===state.attendanceObject&&status===0x38){state.events.push({method:'omit-web-voting-shortcut',requested:status,preserved:view().getUint32(object,true)});return;}
  return original(object,status);
 });
 installNoAutoVoter(app,state.events);
 hook(41,1,(original,context)=>{
  if(state.configured||state.dynamicLoaded)throw Error('Full session initialization requires a fresh runtime');
  const object=table.get(50)(table.get(33)(),0x33),v=view(),status=v.getUint32(object,true),flag=v.getUint8(object+72);
  if(![0x31,0x32].includes(status)||flag!==1||v.getUint8(context+1)!==0)throw Error('Unexpected initial application mode '+status+'/'+flag+'/'+v.getUint8(context+1));
  state.attendanceObject=object;v.setUint8(object+72,0);state.configured=true;state.events.push({method:'configure-attendance',object,status,previous:flag,current:0});
  // An empty archive directory means no rotated logs, not a fabricated log.
  Module.FS.mkdirTree('/dsk/fi/dinamico/log/arquivados');
  for(const medium of ['fi','fe'])for(const area of ['res1','res2'])Module.FS.mkdirTree('/dsk/'+medium+'/dinamico/'+area);
  // Both bundled properties files are empty. The original result writer checks
  // this exact contract build tag (func12098). Supply runtime-only test metadata;
  // this does not establish compatibility with a physical urna's contracts.
  const resultModules=['ModuloBoletimUrna','ModuloRegistroDigitalVoto','ModuloResultadoUrnaCadastro','ModuloEnvelopeGenerico','ModuloAssinaturaEcourna','ModuloHashes','ModuloVersaoArquivos'];
  for(const path of ['/etc/dependencias.properties','/etc/versoes.properties']){
   if(Module.FS.readFile(path).length!==0)throw Error('Refusing to replace nonempty contract metadata');
   const dependencyFile=path.includes('dependencias');
   // Unknown internal module graph/versions are deliberately test fixtures.
   // They allow codec execution, but cannot attest physical-urna compatibility.
   Module.FS.writeFile(path,'tag=20260601173148\n'+resultModules.map(name=>name+'='+(dependencyFile?'':'emulator-unknown')).join('\n')+'\n');
   state.metadataFixtures.push({path,synthetic:true,tag:'20260601173148',source:'func12098 embedded tag; result module names from native type inventory',moduleValues:dependencyFile?'empty test dependency graph':'emulator-unknown',physicalCompatibilityVerified:false});
  }
  // This original StartState performs DynamicCreate AND CompleteLoad, followed
  // by its own native state transition. No attendance counters are synthesized.
  const scratch=table.get(5)(12);new Uint8Array(app.exports.Cb.buffer,scratch,12).fill(0);
  try{table.get(1800)(scratch);state.dynamicLoaded=true;state.events.push({method:'native-dynamic-create-and-load',context,status:view().getUint32(object,true)});}
  finally{const free=app.tableMetadata.find(x=>x.functionIndex===136);table.get(free.slot)(scratch)}
 });
 function installMedia(){
  if(state.resultMedia)return;
  const v=view(),get=p=>v.getUint32(p,true),registry=table.get(284)();let object;
  for(let p=get(registry);p<get(registry+4);p+=24){const long=v.getUint8(p+11)&128,a=long?get(p):p,n=long?get(p+4):v.getUint8(p+11);if(new TextDecoder().decode(new Uint8Array(v.buffer,a,n))==='N5comum14IInterfaceInitE')object=get(p+16);}
  if(!object||get(get(object)+20)!==540||app.tableMetadata.find(x=>x.slot===540)?.functionIndex!==9405)throw Error('Unexpected result media control ABI');
  Module.FS.mkdirTree('/dsk/mr');
  state.resultMedia={simulated:true,path:'/dsk/mr',present:true,presenceQueries:0};
  hook(540,3,(original,out,self,command)=>{
   if(self!==object||(command&65535)!==0x12)return original(out,self,command);
   const present=state.resultMedia.present,data=table.get(5)(4),m=view();
   m.setUint32(data,present?0:1,true);m.setUint32(out,data,true);m.setUint32(out+4,data+4,true);m.setUint32(out+8,data+4,true);
   state.resultMedia.presenceQueries++;
  });
 }
 function setMediaPresent(present){
  if(!state.resultMedia)throw Error('Result-media service not installed');
  state.resultMedia.present=!!present;
  app.log?.('simulated-result-media',{present:!!present,path:'/dsk/mr',bytesPreserved:true});
  return state.resultMedia;
 }
 app.fullSession={state,installMedia,setMediaPresent};
};
