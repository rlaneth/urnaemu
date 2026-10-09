// Async native runtime: report signing suspends VOTA (JSPI) one call at a time, and a
// suspended call can be cancelled without letting a second native call run.
import fs from 'node:fs';
import { createPublicKey, verify } from 'node:crypto';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const browser = await connect({ evaluationTimeoutMs: 300000 });
const results = { testedAt: new Date().toISOString() };
try {
	// WebCrypto signing without the test vote key: closing then stops at the missing HSM.
	await browser.session({ scenario: 'municipal-t1', flags: { testkey: 0 } });
	results.closure = await browser.evaluate(`(async()=>{
		await qa.authorize(null);await qa.vote(0);
		qa.toClosingTime();
		let error=null;try{for(const key of 'D2CCC')await urnaEmu.pressTerminal(key);for(let i=0;i<5;i++)await urnaEmu.tick();}catch(e){error=String(e);}
		return {error,native:{...urnaEmu.native.state},session:{...urnaEmu.session},state:await urnaEmu.readState(),crypto:urnaEmu.pkcs11.state,spki:Array.from(urnaEmu.pkcs11.provider.spki)};
	})()`);
	if (results.closure.native.maxActive !== 1 || results.closure.native.sleeps < 1 || !results.closure.crypto.signatures.length) throw Error('Async native signing regression failed: '+JSON.stringify({native:results.closure.native,signatures:results.closure.crypto.signatures.length,error:results.closure.error,terminal:results.closure.session?.error}));
	const publicKey = createPublicKey({ key: Buffer.from(results.closure.spki), format: 'der', type: 'spki' });
	// Ed25519 (emulator default key) or ECDSA P-521/SHA-512 with DER signatures (a test identity).
	const ec = publicKey.asymmetricKeyType === 'ec';
	results.closure.independentSignatureVerified = results.closure.crypto.signatures.every((s) =>
		verify(ec ? 'sha512' : null, Buffer.from(s.input), ec ? { key: publicKey, dsaEncoding: 'der' } : publicKey, Buffer.from(s.signature))
	);
	if (!results.closure.independentSignatureVerified || !results.closure.error?.includes('IKernelHSM')) throw Error('Expected verified signature and HSM dependency: ' + results.closure.error);

	await browser.load('municipal-t1');
	results.cancel = await browser.evaluate(`(async()=>{
		await urnaEmu.experiments.start('zeresima');await urnaEmu.press('C');await urnaEmu.press('B');await urnaEmu.press('5');
		let pending=urnaEmu.press('C').then(()=>({completed:true}),e=>({error:String(e)}));
		const deadline=Date.now()+10000;while(!urnaEmu.native.state.suspended){if(Date.now()>deadline)throw Error('Expected native suspension');await new Promise(r=>setTimeout(r,10));}
		let inspection=urnaEmu.native.ccall('votaGetStateJson','string').then(()=>({completed:true}),e=>({error:String(e)}));
		const queuedBeforeCancel=urnaEmu.native.state.queued;urnaEmu.native.cancel();
		return {queuedBeforeCancel,pending:await pending,inspection:await inspection,native:{...urnaEmu.native.state}};
	})()`);
	if (!results.cancel.native.cancelled || results.cancel.native.maxActive !== 1 || results.cancel.queuedBeforeCancel < 1 || !results.cancel.inspection.error) throw Error('Cancellation or serialization failed: ' + JSON.stringify(results.cancel));
	fs.writeFileSync(evidencePath('async-runtime.json'), JSON.stringify(results, null, 2) + '\n');
	console.log('PASS: native signing suspends one call at a time (signatures verified); a suspended call cancels cleanly.');
} finally {
	browser.close();
}
