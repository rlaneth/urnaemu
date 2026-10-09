// Populate only the original simulator's absent GAP load-history collection.
// Call after MEMFS packages load, before votaInit caches GAP. No vendor edits.
export const provisionNativeGapHistory = function(options={}) {
  const fs=globalThis.Module.FS;
  const section=options.section||{municipality:1,zone:1,section:1};
  for(const [key,max,min] of [['municipality',99999,1],['zone',9999,1],['section',9999,0]])
    if(!Number.isInteger(section[key])||section[key]<min||section[key]>max)throw Error('Invalid synthetic GAP section '+key);
  const code=options.loadCode||'000000000000000000001';
  if(!/^\d{21}$/.test(code))throw Error('Test load code must contain 21 decimal digits');
  const timestamp=options.timestamp||'20261006T120000';
  if(!/^\d{8}T\d{6}$/.test(timestamp))throw Error('Invalid synthetic GAP timestamp');
  const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out};
  const len=n=>n<128?[n]:n<256?[0x81,n]:n<65536?[0x82,n>>8,n&255]:(()=>{throw Error('GAP fixture too large')})();
  const tlv=(tag,data)=>concat([new Uint8Array([tag,...len(data.length)]),data]);
  const seq=(...parts)=>tlv(0x30,concat(parts));
  const text=s=>tlv(0x1b,new TextEncoder().encode(s));
  const integer=n=>{const bytes=[];do{bytes.unshift(n&255);n>>>=8}while(n);if(bytes[0]&128)bytes.unshift(0);return tlv(2,new Uint8Array(bytes))};
  function read(bytes,start=0){if(start+2>bytes.length)throw Error('Truncated GAP BER');let at=start+1,n=bytes[at++];if(n&128){const width=n&127;if(!width||width>3||at+width>bytes.length)throw Error('Unsupported GAP BER length');n=0;for(let i=0;i<width;i++)n=n*256+bytes[at++]}if(at+n>bytes.length)throw Error('Invalid GAP BER bounds');return {tag:bytes[start],start,content:at,end:at+n,length:n}}
  const record=seq(
    seq(integer(1),tlv(4,new Uint8Array([0,0,0,1])),seq(text('SIMULATED'),text('TEST ONLY'),text('VOTA EMULATOR')),text(timestamp),text(code)),
    seq(integer(section.municipality),integer(section.zone),integer(section.section)),
    tlv(4,new Uint8Array())
  );
  const paths=options.paths||['/dsk/fi/dinamico/trab1/gap.bin','/dsk/fe/dinamico/trab1/gap.bin'];
  const plan=[];
  for(const path of paths){
    if(!fs.analyzePath(path).exists)continue;
    const bytes=fs.readFile(path),outer=read(bytes),history=read(bytes,outer.content);
    if(outer.tag!==0x30||outer.end!==bytes.length||history.tag!==0x30||history.end>outer.end)throw Error('Unexpected GAP BER envelope');
    if(history.length){plan.push({path,skip:true});continue}
    const updated=tlv(0x30,concat([seq(record),bytes.slice(history.end,outer.end)]));
    plan.push({path,bytes:updated,beforeBytes:bytes.length});
  }
  if(!plan.length)throw Error('No initialized MEMFS GAP files found');
  const changes=[];
  for(const item of plan){if(item.skip){changes.push({path:item.path,changed:false,reason:'Existing history preserved'});continue}fs.writeFile(item.path,item.bytes);changes.push({path:item.path,changed:true,beforeBytes:item.beforeBytes,afterBytes:item.bytes.length})}
  return {simulated:true,loadCode:code,timestamp,section:{...section},identity:'SIMULATED / TEST ONLY / VOTA EMULATOR',changes};
};

// Install before votaInit: the original bridge creates GAP files during init,
// so overlay each empty history immediately before its first native read.
export const installNativeTestGap = function(options={}) {
  const fs=globalThis.Module.FS, original=fs.open;
  const config=options.config||options;
  const section={municipality:Number(config.municipio??config.municipality),zone:Number(config.zona??config.zone),section:Number(config.secao??config.section)};
  for(const [key,max,min] of [['municipality',99999,1],['zone',9999,1],['section',9999,0]])
    if(!Number.isInteger(section[key])||section[key]<min||section[key]>max)throw Error('Native test GAP requires configured municipality, zone, and section');
  const state={simulated:true,installed:true,section:{...section},changes:[],errors:[]};
  const seen=new Set();let busy=false;
  function wrapped(path,flags,...args){
    const readable=typeof flags==='string'?flags==='r'||flags==='rb':Number.isInteger(flags)&&(flags&3)===0;
    if(!busy&&readable&&typeof path==='string'&&/^\/dsk\/(fi|fe)\/dinamico\/trab[12]\/gap\.bin$/.test(path)&&!seen.has(path)){
      busy=true;
      try{
        if(fs.analyzePath(path).exists){
          const result=provisionNativeGapHistory({section,paths:[path],loadCode:options.loadCode,timestamp:options.timestamp});
          state.changes.push(...result.changes);seen.add(path);
        }
      }catch(error){state.errors.push(String(error));throw error}
      finally{busy=false}
    }
    return original.call(this,path,flags,...args);
  }
  fs.open=wrapped;
  return {state,restore(){if(fs.open!==wrapped)throw Error('Cannot restore GAP hook after another FS.open replacement');fs.open=original;state.installed=false}};
};
