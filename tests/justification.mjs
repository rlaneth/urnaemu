// Official session: a voter from another section justifies absence. VOTA's own justification
// code reads a freed string (fixed by the in-memory patch 'justificativa-uso-apos-liberacao');
// the failure was intermittent, so the justification is repeated.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const runs = Number(process.env.RUNS ?? 3), foreign = '742420012097';
const b = await connect({ evaluationTimeoutMs: 300000 });
const results = [];
try {
	for (let run = 0; run < runs; run++) {
		await b.session({ scenario: 'municipal-t1', official: true });
		assert.ok(await b.evaluate("urnaEmu.wasmPatches.applied.some(p=>p.id==='justificativa-uso-apos-liberacao')"), 'patch not applied');
		await b.evaluate(`qa.register({title:'010309782003',birth:'1960'},[true])`);
		const text = await b.evaluate(`(async()=>{
			const sleep=ms=>new Promise(r=>setTimeout(r,ms));
			for(const k of '${foreign}C')await urnaEmu.submitKey(k,'mesario');await sleep(800);
			if(!/não pertence/.test(urnaEmu.terminalText))throw Error('Expected the justification offer: '+urnaEmu.terminalText);
			await urnaEmu.submitKey('C','mesario');await sleep(500);
			for(const k of '1985C')await urnaEmu.submitKey(k,'mesario');await sleep(1000);
			if(urnaEmu.error)throw Error(urnaEmu.error);
			return urnaEmu.terminalText;
		})()`);
		assert.match(text, /AUSÊNCIA JUSTIFICADA/);
		results.push({ run: run + 1, terminal: text.split('\n').slice(0, 3).map((s) => s.trim()) });
	}
	fs.writeFileSync(evidencePath('justification.json'), JSON.stringify(results, null, 2) + '\n');
	console.log(`PASS: ${runs} justifications of a voter from another section ("AUSÊNCIA JUSTIFICADA").`);
} finally {
	b.close();
}
