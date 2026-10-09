// Session snapshots: save a training session after two votes, open the file in the
// Instantâneos window (as a user would), resume it (VOTA's own restart path: "Quer testar o
// teclado?", "REINÍCIO DA VOTAÇÃO", counter preserved), vote once more and close: the printed BU
// counts all three. Then start over from the same file: a fresh opening.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 400000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) {
	const { data } = await b.call('Page.captureScreenshot', { format: 'png' });
	fs.writeFileSync(evidencePath(`snapshot/${name}.png`), Buffer.from(data, 'base64'));
}
async function openFile(file) {
	await b.evaluate("urnaEmu.showPanel('instantaneos')");
	await sleep(400);
	const { root } = await b.call('DOM.getDocument', { depth: -1 });
	const { nodeId } = await b.call('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-testid=snapshot-file]' });
	await b.call('DOM.setFileInputFiles', { nodeId, files: [file] });
	for (let i = 0; i < 40 && (await b.evaluate("document.querySelector('[data-testid=snapshot-window]')?.dataset.loaded")) !== 'true'; i++) await sleep(150);
}
const op = () => b.evaluate('urnaEmu.experiments.state.current?.name ?? null');
try {
	await b.session({ scenario: 'municipal-t1' });
	await b.evaluate("(async()=>{for(let i=0;i<2;i++)await urnaEmu.procedures.run('vote')})()");
	const snap = await b.evaluate('urnaEmu.createSnapshot()');
	assert.equal(snap.summary.votes, 2);
	assert.ok(snap.files.some((f) => f.path === '/dsk/fi/dinamico/trab1/rdv.dat'), 'RDV saved');
	assert.ok(/ZER[ÉE]SIMA/i.test(snap.printer.text), 'zerésima on the saved paper');
	assert.ok(!JSON.stringify(snap.identity ?? {}).includes('"d"'), 'no private key in the snapshot');
	const file = evidencePath('snapshot/sessao.urnaemu.json');
	fs.writeFileSync(file, JSON.stringify(snap));

	// Resume.
	await openFile(file);
	await shot('aberto');
	await b.evaluate("document.querySelector('[data-testid=snapshot-resume]').click()");
	await sleep(1500);
	await b.ready();
	const phases = [];
	for (let i = 0; i < 60; i++) {
		const name = await op(), listening = await b.evaluate("document.querySelector('[data-testid=urna]').dataset.listening==='true'");
		if (name && phases.at(-1) !== name) phases.push(name);
		if (!(await b.evaluate('urnaEmu.session.booting'))) break;
		if (listening && /CRetomada/.test(name)) {
			await shot('retomada');
			await b.evaluate("urnaEmu.submitKey('D','voter')");
		} else if (listening && /CReinicioVotacao/.test(name)) {
			await shot('reinicio');
			await b.evaluate("urnaEmu.submitKey('C','voter')");
		}
		await sleep(700);
	}
	console.log(phases.join(' → '));
	assert.ok(phases.some((p) => /CRetomada/.test(p)) && phases.some((p) => /CReinicioVotacao/.test(p)), 'VOTA took its restart path');
	assert.match(await b.evaluate('urnaEmu.terminalText'), /Votos: 0002/);
	await b.evaluate("(async()=>{urnaEmu.printer.setSpeed('instant');await urnaEmu.procedures.run('vote');await urnaEmu.procedures.run('closing')})()");
	const attendance = await b.evaluate("urnaEmu.printer.text().match(/Comparecimento\\s+(\\d+)/)?.[1]");
	assert.equal(attendance, '0003', 'the printed BU counts the votes before and after the restart');
	await shot('encerrada');

	// Start over from the same file: a fresh opening, no restart path.
	await openFile(file);
	await b.evaluate("document.querySelector('[data-testid=snapshot-restart]').click()");
	await sleep(1500);
	await b.ready();
	assert.equal(await b.evaluate('urnaEmu.resumedFiles'), null, 'no files restored when starting over');
	// A fresh opening: keyboard test and zerésima (no REINÍCIO DA VOTAÇÃO), counter at zero.
	const route = await b.evaluate(`(async()=>{const seen=new Set(),t=setInterval(()=>seen.add(urnaEmu.experiments.state.current?.name),100);
		urnaEmu.printer.setSpeed('instant');try{await urnaEmu.procedures.run('opening')}finally{clearInterval(t)}return {seen:[...seen],term:urnaEmu.terminalText}})()`);
	assert.ok(route.seen.some((n) => /Zeresima/.test(n)), 'zerésima printed again');
	assert.ok(!route.seen.some((n) => /CReinicioVotacao/.test(n)), 'no restart path');
	assert.match(route.term, /Votos: 0000/);
	console.log('PASS: snapshot saved after 2 votes; resumed through VOTA\'s REINÍCIO DA VOTAÇÃO with the counter kept; BU counts 3; start over opens a fresh session.');
} finally {
	b.close();
}
