// The urna keypad and the terminal keypad are separate devices: terminal keys must never
// reach the voter executor, and urna keys must never act on the terminal's screens.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 300000 });
try {
	await b.session({ scenario: 'municipal-t1' });
	const result = await b.evaluate(`(async()=>{
		const sleep=ms=>new Promise(r=>setTimeout(r,ms));
		// Typed digits would appear in the number boxes on the urna screen (native 1280×800
		// coordinates; boxes 2–5, since the first one blinks as the cursor), and VOTA logs what
		// it does: compare both.
		const screen=async()=>{const c=document.getElementById('uenux-screen');(window.keypadShots??=[]).push(c.toDataURL('image/png'));const d=c.getContext('2d').getImageData(88,188,276,88).data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',d))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16)};
		const voter=async()=>{const s=await urnaEmu.readState();return {state:s.state,cargo:s.cargo?.name??null,guide:s.guide,screen:await screen(),logd:(urnaEmu.logd?.entries||[]).length}};
		const out={};
		// 1. Urna keys cannot authorize a voter: CONFIRMA on the urna while the terminal asks for one.
		for(const k of 'CCC')await urnaEmu.submitKey(k,'voter');
		await sleep(1500);
		out.urnaKeysBeforeAuthorization={enabled:urnaEmu.session.voterEnabled,terminal:urnaEmu.terminalText.split('\\n')[4]};
		// 2. Terminal keys cannot vote: authorize, then type a candidate and CONFIRMA on the terminal.
		await qa.authorize(null);
		await sleep(1500);
		const before=await voter();
		for(const k of '9100')await urnaEmu.submitKey(k,'mesario').catch(e=>out.terminalRejected=String(e.message));
		await urnaEmu.submitKey('C','mesario').catch(e=>out.terminalRejected=String(e.message));
		await sleep(1500);
		out.terminalKeysDuringBallot={before,after:await voter(),enabled:urnaEmu.session.voterEnabled};
		// 3. The voter can still finish on the urna, and the vote is counted.
		await qa.vote(0);await sleep(2000);
		out.afterBallot={terminal:urnaEmu.terminalText.split('\\n')[1].trim(),keys:urnaEmu.dev.readKeyQueue()};
		out.shots=window.keypadShots;
		return out;
	})()`);
	result.shots?.forEach((url, i) => fs.writeFileSync(evidencePath(`keypads-${i}.png`), Buffer.from(url.split(',')[1], 'base64')));
	delete result.shots;
	fs.writeFileSync(evidencePath('keypads.json'), JSON.stringify(result, null, 2) + '\n');
	assert.equal(result.urnaKeysBeforeAuthorization.enabled, false, 'urna CONFIRMA authorized a voter');
	assert.deepEqual(result.terminalKeysDuringBallot.after, result.terminalKeysDuringBallot.before, 'terminal keys changed the ballot');
	assert.equal(result.terminalKeysDuringBallot.enabled, true);
	assert.match(result.afterBallot.terminal, /0001/);
	assert.deepEqual([result.afterBallot.keys.voter.length, result.afterBallot.keys.mesario.length], [0, 0]);
	console.log('PASS: urna keys cannot authorize a voter; terminal keys cannot touch the ballot; the vote is counted.');
} finally {
	b.close();
}
