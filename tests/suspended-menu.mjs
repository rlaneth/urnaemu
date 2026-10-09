// Blocking native menu: urna keys reach the suspended call through the host queue; a terminal
// key pressed meanwhile stays on the terminal keypad and is dropped when the call returns.
import {connect,evidencePath} from '../tools/screen-session.mjs';
import fs from 'node:fs';
const browser=await connect();try{
 await browser.load('municipal-t1');
 const ready=await browser.evaluate(`(async()=>{await urnaEmu.experiments.start('zeresima');for(const key of 'CB5')await urnaEmu.press(key);window.menuCompletion=urnaEmu.press('C').then(()=>({done:true}),e=>({error:String(e)}));const limit=Date.now()+10000;while(!urnaEmu.native.state.suspended){if(Date.now()>limit)throw Error('Menu did not suspend');await new Promise(r=>setTimeout(r,10));}return {...urnaEmu.native.state};})()`);
 const screenshot=await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(evidencePath('suspended-menu.png'),Buffer.from(screenshot.data,'base64'));
 const result=await browser.evaluate(`(async()=>{const terminalKey=await urnaEmu.pressTerminal('D').then(()=>({queued:urnaEmu.dev.readKeyQueue().mesario}),e=>({error:String(e)}));await new Promise(r=>setTimeout(r,300));const stillSuspended=urnaEmu.native.state.suspended;const before=urnaEmu.native.state.calls;document.querySelector('[data-vota-key="D"]').click();const afterIngress=urnaEmu.native.state.calls;return {terminalKey,stillSuspended,before,afterIngress,completion:await window.menuCompletion,native:{...urnaEmu.native.state},queue:[...Module.uenuxKeys],state:urnaEmu.experiments.state};})()`);
 // A terminal key is queued on the terminal keypad, which the urna's menu never reads.
 if(result.terminalKey.error||!result.terminalKey.queued?.includes('D')||!result.stillSuspended||result.before!==result.afterIngress||!result.completion.done||result.native.maxActive!==1||result.queue.length)throw Error('Suspended input ownership or native return failed');
 fs.writeFileSync(evidencePath('suspended-menu.json'),JSON.stringify({testedAt:new Date().toISOString(),ready,...result},null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{browser.close();}
