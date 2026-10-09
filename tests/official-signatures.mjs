// Official media signatures (.vsc). This VOTA build does not check them, so the emulator does:
// generated media covers every file and verifies; tampered or unsigned official media is refused.
import assert from 'node:assert/strict';
import { connect } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 300000 });
try {
	await b.load('municipal-t1');
	const r = await b.evaluate(`(async()=>{
		const e=urnaEmu.loadEditor,F=urnaEmu.lib.VotaLoadFormat,S=urnaEmu.lib.VotaLoadSignatures;
		if(!e.provider)await e.useKey();
		const p=await e.generateOfficial();
		await S.verifyAll(p);
		const out={uncovered:S.uncovered(p),signed:p.inputSignatures.paths.length};
		// Tampered file, stale .vsc.
		const t=structuredClone(p),f=t.files.find(x=>/-cp\\.dat$/.test(x.path)),bytes=F.unbase64(f.data);
		bytes[bytes.findIndex((x,i)=>x===0x45&&bytes[i+1]===0x4d&&bytes[i+2]===0x55)]=0x46;f.data=F.base64(bytes);delete t.signature;
		out.tampered=await e.importPackage(t).then(()=>'accepted',err=>String(err.message));
		// Official media without file signatures.
		const u=structuredClone(p);delete u.inputSignatures;delete u.signature;
		await e.importPackage(u);
		out.unsigned=await e.apply().then(()=>'applied',err=>String(err.message));
		return out;
	})()`);
	assert.deepEqual(r.uncovered, [], 'every file of the official media is signed');
	assert.ok(r.signed > 20);
	assert.match(r.tampered, /Resumo \(digest\) do arquivo não confere/);
	assert.match(r.unsigned, /sem assinaturas/);
	console.log(`PASS: ${r.signed} catalogs cover every file; tampered and unsigned official media are refused.`);
} finally {
	b.close();
}
