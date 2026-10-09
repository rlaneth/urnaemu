// A voter who does not vote: (1) the presidente's procedure (TSE manual): "O eleitor está
// demorando" → CONFIRMA → "O eleitor ainda está votando?" → CORRIGE → presidente's título →
// CONFIRMA → "NÃO VOTOU"; (2) the automatic suspension countdown, driven by native ticks, with
// the alarm thread patched out ('thread-alarme-eleitor-demorando') and its beep played instead.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const b = await connect({ evaluationTimeoutMs: 300000 });
const terminal = () => b.evaluate("urnaEmu.terminalText.split('\\n').slice(0,4).map(s=>s.trim()).filter(Boolean).join(' | ')");
const waitFor = async (re, ms) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (re.test(await terminal())) return;
		if (await b.evaluate('urnaEmu.error')) throw Error(await b.evaluate('urnaEmu.error'));
		await b.delay(1000);
	}
	throw Error(`Timed out waiting for ${re}: ${await terminal()}`);
};
const report = {};
try {
	// (1) Official media with extra fictitious voters: one is the presidente, another votes.
	await b.load('municipal-t1');
	const roster = await b.evaluate("(async()=>{const e=urnaEmu.loadEditor;await e.setVoters([...e.voters(),...e.generateVoters(3,77)]);if(!e.provider)await e.useKey();await e.generateOfficial();return e.voters().map(v=>({title:v.title,birth:v.birth.slice(0,4)}))})()");
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
	await b.evaluate('qa.boot()');
	const [presidente, voter] = [roster[1], roster[2]];
	await b.evaluate(`qa.register(${JSON.stringify(presidente)},[true])`);
	await b.evaluate(`qa.authorize(${JSON.stringify(voter)})`);
	await waitFor(/demorando/, 90000);
	const keys = async (k) => {
		for (const c of k) await b.evaluate(`urnaEmu.submitKey('${c}','mesario')`);
		await b.delay(1200);
		return terminal();
	};
	report.manual = { demorando: await terminal(), confirma: await keys('C'), corrige: await keys('D'), suspended: await keys(presidente.title + 'C') };
	assert.match(report.manual.confirma, /ainda está votando/);
	assert.match(report.manual.corrige, /Informe seu título/);
	assert.match(report.manual.suspended, /NÃO VOTOU/);

	// (2) Training: jump the clock so VOTA starts the automatic suspension countdown.
	await b.session({ scenario: 'municipal-t1' });
	assert.ok(await b.evaluate("urnaEmu.wasmPatches.applied.some(p=>p.id==='thread-alarme-eleitor-demorando')"), 'patch not applied');
	await b.evaluate('qa.authorize(null)');
	await b.evaluate("urnaEmu.clock.configure({mode:'running',iso:new Date(urnaEmu.clock.now()+2*60000).toISOString()})");
	await waitFor(/Suspensão automática em \d+ segundos/, 15000);
	const countdown = [await terminal()];
	await waitFor(/CONFIRMA: votar|Digite o T/, 20000);
	countdown.push(await terminal());
	report.automatic = { countdown, beeps: await b.evaluate('urnaEmu.voterAlarm.beeps'), logd: await b.evaluate("(urnaEmu.logd?.entries||[]).map(e=>e.message).filter(m=>/suspenso/.test(m))") };
	assert.ok(report.automatic.beeps >= 5, 'alarm beeps');
	assert.ok(report.automatic.logd.some((m) => /suspenso automaticamente/.test(m)), 'native automatic suspension');
	fs.writeFileSync(evidencePath('late-voter.json'), JSON.stringify(report, null, 2) + '\n');
	console.log('PASS: presidente suspension ("NÃO VOTOU") and automatic suspension countdown with alarm.');
} finally {
	b.close();
}
