// Load editor end to end: edit candidate and voter records, sign, reject tampering, boot the
// edited media (simple mode), then convert it to official media and authorize the edited voter.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect,evidencePath} from '../tools/screen-session.mjs';
import {QA_PAGE} from '../tools/qa-page.mjs';
const b=await connect({evaluationTimeoutMs:300000});
try{
 await b.load();
 const setup=await b.evaluate(`(async()=>{
  const E=urnaEmu.loadEditor,paths=[...E.files.keys()];
  const ca=paths.find(p=>p.endsWith('-ca.dat'));
  const inputs=E.fields(ca).filter(f=>f.text==='Golfe');
  if(inputs.length!==2)throw Error('Candidate editor fields not found');
  for(const field of inputs)E.setField(ca,field.berPath,'João da Silva');
  const el=paths.find(p=>/0001-el.dat$/.test(p)),fields=E.fields(el);
  const name=fields.find(f=>f.text.includes('ABADIA'));E.setField(el,name.berPath,'BÁRBARA ELEITORA TESTE');
  const birth=fields.find(f=>f.text==='19600720');E.setField(el,birth.berPath,'19850720');
  const first=await urnaEmu.loadEditor.useKey(),jwk=await first.exportPrivateJwk();
  const imported=await urnaEmu.loadEditor.useKey(jwk);
  await urnaEmu.loadEditor.signInputs();
  const p=await urnaEmu.lib.VotaLoadFormat.signPackage(await urnaEmu.loadEditor.packageDraft(),imported);
  const roundTrip=JSON.parse(JSON.stringify(p));await urnaEmu.loadEditor.importPackage(roundTrip);
  const tamper=structuredClone(p);tamper.config.secao=2;let rejected=false;
  try{await urnaEmu.loadEditor.importPackage(tamper)}catch(e){rejected=/inválida/.test(e.message)}
  if(!rejected)throw Error('Tampered media was accepted');
  // Trust a public identity from its certificate, without a private key.
  await urnaEmu.loadEditor.trustPublicKey(imported.certificate);
  const trustStatus=urnaEmu.loadEditor.status.code;
  window.loadTestReport={inputSignatures:await urnaEmu.lib.VotaLoadSignatures.verifyAll(p),candidateTextEdits:inputs.length,importedKeyMatches:urnaEmu.lib.VotaLoadFormat.base64(first.spki)===urnaEmu.lib.VotaLoadFormat.base64(imported.spki),tamperRejected:rejected,trustStatus,verification:await urnaEmu.lib.VotaLoadFormat.verifyPackage(p,imported.spki),archive:p};
  return window.loadTestReport;
 })()`);
 assert(setup.importedKeyMatches&&setup.tamperRejected&&setup.verification.trusted);
 assert.equal(setup.trustStatus,'trust-pinned');
 fs.writeFileSync(evidencePath('load-editor/example.vota-load.json'),JSON.stringify(setup.archive,null,2)+'\n');delete setup.archive;
 await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');await b.delay(800);await b.ready();
 const initialized=await b.evaluate(`(async()=>{const s=await urnaEmu.readState();return {candidate:s.candidates.find(c=>c.number===91001),provider:urnaEmu.loadSigningProvider.algorithm,status:urnaEmu.loadEditor.status.text}})()`);
 assert.equal(initialized.candidate.name,'João da Silva');
 await b.evaluate(`(async()=>{await urnaEmu.press('D');for(const k of '91001'){await urnaEmu.press(k);await new Promise(r=>setTimeout(r,150));await urnaEmu.tick()}for(let i=0;i<10;i++){await urnaEmu.tick();await new Promise(r=>setTimeout(r,60))}})()`);
 await b.capture('custom-load-candidate',{purpose:'Native screen using edited candidate from signed media'});
 // The same edited draft as official media: full session, mesário registration, then the
 // edited voter (birth year 1985) is authorized by VOTA's own identity check.
 await b.evaluate('(async()=>{if(!urnaEmu.loadEditor.provider)await urnaEmu.loadEditor.useKey();return urnaEmu.loadEditor.generateOfficial()})()');
 await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');await b.delay(1000);await b.ready();
 await b.evaluate(QA_PAGE);await b.evaluate("urnaEmu.printer.setSpeed('instant')");
 await b.evaluate('qa.boot()');
 const official={title:'010309782003',birth:'1985'};
 await b.evaluate(`qa.register(${JSON.stringify(official)},[true])`);
 const native=await b.evaluate(`(async()=>{let text='';const seen=setInterval(()=>{if(/BÁRBARA ELEITORA TESTE/.test(urnaEmu.terminalText||''))text=urnaEmu.terminalText},20);try{await qa.authorize(${JSON.stringify(official)})}finally{clearInterval(seen)}return {authorized:urnaEmu.session.voterEnabled,phase:urnaEmu.sessionPhase,terminal:text||urnaEmu.terminalText,selectedKeyUsed:urnaEmu.pkcs11.provider===urnaEmu.loadSigningProvider}})()`);
 assert(native.authorized&&native.selectedKeyUsed);assert.match(native.terminal,/BÁRBARA ELEITORA TESTE/);
 await b.capture('custom-load-voter',{purpose:'Native voter authorization accepts edited birth year 1985'});
 await b.evaluate(`urnaEmu.showPanel('carga')`);await b.delay(400);
 const shot=await b.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(evidencePath('load-editor.png'),Buffer.from(shot.data,'base64'));
 const report={checkedAt:new Date().toISOString(),...setup,initialized,native};fs.writeFileSync(evidencePath('load-editor.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{b.close()}
