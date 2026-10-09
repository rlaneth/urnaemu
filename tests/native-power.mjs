// Uses an already-open, visible Chrome. Exercise the controls and real canvas.
import {connect,evidencePath} from '../tools/screen-session.mjs';
import fs from 'node:fs';
const browser=await connect();
try {
 await browser.load();
 await browser.evaluate("urnaEmu.experiments.start('zeresima')");
 const results=await browser.evaluate(`(async()=>{
  const results=[];
  for(const [source,level] of [['mains','full'],['battery','full'],['battery','partial'],['battery','critical'],['mains','full']]){
   const previous=urnaEmu.power.state.refreshes;
   urnaEmu.setPower({source,level});
   for(let i=0;i<200&&urnaEmu.power.state.refreshes===previous;i++)await new Promise(r=>setTimeout(r,10));
   if(urnaEmu.power.state.refreshes===previous)throw Error('Power control did not complete');
   await new Promise(r=>setTimeout(r,80));
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const image=document.querySelector('[data-testid=terminal-battery] img');await image.decode();
   const canvas=document.getElementById('uenux-screen');
   const pixels=canvas.getContext('2d').getImageData(canvas.width-160,0,160,80).data;
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const state={...urnaEmu.power.state};
   if(state.source!==source||state.level!==level||!state.widgets)throw Error('Native power state did not follow controls');
   if(image.naturalHeight<=image.naturalWidth)throw Error('Terminal battery artwork is not vertical');
   results.push({source,level,state,canvasBatteryHash:digest,terminalImage:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight});
  }
  return results;
 })()`);
 if(new Set(results.slice(0,4).map(x=>x.canvasBatteryHash)).size!==4)throw Error('Native battery graphics did not change for each tested state');
 if(results[0].canvasBatteryHash!==results[4].canvasBatteryHash)throw Error('Returning to mains/full did not restore the native icon');
 if(new Set(results.slice(0,4).map(x=>x.terminalImage)).size!==4)throw Error('Terminal icon did not follow the native states');
 fs.writeFileSync(evidencePath('native-power.json'),JSON.stringify({testedAt:new Date().toISOString(),results},null,2)+'\n');
 await browser.evaluate(`(async()=>{await urnaEmu.setPower({source:'battery',level:'partial'})})()`);
 await browser.capture('native-power-shared-partial',{purpose:'Native urna and terminal share partial battery state'});
 console.log('PASS: native canvas and vertical terminal icons follow shared controls; four distinct states and restoration verified.');
} finally {browser.close();}
