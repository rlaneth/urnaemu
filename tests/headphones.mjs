// Voter with audio: the mesário enables audio, VOTA speaks, the voter votes, and the terminal asks to remove
// the headphone. CONFIRMA there used to freeze the tab: VOTA busy-waited for the voter thread,
// which cannot run inside a native call here (patch 'fone-espera-thread-eleitor').
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 60000 });
const terminal = () => b.evaluate("urnaEmu.terminalText.split('\\n').slice(0,4).map(s=>s.trim()).filter(Boolean).join(' | ')");
const keys = async (k, device) => {
	for (const c of k) await b.evaluate(`urnaEmu.submitKey('${c}','${device}')`);
	await b.delay(1000);
	return terminal();
};
const steps = {};
try {
	await b.session({ scenario: 'municipal-t1' });
	assert.ok(await b.evaluate("urnaEmu.wasmPatches.applied.some(p=>p.id==='fone-espera-thread-eleitor')"), 'patch not applied');
	steps.options = await keys('D1', 'mesario');
	steps.confirmAudio = await keys('C', 'mesario');
	steps.audioOn = await keys('C', 'mesario');
	steps.plugIn = await keys('C', 'mesario');
	assert.match(steps.plugIn, /Coloque o fone/);
	steps.voting = await keys('C', 'mesario');
	await b.delay(3000);
	// VOTA speaks to this voter (the synthesizer is initialized in sessions; see adaptation 'voz-nas-sessoes').
	steps.sounds = await b.evaluate('urnaEmu.soundStats.calls');
	assert.ok(steps.sounds > 0, 'no speech for the audio voter');
	for (let i = 0; i < 10 && !/Retire o fone/.test(await terminal()); i++) await keys('BC', 'voter');
	steps.unplug = await terminal();
	assert.match(steps.unplug, /Retire o fone/);
	steps.afterConfirm = await keys('C', 'mesario'); // froze the tab before the patch
	await b.delay(1500);
	steps.after = await terminal();
	assert.equal(await b.evaluate('1+1'), 2, 'page responsive');
	assert.match(steps.after, /Votos: 0001/);
	await b.evaluate('qa.authorize(null)');
	await b.evaluate('qa.vote(0)');
	steps.nextVoter = await terminal();
	assert.match(steps.nextVoter, /Votos: 0002/);
	fs.writeFileSync(evidencePath('headphones.json'), JSON.stringify(steps, null, 2) + '\n');
	console.log('PASS: audio voter, "Retire o fone de ouvido" confirmed without freezing; next voter counted.');
} finally {
	b.close();
}
