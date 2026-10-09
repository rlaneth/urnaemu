// End to end: the voter simulator casts N mixed ballots in a training session, the session
// is closed, and the BU printed by VOTA must match the simulator's expected tally exactly.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';

const count = Number(process.env.VOTERS ?? 5);
const b = await connect({ evaluationTimeoutMs: 900000 });
try {
	// PACE (ms per key) and SPEED (printer) make the run watchable in a visible browser.
	await b.session({ scenario: 'geral-t1', speed: process.env.SPEED ?? 'instant' });
	const sim = await b.evaluate(`(async()=>{await urnaEmu.simulator.start({count:${count},seed:7,pace:${Number(process.env.PACE ?? 0)}});const s=urnaEmu.simulator.state;return {cast:s.cast,error:s.error,tally:s.tally}})()`);
	assert.equal(sim.error, null, sim.error);
	assert.equal(sim.cast, count);
	await b.evaluate('qa.close(null)');
	// Training sessions print the BU (VOTA's report) without writing result files.
	const printed = await b.evaluate(`(async()=>{await urnaEmu.printer.waitForPaper();const {parsePrintedBu}=await urnaEmu.lib.printedBu();return parsePrintedBu(urnaEmu.paperCapture.state.operations.filter(o=>o.kind==='text').map(o=>o.text))})()`);
	assert.ok(printed.length, 'No printed BU found');
	const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
	const mismatches = [];
	for (const [cargo, counts] of Object.entries(sim.tally)) {
		const office = printed.find((o) => o.key === norm(cargo)) ?? printed.find((o) => o.key.startsWith(norm(cargo.replace(/\s*-.*$/, ''))) && !o.used);
		if (!office) {
			mismatches.push(`office not found on paper: ${cargo} (paper: ${printed.map((o) => o.name).join(', ')})`);
			continue;
		}
		office.used = true;
		const expect = { candidates: {}, legenda: {}, brancos: 0, nulos: 0 };
		for (const [choice, n] of Object.entries(counts)) {
			if (choice === 'Branco') expect.brancos += n;
			else if (choice === 'Nulo') expect.nulos += n;
			else if (choice.startsWith('Legenda')) expect.legenda[Number(choice.split(' ')[1])] = (expect.legenda[Number(choice.split(' ')[1])] ?? 0) + n;
			else expect.candidates[Number(choice.split(' ')[0])] = (expect.candidates[Number(choice.split(' ')[0])] ?? 0) + n;
		}
		const got = { candidates: office.candidates, legenda: Object.fromEntries(Object.entries(office.legenda).filter(([, n]) => n)), brancos: office.brancos, nulos: office.nulos };
		try {
			assert.deepEqual(got, expect);
		} catch {
			mismatches.push(`${cargo}: paper ${JSON.stringify(got)} vs simulator ${JSON.stringify(expect)}`);
		}
		// Offices with several seats (e.g. two Senate seats) get one vote per seat per voter.
		const cast = Object.values(counts).reduce((n, v) => n + v, 0);
		if (office.apurado !== cast) mismatches.push(`${cargo}: Total Apurado ${office.apurado} ≠ ${cast}`);
	}
	assert.deepEqual(mismatches, []);
	console.log(`PASS: ${count} simulated voters; the printed BU matches the expected tally for ${Object.keys(sim.tally).length} offices.`);
} finally {
	b.close();
}
