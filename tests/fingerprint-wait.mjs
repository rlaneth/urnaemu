// Mesário fingerprint prompt left waiting: VOTA's own timer (CPedeDigitalMesario::ProcessTick)
// polls the reader and looks up api::IFingerDetection on every tick. Before that service was
// registered, waiting a few seconds ended the session ("solicitada uma instancia nao criada").
// Now VOTA keeps waiting; "Dedo correto" afterwards still registers the mesário.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 400000 });
try {
	await b.session({ scenario: 'municipal-t1', official: true });
	const r = await b.evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
		const term=()=>urnaEmu.terminalText||'';const listening=()=>document.querySelector('[data-testid=terminal-keypad]').dataset.listening==='true';
		const press=async k=>{for(let i=0;i<100&&!listening();i++)await sleep(50);await urnaEmu.submitKey(k,'mesario');await sleep(300)};
		for(let i=0;i<20&&!urnaEmu.fingerprint?.state.capturing;i++){if(/Informe o t[ií]tulo/i.test(term())){for(const k of '010309782003')await press(k);await press('C')}else await press('C');await sleep(300)}
		const prompt=urnaEmu.experiments.state.current?.name;
		await sleep(10000);
		const waited={error:urnaEmu.error,state:urnaEmu.experiments.state.current?.name,polled:urnaEmu.fingerprint.state.calls.some(c=>c.method==='image-poll')};
		await urnaEmu.scanner.place(true);await sleep(2500);
		return {prompt,waited,after:urnaEmu.experiments.state.current?.name,error:urnaEmu.error}})()`);
	assert.equal(r.prompt, 'comum::CPedeDigitalMesario');
	assert.equal(r.waited.error, null, 'the session survived the wait');
	assert.equal(r.waited.state, 'comum::CPedeDigitalMesario', 'VOTA is still waiting for the finger');
	assert.ok(r.waited.polled, 'VOTA polled the reader on its own timer');
	assert.equal(r.after, 'comum::CMesarioRegistrado');
	assert.equal(r.error, null);
	console.log('PASS: the fingerprint prompt survives 10 s of VOTA polling; the correct finger then registers the mesário.');
} finally {
	b.close();
}
