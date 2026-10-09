// The load media moved to another seção (load/section-relocation.js): VOTA accepts it, and in an
// official session the BU it writes carries the new section and verifies.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const SECAO = Number(process.env.SECAO ?? 42);
const b = await connect({ evaluationTimeoutMs: 600000 });
const report = {};
const applyAndBoot = async () => {
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
};
try {
	// 1. Training media.
	await b.load('municipal-t1');
	report.training = await b.evaluate(`urnaEmu.loadEditor.changeSection(${SECAO}).then(r=>r.changes.length)`);
	await applyAndBoot();
	report.trainingConfig = await b.evaluate('({secao:urnaEmu.sessionConfig.secao,init:urnaEmu.initialized,status:urnaEmu.loadEditor.status.code,err:urnaEmu.error})');
	assert.equal(report.trainingConfig.secao, SECAO);
	assert.equal(report.trainingConfig.status, 'accepted');

	// 2. Official media, moved to the new section and re-signed; full session and BU.
	await b.load('municipal-t1');
	await b.evaluate('(async()=>{const e=urnaEmu.loadEditor;if(!e.provider)await e.useKey();await e.generateOfficial();await e.changeSection(' + SECAO + ')})()');
	await applyAndBoot();
	const voter = { title: '010309782003', birth: '1960' };
	await b.evaluate('qa.boot()');
	await b.evaluate(`qa.register(${JSON.stringify(voter)},[true])`);
	await b.evaluate(`qa.authorize(${JSON.stringify(voter)})`);
	await b.evaluate('qa.vote(0)');
	await b.evaluate(`qa.close(${JSON.stringify({ ...voter, closeTime: '2026-10-04T20:05:00.000Z' })})`);
	report.official = await b.evaluate(`(async()=>{
		const fs=Module.FS,found=[];(function walk(p){for(const n of fs.readdir(p)){if(n==='.'||n==='..')continue;const f=p+'/'+n;let st;try{st=fs.stat(f)}catch{continue}if(fs.isDir(st.mode))walk(f);else if(/-bu\\.dat$/.test(n))found.push(f)}})('/dsk');
		if(!found.length)throw Error('No BU written');
		const r=await urnaEmu.verifyResults(found[0]);
		return {path:found[0],ok:r.ok,failed:r.checks.filter(c=>!c.ok),bu:JSON.stringify(r.bu,(k,v)=>typeof v==='bigint'?Number(v):v).slice(0,600)};
	})()`);
	assert.ok(report.official.ok, 'BU verification failed: ' + JSON.stringify(report.official.failed));
	assert.match(report.official.path, new RegExp(String(SECAO).padStart(4, '0') + '-bu\\.dat$'));
	assert.match(report.official.bu, /"secao":42\b|"secao":"0042"/);
	fs.writeFileSync(evidencePath('section-change.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(`PASS: media moved to seção ${SECAO}; VOTA accepts it and the official BU (${report.official.path}) carries the new section and verifies.`);
} finally {
	b.close();
}
