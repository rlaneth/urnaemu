// The load media moved to another município and zona (load/section-relocation.js): VOTA accepts
// it in training (municipal and state-wide elections), and in an official session the BU it
// writes carries the new município, zona and seção and verifies.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const TARGET = { municipio: 2, zona: 2, secao: 7 };
const b = await connect({ evaluationTimeoutMs: 600000 });
const report = {};
const applyAndBoot = async () => {
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
};
const accepted = () => b.evaluate('({config:urnaEmu.sessionConfig,init:urnaEmu.initialized,status:urnaEmu.loadEditor.status.code,err:urnaEmu.error})');
try {
	// 1. Training media, municipal and state-wide elections.
	for (const scenario of ['municipal-t1', 'geral-t1']) {
		await b.load(scenario);
		report[scenario] = { changes: await b.evaluate(`urnaEmu.loadEditor.changeLocation(${JSON.stringify(TARGET)}).then(r=>r.changes.length)`) };
		await applyAndBoot();
		report[scenario].boot = await accepted();
		assert.equal(report[scenario].boot.status, 'accepted', `${scenario}: ${report[scenario].boot.err}`);
		assert.deepEqual([report[scenario].boot.config.municipio, report[scenario].boot.config.zona, report[scenario].boot.config.secao], [2, 2, 7]);
	}
	// A place the media does not declare is refused.
	await b.load('municipal-t1');
	report.refused = await b.evaluate(`urnaEmu.loadEditor.changeLocation({municipio:2,zona:1}).then(()=>null,e=>e.message)`);
	assert.match(report.refused, /não pertence ao município/);

	// 2. Official media moved and re-signed; full session and BU.
	await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;if(!e.provider)await e.useKey();await e.generateOfficial();await e.changeLocation(${JSON.stringify(TARGET)})})()`);
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
		const id=JSON.stringify(r.bu.identificacaoSecao,(k,v)=>typeof v==='bigint'?Number(v):v);
		const corr=JSON.stringify(r.bu.urna?.correspondenciaResultado?.identificacao,(k,v)=>typeof v==='bigint'?Number(v):v);
		return {path:found[0],ok:r.ok,failed:r.checks.filter(c=>!c.ok),id,corr};
	})()`);
	assert.ok(report.official.ok, 'BU verification failed: ' + JSON.stringify(report.official.failed));
	assert.match(report.official.path, /0000200020007-bu\.dat$/);
	assert.match(report.official.id, /"municipio":2\b/);
	assert.match(report.official.id, /"zona":2\b/);
	assert.match(report.official.id, /"secao":7\b/);
	fs.writeFileSync(evidencePath('location-change.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(`PASS: media moved to município 2, zona 2, seção 7; VOTA accepts it (municipal and state-wide) and the official BU carries the new place and verifies.`);
} finally {
	b.close();
}
