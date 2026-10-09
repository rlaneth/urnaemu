// Training session through the UI API: two native ballots; VOTA's own counter must advance.
import fs from 'node:fs';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const browser = await connect({ evaluationTimeoutMs: 300000 });
try {
	await browser.session({ scenario: 'municipal-t1' });
	const result = await browser.evaluate(`(async()=>{
		const initial=await urnaEmu.readState();
		if(urnaEmu.session.voterEnabled)throw Error('Voter enabled before operator authorization ('+initial.state+')');
		const stages=[];
		for(let voter=0;voter<2;voter++){
			await qa.authorize(null);
			await qa.vote(voter);
			const native=await urnaEmu.readState();
			stages.push({voter:voter+1,state:native.state,done:native.done,operator:urnaEmu.experiments.state.active,terminal:urnaEmu.terminalText});
		}
		return {initial:{voterState:initial.state,voterDisabledBeforeAuthorization:true},stages,session:urnaEmu.session,events:urnaEmu.logs.filter(x=>x.includes('[native-operator-events]'))};
	})()`);
	if (!result.stages[0].terminal.includes('0001') || !result.stages[1].terminal.includes('0002')) throw Error('Native counters did not advance: ' + JSON.stringify(result.stages));
	fs.writeFileSync(evidencePath('training-session.json'), JSON.stringify({ testedAt: new Date().toISOString(), ...result }, null, 2) + '\n');
	await browser.capture('native-integrated-session-two-voters', { purpose: 'Two original native ballots without resetting or fabricating counters' });
	console.log('PASS: two native training ballots; terminal counter 0001 → 0002.');
} finally {
	browser.close();
}
