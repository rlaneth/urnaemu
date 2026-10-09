// Visible-browser integration: real native zerésima, no synthetic print fixture.
import {connect,evidencePath} from '../tools/screen-session.mjs';
import fs from 'node:fs';
const b=await connect();
try {
 await b.load();await b.evaluate('(async()=>{if(!urnaEmu.loadEditor.provider)await urnaEmu.loadEditor.useKey();return urnaEmu.loadEditor.generateOfficial()})()');
 await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');await b.delay(1000);await b.ready();
 await b.evaluate(`(async()=>{
  while(!urnaEmu.session.enabled)await new Promise(r=>setTimeout(r,50));
  urnaEmu.printer.setSpeed(1); // a saved preference may be faster; this test measures the real-speed feed
  await urnaEmu.press('C');
  for(let i=0;i<13;i++){
   const v=new DataView(urnaEmu.exports.Cb.buffer),p=urnaEmu.experiments.state.active;
   if(v.getUint32(p,true)!==1547140)throw Error('Expected keyboard test');
   const a=v.getUint32(p+48,true)+v.getUint32(p+60,true)*12,l=v.getUint8(a+11),ptr=l&128?v.getUint32(a,true):a,n=l&128?v.getUint32(a+4,true):l;
   const label=new TextDecoder().decode(new Uint8Array(v.buffer,ptr,n));await urnaEmu.press(({BRANCO:'B',CORRIGE:'D',CONFIRMA:'C'})[label]||label);
  }
  window.feedTest={start:performance.now(),done:false};
  (async()=>{await urnaEmu.press('C');if(urnaEmu.session.booting)await urnaEmu.press('C')})().then(()=>{feedTest.done=true;feedTest.elapsed=performance.now()-feedTest.start},e=>feedTest.error=String(e));
 })()`);
 await b.delay(1200);
 const during=await b.evaluate(`({done:feedTest.done,pending:urnaEmu.printer.pending,lines:document.querySelectorAll('.paper-line').length,total:urnaEmu.paperCapture.state.operations.filter(o=>o.kind==='text'||o.kind==='newline').length,status:document.querySelector('[data-testid=printer]').dataset.status})`);
 if(during.done||during.pending<=0||during.lines>=during.total)throw Error('Paper was not progressively fed: '+JSON.stringify(during));
 await b.evaluate('document.querySelector("[data-testid=printer]").scrollIntoView({block:"center"})');
 for(let i=0;i<180;i++){const s=await b.evaluate('feedTest');if(s.error)throw Error(s.error);if(s.done)break;await b.delay(500)}
 const result=await b.evaluate(`({...feedTest,pending:urnaEmu.printer.pending,status:document.querySelector('[data-testid=printer]').dataset.status,textMatches:urnaEmu.paperCapture.state.operations.filter(o=>o.kind==='text').map(o=>o.text).join('\\n')===[...document.querySelectorAll('.paper-line span')].map(e=>e.textContent).join('\\n'),terminal:urnaEmu.terminalText})`);
 if(!result.done||result.pending||!result.textMatches||result.elapsed<2000)throw Error(JSON.stringify(result));
 fs.writeFileSync(evidencePath('printer-feed.json'),JSON.stringify({testedAt:new Date().toISOString(),during,...result},null,2)+'\n');console.log({during,...result});
}finally{b.close()}
