// Before 08:00 VOTA waits in CInicioVotacao and re-checks the clock on its own native tick.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 300000 });
try {
	await b.session({ scenario: 'municipal-t1', time: '07:55', boot: false });
	await b.evaluate('qa.boot()').catch(() => {}); // stops while VOTA waits for 08:00
	assert.match(await b.evaluate('urnaEmu.experiments.state.current?.name'), /CInicioVotacao/);
	await b.evaluate("(()=>{const p=urnaEmu.clock.electionDayPreset();urnaEmu.clock.apply({mode:'running',iso:p.iso})})()");
	let started = false;
	for (let i = 0; i < 20 && !started; i++) {
		await b.delay(500);
		started = !(await b.evaluate('urnaEmu.session.booting'));
	}
	assert.ok(started, 'VOTA did not start voting at 08:00');
	console.log('PASS: VOTA waits for 08:00 and starts on its own tick.');
} finally {
	b.close();
}
