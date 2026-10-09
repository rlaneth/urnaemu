// A failed keyboard test waits ("espere Ns") on a native tick, then repeats; passing it leads to
// the zerésima. Before tick delivery the retry never came.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 120000 });
const op = () => b.evaluate('urnaEmu.experiments.state.current?.name');
try {
	await b.session({ scenario: 'municipal-t1', boot: false });
	await b.evaluate("(async()=>{while(!urnaEmu.session.enabled)await new Promise(r=>setTimeout(r,50))})()");
	await b.evaluate("urnaEmu.submitKey('C','voter')");
	await b.delay(800);
	const wrong = await b.evaluate("urnaEmu.keyboardTestExpectedKey()==='9'?'8':'9'");
	await b.evaluate(`urnaEmu.submitKey('${wrong}','voter')`);
	await b.delay(1000);
	assert.match(await op(), /CTesteFalhou/);
	await b.evaluate("urnaEmu.submitKey('C','voter')");
	let retried = false;
	for (let i = 0; i < 40 && !retried; i++) {
		await b.delay(500);
		retried = /CTesteTeclado$/.test(await op());
	}
	assert.ok(retried, 'keyboard test was not repeated');
	for (let i = 0; i < 13; i++) await b.evaluate("urnaEmu.submitKey(urnaEmu.keyboardTestExpectedKey()??'C','voter')");
	await b.delay(1000);
	assert.match(await op(), /Zeresima/);
	console.log('PASS: failed keyboard test waits, repeats and, once passed, leads to the zerésima.');
} finally {
	b.close();
}
