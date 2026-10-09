// Candidates and parties edited in the load media: a new party with a Vereador candidate and a
// Prefeito ticket (with vice), a removed candidate and a renamed one. VOTA lists them, the voter
// votes for the new ones, and the official BU records and verifies those votes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const b = await connect({ evaluationTimeoutMs: 600000 });
try {
	await b.load('municipal-t1');
	await b.evaluate(`(async()=>{const e=urnaEmu.loadEditor,{placeholderPhoto}=await urnaEmu.lib.candidatePhoto();
		const model=e.candidates(),[el]=model,pref=el.offices.find(o=>o.code===11),ver=el.offices.find(o=>o.code===13);
		const code=Number(e.nextCandidateCode(model));
		const person=(c,nome,genero,ordem=null)=>({code:String(c),nome,nomeUrna:nome,fonetico:'',nascimento:'19800101',genero,situacao:12,ordem,extra:{int:'00',flag:'00'}});
		el.parties.push({number:77,sigla:'PTst',nome:'Partido de Teste'});
		ver.candidacies=ver.candidacies.filter(c=>c.number!==91001);
		ver.candidacies.push({party:77,number:77123,titular:person(code,'Nova Vereadora',4),label:'',suplentes:null,groupTail:'3000'});
		pref.candidacies.push({party:77,number:77,titular:person(code+1,'Nova Prefeita',4),label:'',suplentes:[person(code+2,'Novo Vice',2,1)],groupTail:'3000'});
		pref.candidacies.find(c=>c.number===91).titular.nomeUrna='Nado Livre';
		const photos=new Map([[String(code),await placeholderPhoto('Nova Vereadora')],[String(code+1),await placeholderPhoto('Nova Prefeita')],[String(code+2),await placeholderPhoto('Novo Vice','suplente')]]);
		await e.setCandidates(model,photos);
		if(!e.provider)await e.useKey();await e.generateOfficial()})()`);
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
	await b.evaluate('qa.boot()');
	const voter = { title: '010309782003', birth: '1960' };
	await b.evaluate(`qa.register(${JSON.stringify(voter)},[true])`);
	await b.evaluate(`qa.authorize(${JSON.stringify(voter)})`);
	// Vote: Vereador 77123, then Prefeito 77; capture VOTA's candidate list and screens.
	const seen = await b.evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms)),out=[];
		for(let i=0;i<4;i++){const s=await urnaEmu.readState();if(s.state!=='vota::CEleitorVotando'||!s.cargo)break;
			const n=/Vereador/i.test(s.cargo.name)?'77123':'77';
			for(const k of n){await urnaEmu.submitKey(k,'voter');await sleep(250)}
			await sleep(600);const shot=document.getElementById('uenux-screen').toDataURL('image/png');
			out.push({cargo:s.cargo.name,candidates:s.candidates.map(c=>c.number+' '+(c.name??c.nome??'')),shot});
			await urnaEmu.submitKey('C','voter');await sleep(1200)}
		for(let i=0;i<40&&urnaEmu.session.voterEnabled;i++){await urnaEmu.tick();await sleep(50)}
		return out})()`);
	seen.forEach((s, i) => fs.writeFileSync(evidencePath(`candidates-${i}.png`), Buffer.from(s.shot.split(',')[1], 'base64')));
	console.log(seen.map((s) => `${s.cargo}: ${s.candidates.join(', ')}`).join('\n'));
	const ver = seen.find((s) => /Vereador/i.test(s.cargo)), pref = seen.find((s) => /Prefeito/i.test(s.cargo));
	assert.ok(ver.candidates.some((c) => c.startsWith('77123')), 'new Vereador listed by VOTA');
	assert.ok(!ver.candidates.some((c) => c.startsWith('91001')), 'removed Vereador not listed');
	assert.ok(pref.candidates.some((c) => c.startsWith('77')), 'new Prefeito listed by VOTA');
	await b.evaluate(`qa.close(${JSON.stringify({ ...voter, closeTime: '2026-10-04T20:05:00.000Z' })})`);
	const result = await b.evaluate(`(async()=>{const fs=Module.FS;const f='/dsk/fi/dinamico/trab1/'+fs.readdir('/dsk/fi/dinamico/trab1').find(n=>/-bu\\.dat$/.test(n));const r=await urnaEmu.verifyResults(f);return {ok:r.ok,failed:r.checks.filter(c=>!c.ok),votes:r.elections.flatMap(e=>e.offices.flatMap(o=>o.votes.map(v=>({cargo:o.code,...v}))))}})()`);
	console.log(JSON.stringify(result.votes));
	assert.deepEqual(result.failed, []);
	assert.ok(result.votes.some((v) => v.codigo === 77123 && v.quantidade === 1), 'BU has the vote for 77123');
	assert.ok(result.votes.some((v) => v.codigo === 77 && v.quantidade === 1), 'BU has the vote for 77');
	console.log('PASS: VOTA lists the edited candidates; votes for the new ones are in the verified official BU.');
} finally {
	b.close();
}
