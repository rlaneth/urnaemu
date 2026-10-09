// Official session: simulated biometric registration of a mesário, then the terminal lamps
// through a voter's identification and ballot.
import {connect,evidencePath} from '../tools/screen-session.mjs';
import fs from 'node:fs';
const b=await connect({evaluationTimeoutMs:300000});
try {
 await b.session({scenario:'municipal-t1',official:true});
 const result=await b.evaluate(`(async()=>{
  for(const k of 'C010309782003C')await urnaEmu.pressTerminal(k);
  const read=()=>Array.from(Module.FS.readFile('/dsk/fi/dinamico/trab1/uenux.db'));
  const before=read();await urnaEmu.scanner.accept();
  if(urnaEmu.experiments.state.stopped)throw Error(urnaEmu.experiments.state.reason);
  const accepted=urnaEmu.terminalText;await urnaEmu.pressTerminal('C');
  const registered=urnaEmu.terminalText;
  if(!/Quantidade de mesários registrados:\\s+01/.test(registered))throw Error('Native count did not become 01: '+registered);
  const after=read();if(JSON.stringify(before)===JSON.stringify(after))throw Error('Native registration file unchanged');
  let rejected=false;try{await urnaEmu.native.transaction(()=>urnaEmu.fingerprint.accept(urnaEmu.experiments.state.active))}catch{rejected=true}
  if(!rejected||urnaEmu.fingerprint.state.acceptances.length!==1)throw Error('Out-of-state acceptance was not rejected');
  for(const k of 'DC')await urnaEmu.pressTerminal(k);
  for(let i=0;i<5;i++)await urnaEmu.tick();
  if(!urnaEmu.terminalText.includes('Digite o Título'))throw Error('Voting readiness not reached');
  // Lamps render from the per-frame store snapshot: let it flush first.
  const lights=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {busy:urnaEmu.terminalBusy,wait:(document.querySelector('[data-testid=lamp-aguarde]').dataset.lit==='true'),released:(document.querySelector('[data-testid=lamp-liberado]').dataset.lit==='true'),battery:(document.querySelector('[data-testid=lamp-bateria]').dataset.lit==='true'),text:urnaEmu.terminalText}};
  const free=await lights();if(free.busy||free.wait||!free.released||free.battery)throw Error('Wrong free-cabin lamps');
  for(const k of '010309782003CC1960CC')await urnaEmu.pressTerminal(k);
  for(let i=0;i<12&&!urnaEmu.session.voterEnabled;i++)await urnaEmu.tick();
  const occupied=await lights();if(!occupied.busy||!occupied.wait||occupied.released||occupied.battery)throw Error('Wrong occupied-cabin lamps');
  const settle=async()=>{for(let i=0;i<100;i++){await urnaEmu.tick();if(!(await urnaEmu.readState()).substate?.includes('CConfereVotoEmCargo'))return;await new Promise(r=>setTimeout(r,60))}throw Error('Vote did not settle')};
  for(let office=0;office<2;office++){await urnaEmu.press('B');await settle();await urnaEmu.press('C');await settle()}
  for(let i=0;i<35;i++){await urnaEmu.tick();await new Promise(r=>setTimeout(r,60))}
  const afterVote=await lights();if(afterVote.busy||afterVote.wait||!afterVote.released)throw Error('Lamps did not return to free');
  return {lamps:{free,occupied,afterVote},accepted,registered,ready:urnaEmu.terminalText,nativeRegistrationFileChanged:true,invalidStateRejected:rejected,simulation:urnaEmu.fingerprint.state,transitions:urnaEmu.logs.filter(l=>l.includes('experimental-transition')).slice(-8)};
 })()`);
 fs.writeFileSync(evidencePath('biometric-acceptance.json'),JSON.stringify({testedAt:new Date().toISOString(),...result},null,2)+'\n');console.log(result);
 await b.capture('simulated-biometric-registration-complete');
}finally{b.close()}
