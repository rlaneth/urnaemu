// End to end, official phase with a fictitious eleitorado: add voters, generate and apply
// official media, simulate several identified voters, close, and verify the BU VOTA writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const extra = Number(process.env.EXTRA_VOTERS ?? 8), voters = Number(process.env.VOTERS ?? 6);
const base = process.env.EMULATOR_URL || 'http://127.0.0.1:8766/urnaemu/';
const b = await connect({ evaluationTimeoutMs: 900000 });
try {
	await b.call('Page.navigate', { url: base + '?scenario=geral-t1' });
	await b.ready();
	const roster = await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;const list=[...e.voters(),...e.generateVoters(${extra},11)];await e.setVoters(list);if(!e.provider)await e.useKey();await e.generateOfficial();return e.voters()})()`);
	assert.equal(roster.length, extra + 1);
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1500);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate(`urnaEmu.printer.setSpeed(${JSON.stringify(process.env.SPEED ?? 'instant')})`);
	const official = { title: roster[0].title, birth: roster[0].birth.slice(0, 4), closeTime: '2026-10-04T20:05:00.000Z' };
	await b.evaluate('qa.boot()');
	await b.evaluate(`qa.register(${JSON.stringify(official)},[true])`);
	const sim = await b.evaluate(`(async()=>{await urnaEmu.simulator.start({count:${voters},seed:5,pace:${Number(process.env.PACE ?? 0)}});const s=urnaEmu.simulator.state;return {cast:s.cast,error:s.error,tally:s.tally}})()`);
	assert.equal(sim.error, null, sim.error);
	assert.equal(sim.cast, voters);
	await b.evaluate(`qa.close(${JSON.stringify(official)})`);
	const result = await b.evaluate(`(async()=>{
		const fs=Module.FS,found=[];(function walk(p){for(const n of fs.readdir(p)){if(n==='.'||n==='..')continue;const f=p+'/'+n;let st;try{st=fs.stat(f)}catch{continue}if(fs.isDir(st.mode))walk(f);else if(/-bu\\.dat$/.test(n))found.push(f)}})('/dsk');
		if(!found.length)throw Error('No BU written');
		const r=await urnaEmu.verifyResults(found[0]);
		return {path:found[0],ok:r.ok,failed:r.checks.filter(c=>!c.ok),attendance:r.bu.qtdEleitoresCompareceram,offices:r.elections.flatMap(e=>e.offices.map(o=>({cargo:o.cargo,votes:o.votes})))};
	})()`);
	assert.ok(result.ok, 'BU verification failed: ' + JSON.stringify(result.failed));
	assert.equal(result.attendance, voters, 'BU attendance');
	const names = { 1: 'PRESIDENTE', 3: 'GOVERNADOR', 5: 'SENADOR', 6: 'DEPUTADOFEDERAL', 7: 'DEPUTADOESTADUAL', 8: 'DEPUTADODISTRITAL', 11: 'PREFEITO', 13: 'VEREADOR' };
	const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/\d+AVAGA$/, '');
	const fromBu = {}, expected = {};
	for (const o of result.offices)
		for (const v of o.votes) {
			const key = v.tipo === 1 ? `n${v.codigo}` : v.tipo === 4 ? `l${v.codigo}` : v.tipo === 2 ? 'branco' : v.tipo === 3 ? 'nulo' : 'outro';
			const cargo = names[o.cargo.cargoConstitucional];
			(fromBu[cargo] ??= {})[key] = (fromBu[cargo][key] ?? 0) + v.quantidade;
		}
	for (const [cargo, counts] of Object.entries(sim.tally))
		for (const [choice, n] of Object.entries(counts)) {
			const key = choice === 'Branco' ? 'branco' : choice === 'Nulo' ? 'nulo' : choice.startsWith('Legenda') ? `l${Number(choice.split(' ')[1])}` : `n${choice.split(' ')[0]}`;
			(expected[norm(cargo)] ??= {})[key] = (expected[norm(cargo)][key] ?? 0) + n;
		}
	for (const cargo of Object.keys(fromBu)) for (const k of Object.keys(fromBu[cargo])) if (!fromBu[cargo][k]) delete fromBu[cargo][k];
	assert.deepEqual(fromBu, expected, 'BU totals differ from the simulator tally');
	console.log(`PASS: official session with ${extra + 1} eleitores; ${voters} identified voters; BU ${result.path} verified (attendance ${result.attendance}) and matches the expected tally.`);
} finally {
	b.close();
}
