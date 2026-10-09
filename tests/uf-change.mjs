// Changing the media's UF (load/places-edit.js changeUf): VOTA — as with município códigos —
// does not validate the UF against a baked table, so a media transformed to a UF the bundle never
// shipped boots, lets a voter vote, and writes a BU that carries the new UF and verifies. Covers
// both orders (UF change before and after generating the official media / re-signing).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const UF = (process.env.UF ?? 'sp').toLowerCase();
const b = await connect({ evaluationTimeoutMs: 600000 });
const report = {};
const applyAndBoot = async () => {
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1400);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
};
const bu = async () =>
	b.evaluate(`(async()=>{
		const fs=Module.FS,found=[];(function walk(p){for(const n of fs.readdir(p)){if(n==='.'||n==='..')continue;const f=p+'/'+n;let st;try{st=fs.stat(f)}catch{continue}if(fs.isDir(st.mode))walk(f);else if(/-bu\\.dat$/.test(n))found.push(f)}})('/dsk');
		if(!found.length)throw Error('No BU written');
		const r=await urnaEmu.verifyResults(found[0]);
		return {path:found[0].split('/').pop(), ok:r.ok, failed:r.checks.filter(c=>!c.ok).map(c=>c.id)};
	})()`);
const voter = { title: '010309782003', birth: '1960' };
const session = async () => {
	await b.evaluate('qa.boot()');
	await b.evaluate(`qa.register(${JSON.stringify(voter)},[true])`);
	await b.evaluate(`qa.authorize(${JSON.stringify(voter)})`);
	await b.evaluate('qa.vote(0)');
	await b.evaluate(`qa.close(${JSON.stringify({ ...voter, closeTime: '2026-10-04T20:05:00.000Z' })})`);
};
try {
	// 1. Training media with the UF changed: VOTA boots with the new UF.
	await b.load('municipal-t1');
	await b.evaluate(`urnaEmu.loadEditor.changeUf('${UF}')`);
	await applyAndBoot();
	report.training = await b.evaluate('({uf:urnaEmu.sessionConfig.uf,status:urnaEmu.loadEditor.status.code})');
	assert.equal(report.training.status, 'accepted');
	assert.equal(report.training.uf, UF);

	// 2. UF changed BEFORE generating the official media.
	await b.load('municipal-t1');
	await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;if(!e.provider)await e.useKey();await e.changeUf('${UF}');await e.generateOfficial()})()`);
	await applyAndBoot();
	await session();
	report.before = await bu();
	assert.ok(report.before.ok, 'BU (UF before official) failed: ' + JSON.stringify(report.before.failed));
	assert.match(report.before.path, new RegExp(`^o\\d{5}${UF}.*-bu\\.dat$`));

	// 3. UF changed AFTER generating the official media (exercises re-sign over renamed files).
	await b.load('municipal-t1');
	await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;if(!e.provider)await e.useKey();await e.generateOfficial();await e.changeUf('${UF}')})()`);
	await applyAndBoot();
	await session();
	report.after = await bu();
	assert.ok(report.after.ok, 'BU (UF after official) failed: ' + JSON.stringify(report.after.failed));
	assert.match(report.after.path, new RegExp(`^o\\d{5}${UF}.*-bu\\.dat$`));

	fs.writeFileSync(evidencePath('uf-change.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(`PASS: UF changed to ${UF.toUpperCase()}; VOTA boots and both orders produce an official BU (${report.after.path}) that verifies.`);
} finally {
	b.close();
}
