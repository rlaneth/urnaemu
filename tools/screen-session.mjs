// Attach only to an already-open, visible Chrome. Never launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { QA_PAGE } from './qa-page.mjs';

/** Test evidence goes to the OS temp directory, never into the project tree. */
export function evidencePath(name){const target=path.join(os.tmpdir(),'urnaemu-evidence',name);fs.mkdirSync(path.dirname(target),{recursive:true});return target}
export async function connect({evaluationTimeoutMs=45000}={}) {
 const port=process.env.CDP_PORT||9224,base=process.env.EMULATOR_URL||'http://127.0.0.1:8766/urnaemu/';
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const tab=tabs.find(t=>t.type==='page'&&t.url.startsWith(base)&&new URL(t.url).pathname===new URL(base).pathname);if(!tab)throw Error('Open UrnaEmu in the test Chrome first');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Timeout: ${method}`))},method==='Runtime.evaluate'?evaluationTimeoutMs:45000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(){for(let i=0;i<400;i++){try{if(await evaluate('window.urnaEmu?.initialized===true'))return}catch{}await delay(100)}throw Error('Runtime initialization timeout')}
 async function load(scenario='municipal-t1',voice=false){await call('Page.navigate',{url:`${base}?scenario=${scenario}&voice=${voice?1:0}`});await ready()}
 /**
  * Open a full session the way a user would and leave the engine running.
  * Training: session URL with the given flags and a running clock pinned on election day.
  * Official: generated official media, applied through the load editor.
  * With boot (default), qa.boot() passes the keyboard test and zerésima, ending at the
  * operator handoff. window.qa (tools/qa-page.mjs) stays available for further steps.
  */
 async function session({scenario='municipal-t1',official=false,flags={},time='09:00',speed='instant',boot=true}={}){
  if(official){
   await load(scenario);await evaluate('(async()=>{if(!urnaEmu.loadEditor.provider)await urnaEmu.loadEditor.useKey();return urnaEmu.loadEditor.generateOfficial()})()');
   await evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');await delay(1000);await ready();
  }else{
   const f={testgap:1,persist:1,crypto:1,testkey:1,...flags},query=Object.entries(f).filter(([,v])=>v).map(([k])=>`&${k}=1`).join('');
   await call('Page.navigate',{url:`${base}?scenario=${scenario}&session=1${query}`});await ready();
   // The clock applies from boot: set it and reload once. A clock after 17:00 ends voting.
   const reloaded=await evaluate(`(()=>{const p=urnaEmu.clock.electionDayPreset(),iso=new Date(p.local.replace('T08:00:00','T${time}:00')).toISOString();if(urnaEmu.clock.settings.mode==='running'&&Math.abs(Date.parse(urnaEmu.clock.settings.iso)-Date.parse(iso))<60000)return false;urnaEmu.clock.configure({mode:'running',iso});location.reload();return true})()`).catch(()=>true);
   if(reloaded){await delay(800);await ready()}
  }
  await evaluate(QA_PAGE);await evaluate(`urnaEmu.printer.setSpeed(${JSON.stringify(speed)})`);
  if(boot)await evaluate('qa.boot()');
 }
 async function capture(slug,recipe={}){
  if(!/^[a-z0-9-]+$/.test(slug))throw Error('Invalid screenshot slug');
  const dir=path.resolve(process.env.SCREENSHOT_DIR||path.join(os.tmpdir(),'urnaemu-screenshots'));fs.mkdirSync(dir,{recursive:true});
  await evaluate("document.getElementById('uenux-screen').scrollIntoView({block:'center'})");await delay(300);
  const data=await evaluate(`(async()=>{const c=document.getElementById('uenux-screen'),r=c.getBoundingClientRect();return {url:location.href,capturedAt:new Date().toISOString(),state:await urnaEmu.readState(),nativeCanvas:{width:c.width,height:c.height},canvasPng:c.toDataURL('image/png'),experimental:urnaEmu.experiments?.state,mesarioText:document.getElementById('mt')?.textContent||'',terminalText:urnaEmu.terminalText||'',clip:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1},logs:urnaEmu.logs.slice(-15)}})()`);
  fs.writeFileSync(path.join(dir,slug+'.png'),Buffer.from(data.canvasPng.split(',')[1],'base64'));
  delete data.canvasPng;
  fs.writeFileSync(path.join(dir,slug+'.json'),JSON.stringify({...data,recipe},null,2)+'\n');console.log('Captured '+slug);
  if(data.mesarioText.trim()){
   const clip=await evaluate(`(()=>{const e=document.querySelector('[data-testid=terminal]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);
   if(clip.width>0&&clip.height>0){const terminal=await call('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});fs.writeFileSync(path.join(dir,slug+'-terminal.png'),Buffer.from(terminal.data,'base64'));fs.writeFileSync(path.join(dir,slug+'-terminal.json'),JSON.stringify({...data,recipe:{...recipe,display:'poll-worker terminal'}},null,2)+'\n');}
   await evaluate("document.getElementById('uenux-screen').scrollIntoView({block:'center'})");
  }
  return data;
 }
 // Always test the current local sources, including scripts updated during development.
 await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 return {call,evaluate,delay,ready,load,session,capture,close:()=>ws.close()};
}
