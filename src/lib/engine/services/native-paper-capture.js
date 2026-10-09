// Implement the browser report printer at the original IPaperRelatorios boundary.
// Native report contents use a host-defined spool shared with our replay consumer.
import { VotaPrinterSpool } from './printer-spool.js';
export const installNativePaperCapture = async function(app) {
  if(app.paperCapture) return app.paperCapture;
  if(!app.native?.transaction)throw Error('Paper capture requires the serialized native runtime');
  return app.native.transaction(()=>{
    if(app.paperCapture)return app.paperCapture;
    const table=app.exports.Fb,heap=()=>new Uint8Array(app.exports.Cb.buffer),view=()=>new DataView(app.exports.Cb.buffer);
    const check=(p,n)=>{if(!Number.isInteger(p)||!Number.isInteger(n)||p<1024||n<0||p+n>view().byteLength)throw Error('Invalid paper capture ABI range')};
    const get=p=>{check(p,4);return view().getUint32(p,true)};
    const decode=b=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{return new TextDecoder('windows-1252').decode(b)}};
    function stringBytes(p){check(p,12);const long=heap()[p+11]&128,a=long?get(p):p,n=long?get(p+4):heap()[p+11];if(n>1024*1024||(!long&&n>10))throw Error('Invalid paper string');check(a,n);return heap().slice(a,a+n)}
    const registry=table.get(284)(),begin=get(registry),end=get(registry+4),cap=get(registry+8);
    check(begin,end-begin);if((end-begin)%24||end>cap||cap>view().byteLength||end-begin>24*4096)throw Error('Unexpected singleton registry');
    const matches=[];for(let row=begin;row<end;row+=24)if(decode(stringBytes(row))==='N3api16IPaperRelatoriosE')matches.push(get(row+16));
    if(matches.length!==1)throw Error('Expected exactly one report paper service');
    const object=matches[0],vtable=0x175acc;
    if(get(object)!==vtable)throw Error('Paper service is not the verified CWasmNullPaper');
    const definitions=[
      [8,711,1528,3,'text'],[12,712,218,1,'cut'],[16,713,218,1,'newline'],
      [20,714,425,2,'begin'],[24,715,218,1,'end'],
      [28,716,8372,5,'replay'],[32,717,8371,6,'replay-with-header'],
      [40,719,218,1,'operation-unknown'],[44,720,1870,4,'operation-unknown'],[48,721,1870,4,'qr']
    ];
    for(const [offset,slot,index,arity] of definitions){const meta=app.tableMetadata.find(x=>x.slot===slot);if(get(vtable+offset)!==slot||!meta||meta.functionIndex!==index||meta.result!=='nil'||meta.params.length!==arity||meta.params.some(t=>t!=='i32'))throw Error(`Unexpected paper method ABI at ${offset}`)}
    const alloc=table.get(5),freeSlot=app.tableMetadata.find(x=>x.functionIndex===136)?.slot;
    if(freeSlot===undefined)throw Error('Native free unavailable');const free=table.get(freeSlot);
    const state={enabled:true,object,vtable,nativeSpoolCompatible:false,nativeFilesWritten:false,spoolFormat:'vota-emulator-printer-spool-v1',spools:[],replays:[],operations:[],captures:[],active:null};
    let api,notifyQueued=false;
    function notify(){if(notifyQueued)return;notifyQueued=true;queueMicrotask(()=>{notifyQueued=false;try{api?.onUpdate?.(state)}catch(error){app.log?.('paper-preview-error',String(error))}})}
    function record(kind,fields={}){if(state.operations.length>=20000)throw Error('Paper capture operation limit reached');const op={index:state.operations.length,kind,capture:state.active,...fields};state.operations.push(op);notify();return op}
    function readText(textObject){check(textObject,4);const slot=get(get(textObject)+8),meta=app.tableMetadata.find(x=>x.slot===slot);if(!meta||meta.result!=='nil'||meta.params.join(',')!=='i32,i32')throw Error('Unexpected native IText getter ABI');const out=alloc(12);check(out,12);heap().fill(0,out,out+12);try{table.get(slot)(out,textObject);const bytes=stringBytes(out),attributeSlot=get(get(textObject)+12),attributeMeta=app.tableMetadata.find(x=>x.slot===attributeSlot);if(!attributeMeta||attributeMeta.result!=='i32'||attributeMeta.params.join(',')!=='i32')throw Error('Unexpected native IText attribute ABI');return {text:decode(bytes),bytes:Array.from(bytes),textAttribute:table.get(attributeSlot)(textObject)}}finally{if(heap()[out+11]&128)free(get(out));free(out)}}
    async function observeAsync(offset,kind,args){
      if(kind==='end'){
        const active=state.active;
        if(active===null)throw Error('Native paper capture ended without begin');
        const capture=state.captures[active],path=capture.requestedNativePath;
        if(!/^\/dsk\/(fi|fe)\/dinamico\/trab[12]\/[^/]+\.dat$/.test(path))throw Error('Unverified spool destination '+path);
        const bytes=VotaPrinterSpool.encode(state.operations.slice(capture.begin+1).filter(o=>o.capture===active));
        const provider=app.pkcs11?.provider;if(!provider)throw Error('Browser spool signing requires the synthetic test identity');
        const signature=await VotaPrinterSpool.sign(bytes,provider);
        if(app.native.state.cancelled)throw Error('Spool signing cancelled');
        Module.FS.writeFile(path,bytes);Module.FS.writeFile(path.replace(/\.dat$/,'.vsu'),signature);state.nativeFilesWritten=true;
        state.spools.push({path,bytes:bytes.length,capture:active,format:state.spoolFormat,physicalPrinterCompatible:false});
        record(kind);capture.end=state.operations.length;state.active=null;notify();await api?.waitForPaper?.();
      }
      else if(kind==='replay'||kind==='replay-with-header'){
        if(state.active!==null)throw Error('Cannot replay into an active report capture');
        const path=decode(stringBytes(args[1]));
        const bytes=Module.FS.readFile(path),provider=app.pkcs11?.provider;
        if(!provider)throw Error('Browser spool replay requires its test signing identity');
        await VotaPrinterSpool.verify(bytes,Module.FS.readFile(path.replace(/\.dat$/,'.vsu')),provider);
        if(app.native.state.cancelled)throw Error('Spool replay cancelled');
        const document=VotaPrinterSpool.decode(bytes);
        const replay={path,begin:state.operations.length,operations:document.operations.length};
        // Native caller supplies a shared paper form containing the copy heading.
        // Its original null method still releases the shared_ptr afterward.
        if(kind==='replay-with-header'){
          const form=get(args[3]);if(form){const slot=get(get(form)+8),meta=app.tableMetadata.find(x=>x.slot===slot);if(!meta||meta.result!=='nil'||meta.params.join(',')!=='i32')throw Error('Unexpected replay heading form');table.get(slot)(form);}
        }
        for(const op of document.operations)record(op.kind,{...op,replayedFrom:path});
        replay.end=state.operations.length;state.replays.push(replay);notify();await api?.waitForPaper?.();
      }
    }
    function observe(offset,kind,args){
      if(kind==='text')record(kind,{...readText(args[1]),style:args[2]});
      else if(kind==='begin'){const path=decode(stringBytes(args[1]));if(state.active!==null)throw Error('Nested native paper capture');state.active=state.captures.length;state.captures.push({id:state.active,requestedNativePath:path,begin:state.operations.length,end:null});record(kind,{requestedNativePath:path});}
      else if(kind==='qr'){
        check(args[1],12);const a=get(args[1]),b=get(args[1]+4),c=get(args[1]+8),width=args[2],scale=args[3];
        if(!Number.isInteger(width)||width<1||width>400||!Number.isInteger(scale)||scale<1||scale>4||b<a||c<b||c>view().byteLength||b-a!==Math.ceil(width*width/8))throw Error('Unexpected native packed QR image ABI');
        check(a,b-a);record(kind,{bytes:Array.from(heap().slice(a,b)),width,height:width,scale,encoding:'row-major-lsb-first-1-black',borderModules:2});
      }
      else record(kind,{offset,args:args.slice(1)});
    }
    const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};const section=(i,a)=>[i,...leb(a.length),...a];
    function thunk(arity,host,suspending=false){const body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];const binary=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),0]),...section(2,[1,1,104,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,102,0,1]),...section(10,[1,...leb(body.length),...body])]);return new WebAssembly.Instance(new WebAssembly.Module(binary),{h:{f:suspending?new WebAssembly.Suspending(host):host}}).exports.f}
    const hooks=[];
    try{for(const[offset,slot,,arity,kind]of definitions){const original=table.get(slot);const asynchronous=['end','replay','replay-with-header'].includes(kind);
      const handler=asynchronous?async(...args)=>{try{if(args[0]===object)await observeAsync(offset,kind,args)}finally{original(...args)}}:(...args)=>{try{if(args[0]===object)observe(offset,kind,args)}finally{original(...args)}};
      const wrapped=thunk(arity,handler,asynchronous);table.set(slot,wrapped);hooks.push({slot,original,wrapped});}}
    catch(error){for(const h of hooks)if(table.get(h.slot)===h.wrapped)table.set(h.slot,h.original);throw error}
    api={state,onUpdate:null,snapshot:()=>JSON.parse(JSON.stringify({format:'vota-host-paper-operations-v1',...state})),text:()=>state.operations.map(op=>op.kind==='text'?op.text+'\n':op.kind==='newline'?'\n':op.kind==='cut'?'\n--- CUT ---\n':'').join('')};
    app.paperCapture=api;app.log?.('native-paper-capture',{event:'observer-installed',object,nativeSpoolCompatible:false});return api;
  },'observe native paper operations');
};
