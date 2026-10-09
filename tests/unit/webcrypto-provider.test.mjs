// Independent verification using Node/OpenSSL's X509 and signature APIs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {X509Certificate,verify} from 'node:crypto';
import {createWebCryptoProvider} from '#lib/engine/services/webcrypto-provider.js';
const provider=await createWebCryptoProvider(),certificate=new X509Certificate(provider.certificate);
assert(certificate.verify(certificate.publicKey),'Certificate self-signature');
assert.match(certificate.subject,/CN=UrnaEmu/);assert.match(certificate.subject,/L=Rio de Janeiro/);assert.match(certificate.subject,/emailAddress=contato@rlaneth.com/);
assert(Date.parse(certificate.validFrom)<=Date.now()&&Date.now()<Date.parse(certificate.validTo),'Certificate validity');
const original=new TextEncoder().encode('Native BU digest boundary'),digest=await provider.digest(original),signature=await provider.sign(digest);
assert.equal(digest.length,64);
assert(verify(null,digest,certificate.publicKey,signature),'Independent signature verification');
const changed=digest.slice();changed[0]^=1;
assert(!verify(null,changed,certificate.publicKey,signature),'Reject altered digest');
const other=await createWebCryptoProvider();
assert(!verify(null,digest,new X509Certificate(other.certificate).publicKey,signature),'Reject unrelated identity');
console.log(JSON.stringify({profile:provider.profile,certificateSelfSignature:true,independentSignatureVerification:true,tamperRejected:true,wrongKeyRejected:true,digestBytes:digest.length,signatureBytes:signature.length}));
const p521=await createWebCryptoProvider({profile:'P-521'}),ecCertificate=new X509Certificate(p521.certificate);
assert(ecCertificate.verify(ecCertificate.publicKey),'P-521 certificate self-signature');
assert.equal(ecCertificate.publicKey.asymmetricKeyDetails.namedCurve,'secp521r1');
const ecSignature=await p521.sign(digest);
assert(verify('sha512',digest,ecCertificate.publicKey,ecSignature),'Independent P-521 signature verification');
assert(!verify('sha512',changed,ecCertificate.publicKey,ecSignature),'P-521 rejects altered digest');
assert(await p521.verify(digest,ecSignature),'DER to WebCrypto roundtrip');
assert(!await p521.verify(digest,Uint8Array.of(48,0)),'Reject malformed signature');
assert(!await p521.verify(digest,new Uint8Array([...ecSignature,0])),'Reject trailing bytes');
assert((await p521.selfTest()).certificateSignatureValid);
console.log(JSON.stringify({profile:p521.profile,certificateSelfSignature:true,independentSignatureVerification:true,tamperRejected:true,signatureBytes:ecSignature.length}));
// Custom certificate fields, and reuse of a stored certificate with its key.
{
	const fields = { CN: 'Mesa 1', O: 'Cartório', C: 'BR', serial: '01ff', notBefore: '2026-01-01T00:00:00Z', notAfter: '2027-01-01T00:00:00Z' };
	const p = await createWebCryptoProvider({ profile: 'P-521', certificateFields: fields });
	const cert = new X509Certificate(Buffer.from(p.certificate));
	assert.match(cert.subject, /CN=Mesa 1/);
	assert.equal(cert.serialNumber, '01FF');
	assert.equal(new Date(cert.validTo).toISOString(), '2027-01-01T00:00:00.000Z');
	const again = await createWebCryptoProvider({ profile: 'P-521', privateJwk: await p.exportPrivateJwk(), certificate: p.certificate });
	assert.deepEqual(Buffer.from(again.certificate), Buffer.from(p.certificate));
	const other = await createWebCryptoProvider({ profile: 'P-521' });
	await assert.rejects(createWebCryptoProvider({ profile: 'P-521', privateJwk: await other.exportPrivateJwk(), certificate: p.certificate }), /não corresponde/);
}
