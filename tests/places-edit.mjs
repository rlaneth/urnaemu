// A zona created in the load editor (load/places-edit.js) is a valid relocation target, and a
// município can be renamed: VOTA boots the media moved into the new zona, and in an official
// session the BU it writes carries the new zona/seção and verifies. (Creating new município
// numbers is intentionally not supported — VOTA rejects them; see places-edit.js.)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const MUN = 1, ZONA = 5, SECAO = 12;
const b = await connect({ evaluationTimeoutMs: 600000 });
const report = {};
const applyAndBoot = async () => {
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1300);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
};
try {
	// 1. Training media: rename the município, create a new zona, relocate the section into it.
	await b.load('municipal-t1');
	report.listed = await b.evaluate(`(async()=>{
		const e=urnaEmu.loadEditor;
		await e.renameMunicipio(${MUN},'Cidade Modelo');
		await e.createZona(${MUN},${ZONA});
		await e.changeLocation({municipio:${MUN},zona:${ZONA},secao:${SECAO}});
		return e.places().map(p=>[p.municipio,p.nome,p.zonas]);
	})()`);
	assert.ok(report.listed.some((p) => p[0] === MUN && p[1] === 'Cidade Modelo' && p[2].includes(ZONA)), 'rename + new zona listed');
	await applyAndBoot();
	report.trainingConfig = await b.evaluate('({municipio:urnaEmu.sessionConfig.municipio,zona:urnaEmu.sessionConfig.zona,secao:urnaEmu.sessionConfig.secao,status:urnaEmu.loadEditor.status.code})');
	assert.equal(report.trainingConfig.status, 'accepted');
	assert.deepEqual([report.trainingConfig.municipio, report.trainingConfig.zona, report.trainingConfig.secao], [MUN, ZONA, SECAO]);

	// 2. Official media: rename, create the zona, move into it, re-sign, full session and BU.
	await b.load('municipal-t1');
	await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;if(!e.provider)await e.useKey();await e.generateOfficial();await e.renameMunicipio(${MUN},'Cidade Modelo');await e.createZona(${MUN},${ZONA});await e.changeLocation({municipio:${MUN},zona:${ZONA},secao:${SECAO}})})()`);
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
		return {path:found[0],ok:r.ok,failed:r.checks.filter(c=>!c.ok),bu:JSON.stringify(r.bu,(k,v)=>typeof v==='bigint'?Number(v):v).slice(0,800)};
	})()`);
	assert.ok(report.official.ok, 'BU verification failed: ' + JSON.stringify(report.official.failed));
	assert.match(report.official.path, new RegExp(String(MUN).padStart(5, '0') + String(ZONA).padStart(4, '0') + String(SECAO).padStart(4, '0') + '-bu\\.dat$'));
	assert.match(report.official.bu, new RegExp(`"zona":${ZONA}\\b|"zona":"0*${ZONA}"`));
	assert.match(report.official.bu, /"secao":12\b|"secao":"0012"/);
	fs.writeFileSync(evidencePath('places-edit.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(`PASS: created zona ${ZONA} and renamed município; VOTA boots the section moved into it and the official BU (${report.official.path}) carries the new place and verifies.`);
} finally {
	b.close();
}
