// Test identities: created explicitly with chosen certificate fields, kept across visits, and used
// unchanged (same certificate bytes) to sign the official media and the session's results.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { connect, evidencePath } from '../tools/screen-session.mjs';
import { QA_PAGE } from '../tools/qa-page.mjs';

const b = await connect({ evaluationTimeoutMs: 300000 });
const fields = { CN: 'Mesa de Teste 0001', O: 'Cartório Fictício', OU: 'Teste UrnaEmu', L: 'Rio Branco', ST: 'AC', C: 'BR', emailAddress: 'teste@example.org', serial: '0a1b2c3d', notBefore: '2026-01-01T00:00:00Z', notAfter: '2027-12-31T23:59:59Z' };
try {
	// Start with no identity chosen: generating official media is refused (never created silently).
	await b.load('municipal-t1');
	await b.evaluate('(async()=>(await urnaEmu.lib.identities()).setActiveIdentity(null))()');
	await b.load('municipal-t1');
	const refused = await b.evaluate("urnaEmu.loadEditor.provider ? 'had provider' : urnaEmu.loadEditor.generateOfficial().then(()=>'generated',e=>String(e.message))");
	const created = await b.evaluate(`(async()=>{const m=await urnaEmu.lib.identities();const r=await m.createIdentity(${JSON.stringify(fields)},'Identidade do teste');await urnaEmu.loadEditor.useIdentity(r);return {id:r.id,certificate:r.certificate}})()`);
	await b.evaluate('urnaEmu.loadEditor.generateOfficial()');
	await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
	await b.delay(1200);
	await b.ready();
	const session = await b.evaluate("({identity:urnaEmu.loadEditor.identity,certificate:btoa(String.fromCharCode(...urnaEmu.loadSigningProvider.certificate))})");
	assert.equal(session.identity.id, created.id);
	assert.equal(session.certificate, created.certificate, 'session must sign with the stored certificate');
	// Close the session so VOTA signs its results, then check the signatures against the certificate.
	await b.evaluate(QA_PAGE);
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");
	await b.evaluate('qa.boot()');
	await b.evaluate("qa.register({title:'010309782003',birth:'1960'},[true])");
	await b.evaluate("qa.authorize({title:'010309782003',birth:'1960'})");
	await b.evaluate('qa.vote(0)');
	await b.evaluate("qa.close({title:'010309782003',closeTime:'2026-10-04T20:05:00.000Z'})");
	const pkcs = await b.evaluate("({certificate:btoa(String.fromCharCode(...urnaEmu.pkcs11.provider.certificate)),signatures:urnaEmu.pkcs11.state.signatures.length})");
	assert.equal(pkcs.certificate, created.certificate, 'results signed with another certificate');
	assert.ok(pkcs.signatures > 0, 'no result signatures');
	const cert = new X509Certificate(Buffer.from(created.certificate, 'base64'));
	assert.match(cert.subject, /CN=Mesa de Teste 0001/);
	assert.equal(cert.serialNumber.toLowerCase(), '0a1b2c3d');
	const report = { refused, subject: cert.subject, serial: cert.serialNumber, validFrom: cert.validFrom, validTo: cert.validTo, resultSignatures: pkcs.signatures };
	fs.writeFileSync(evidencePath('identity.json'), JSON.stringify(report, null, 2) + '\n');
	assert.match(String(refused), /identidade/i);
	console.log('PASS: identity chosen explicitly; its certificate signs the official media and the session results.');
} finally {
	b.close();
}
