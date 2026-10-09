// Native voter biometric identification: synthetic enrollment, accepted/rejected/timeout
// responses, ordinary birth-year identification, and signed native BU attendance counters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';
const b=await connect({evaluationTimeoutMs:180000});
try {
 await b.call('Page.bringToFront');console.log('load');await b.load();
 const roster=await b.evaluate(`(async()=>{
 const e=urnaEmu.loadEditor;const voters=[...e.voters(),...e.generateVoters(3,38).map((v,i)=>({...v,simulatedBiometrics:i<2}))];
 await e.setVoters(voters);if(!e.provider)await e.useKey();await e.generateOfficial();return e.voters();})()`);
 assert.equal(roster[1].simulatedBiometrics,true);
 assert.equal(roster[2].simulatedBiometrics,true);
 assert.equal(roster[3].simulatedBiometrics,undefined);
 await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');await b.delay(1000);await b.ready();
 assert.equal(await b.evaluate('urnaEmu.error'),null);
 await b.evaluate(QA_PAGE);await b.evaluate("urnaEmu.printer.setSpeed('instant')");await b.evaluate('qa.boot()');console.log('booted');
 await b.evaluate(`qa.register(${JSON.stringify({title:roster[0].title,birth:roster[0].birth.slice(0,4)})},[true])`);
 const state=()=>b.evaluate(`({text:urnaEmu.terminalText,operator:urnaEmu.experiments.state.current?.name,enabled:urnaEmu.session.voterEnabled,error:urnaEmu.error})`);
 const confirm=()=>b.evaluate("urnaEmu.submitKey('C','mesario')");
 async function identify(voter){
  await b.evaluate(`(async()=>{for(const k of '${voter.title}CC')await urnaEmu.submitKey(k,'mesario')})()`);
  assert.equal((await state()).operator,'vota::CPedeDigital');
  assert.match((await state()).text,/POLEGAR ou INDICADOR/);
 }
 async function acceptAndVote(){
  await b.evaluate('urnaEmu.scanner.place(true)');console.log('accepted');
  assert.equal((await state()).operator,'vota::CDigitalReconhecida');
  assert.equal(await b.evaluate(`urnaEmu.native.transaction(ctx=>urnaEmu.voterBiometrics.respond(ctx,urnaEmu.experiments.state.active,'correct')).then(()=>false,()=>true)`),true,'duplicate injection must be rejected');
  for(let i=0;i<5&&!(await state()).enabled;i++)await confirm();
  console.log('released');assert.equal((await state()).enabled,true);
  assert.equal((await state()).error,null);
  await b.evaluate('qa.vote(0)');
 }
 await identify(roster[1]);console.log('first prompt');await acceptAndVote();console.log('first vote');
 await identify(roster[2]);
 console.log('second prompt');await b.evaluate('urnaEmu.scanner.place(false)');console.log('rejected');
 assert.equal((await state()).operator,'vota::CDigitalNaoReconhecida');
 assert.equal((await state()).enabled,false);
 await confirm();
 assert.equal((await state()).operator,'vota::CPedeDigital');
 await b.evaluate('urnaEmu.scanner.timeout()');console.log('timeout');
 assert.equal((await state()).operator,'vota::CDigitalNaoReconhecidaPorTempo');
 assert.equal((await state()).enabled,false);
 await confirm();
 assert.equal((await state()).operator,'vota::CPedeDigital');
 await acceptAndVote();
 // A voter without the setting keeps the original birth-year path.
 await b.evaluate(`(async()=>{for(const k of '${roster[3].title}CC')await urnaEmu.submitKey(k,'mesario')})()`);
 assert.match((await state()).text,/ANO de nascimento/i);
 await b.evaluate(`(async()=>{for(const k of '${roster[3].birth.slice(0,4)}CC')await urnaEmu.submitKey(k,'mesario')})()`);
 assert.equal((await state()).enabled,true);await b.evaluate('qa.vote(1)');
 console.log('closing');await b.evaluate(`qa.close(${JSON.stringify({title:roster[0].title,closeTime:'2026-10-04T20:05:00.000Z'})})`);
 const result=await b.evaluate(`(async()=>{const fs=Module.FS;const f='/dsk/fi/dinamico/trab1/'+fs.readdir('/dsk/fi/dinamico/trab1').find(n=>/-bu\\.dat$/.test(n));const r=await urnaEmu.verifyResults(f);return {ok:r.ok,bu:r.bu,biometrics:urnaEmu.voterBiometrics.state}})()`);
 fs.writeFileSync(evidencePath('voter-biometrics.json'),JSON.stringify(result,null,2)+'\n');
 assert.ok(result.ok,'signed BU must verify');
 assert.equal(result.bu.qtdEleitoresCompareceram,3);
 assert.deepEqual(result.bu.detalhamentoComparecimento,{qtdEleitoresCompareceramSemBiometria:1,qtdEleitoresHabilitadosPorBiometria:2,qtdEleitoresHabilitadosPorBiografia:0});
 assert.deepEqual(result.biometrics.outcomes.map(e=>e.outcome),['correct','wrong','timeout','correct']);
 console.log('PASS: native biometric acceptance, rejection, timeout and retries; signed BU: 2 biometric voters, 1 without biometrics.');
} finally {b.close()}
