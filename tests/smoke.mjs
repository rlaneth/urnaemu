// Every bundled scenario initializes; MEMFS, native calls and voice data work.
// Requires Node >=22 and a Chrome with UrnaEmu open (CDP_PORT, default 9224).
import {writeFile} from 'node:fs/promises';
import {evidencePath} from '../tools/screen-session.mjs';
const port=process.env.CDP_PORT||9224,base=process.env.EMULATOR_URL||'http://127.0.0.1:8766/urnaemu/';
const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target=tabs.find(t=>t.type==='page'&&t.url.startsWith(base));if(!target)throw Error('Open the emulator in the isolated test browser first');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`Timeout ${method}`));},65000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function ready(){const deadline=Date.now()+65000;while(Date.now()<deadline){try{if(await evaluate('window.urnaEmu?.initialized===true'))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Initialization timeout');}
const results=[];
try{
 for(const scenario of ['geral-t1','geral-t2','geral-df-t1','geral-df-t2','geral-zz-t1','geral-zz-t2','municipal-t1','municipal-t2']){
 await send('Page.navigate',{url:`${base}?scenario=${scenario}`});await ready();
 const result=await evaluate(`(async()=>{await urnaEmu.tick();const state=await urnaEmu.readState();const fs=Module.FS;fs.writeFile('/tmp/workbench-smoke.txt','local test');if(fs.readFile('/tmp/workbench-smoke.txt',{encoding:'utf8'})!=='local test')throw Error('FS mismatch');const listing=await urnaEmu.browse('/tmp/workbench-smoke.txt');if(listing.kind!=='file'||listing.size!==10)throw Error('Browse mismatch');const memory=urnaEmu.dev.readMemory(0,256);const htons=await urnaEmu.dev.callNative('export','Pb',[4660]);await urnaEmu.readState();if(String(htons)!=='13330')throw Error('Native htons mismatch');Module.uenuxDebug=true;await urnaEmu.press('D');await new Promise(r=>setTimeout(r,100));Module.uenuxDebug=false;return {scenario:${JSON.stringify(scenario)},initialized:state.initialized,cargo:state.cargo?.name,fs:true,nativeCall:true,memoryPreview:memory.length>0,tableSlots:urnaEmu.tableMetadata.length,logErrors:urnaEmu.logs.filter(x=>x.includes('[error]'))};})()`);
 if(!result.initialized||result.logErrors.length)throw Error(JSON.stringify(result));results.push(result);console.log(`${scenario}: passed`);
 }
 await send('Page.navigate',{url:`${base}?scenario=municipal-t1&voice=1`});await ready();results.push(await evaluate(`(async()=>{const state=await urnaEmu.readState();return {scenario:'municipal-t1-voice',initialized:state.initialized,audioEleitorHabilitado:state.audioEleitorHabilitado,voiceData:Module.FS.stat('/share/RHVoice/voices/Leticia-F123/16000/voice.data').size};})()`));
 await send('Page.navigate',{url:`${base}?scenario=municipal-t1`});await ready();
 await writeFile(evidencePath('smoke.json'),JSON.stringify({testedAt:new Date().toISOString(),browser:'Chrome CDP',results},null,2)+'\n');
 console.log('All scenarios and voice initialization passed.');
}finally{ws.close();}
