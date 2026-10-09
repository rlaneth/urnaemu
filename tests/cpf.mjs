// Voters with a CPF (identifier [1] in the -el.dat): the mesário identifies a voter by CPF, the
// voter votes, and the official BU verifies.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const b = await connect({ evaluationTimeoutMs: 600000 });
try {
	await b.load('municipal-t1');
	const roster = await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor;
		const extra=e.generateVoters(6,21).map((v,i)=>i===0?{...v,cpf:'52998224725'}:v);
		await e.setVoters([...e.voters(),...extra]);
		if(!e.provider)await e.useKey();await e.generateOfficial();return e.voters()})()`);
	const withCpf = roster.find((v) => v.cpf === '52998224725');
	assert.ok(withCpf, 'CPF kept in the official media');
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
	await b.evaluate('qa.boot()');
	await b.evaluate(`qa.register(${JSON.stringify({ title: roster[0].title, birth: roster[0].birth.slice(0, 4) })},[true])`);
	// Identify by CPF, then the birth year VOTA asks for.
	const terminal = await b.evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
		for(const k of '${withCpf.cpf}C')await urnaEmu.submitKey(k,'mesario');await sleep(1200);
		const found=urnaEmu.terminalText;
		for(let i=0;i<3&&/prosseguir/.test(urnaEmu.terminalText);i++){await urnaEmu.submitKey('C','mesario');await sleep(800)}
		if(/ano de nascimento/i.test(urnaEmu.terminalText)){for(const k of '${withCpf.birth.slice(0, 4)}CC')await urnaEmu.submitKey(k,'mesario');await sleep(1500)}
		return {found,enabled:urnaEmu.session.voterEnabled}})()`);
	assert.match(terminal.found, /CPF: 529\.982\.247-25/);
	assert.equal(terminal.enabled, true, 'voter identified by CPF was not enabled');
	await b.evaluate('qa.vote(0)');
	await b.evaluate(`qa.close(${JSON.stringify({ title: roster[0].title, closeTime: '2026-10-04T20:05:00.000Z' })})`);
	const result = await b.evaluate(`(async()=>{const fs=Module.FS;const f='/dsk/fi/dinamico/trab1/'+fs.readdir('/dsk/fi/dinamico/trab1').find(n=>/-bu\\.dat$/.test(n));const r=await urnaEmu.verifyResults(f);return {ok:r.ok,attendance:r.bu.qtdEleitoresCompareceram}})()`);
	assert.ok(result.ok, 'BU verification failed');
	assert.equal(result.attendance, 1);
	console.log('PASS: voter identified by CPF on the terminal; the official BU verifies (attendance 1).');
} finally {
	b.close();
}
