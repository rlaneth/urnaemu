import fs from 'node:fs';
import assert from 'node:assert/strict';
import {X509Certificate,verify} from 'node:crypto';
import {VotaLoadFormat} from '#lib/engine/load/load-format.js';
import {VotaLoadSignatures} from '#lib/engine/load/load-signature.js';
import {createWebCryptoProvider} from '#lib/engine/services/webcrypto-provider.js';
import {evidencePath} from './evidence.mjs';
const F=VotaLoadFormat,root=new URL('../fixtures/bases/municipal-t1/dsk/fi/',import.meta.url),files=[];let parsed=0;
for(const name of fs.readdirSync(new URL('estatico/',root))){const b=new Uint8Array(fs.readFileSync(new URL('estatico/'+name,root)));try{const t=F.parse(b);assert.deepEqual(F.encode(t),b);parsed++;}catch(e){if(e.code==='ERR_ASSERTION')throw e;}files.push({path:'/dsk/fi/estatico/'+name,data:F.base64(b)})}
files.push({path:'/dsk/fi/serialv.dat',data:F.base64(fs.readFileSync(new URL('serialv.dat',root)))});
assert(parsed>30);
const cp=files.find(f=>f.path.endsWith('-cp.dat')),tree=F.parse(F.unbase64(cp.data));tree.children[1].text='Eleição São João';assert.equal(F.parse(F.encode(tree)).children[1].text,'Eleição São João');assert.throws(()=>F.textBytes('😀'));
const p={format:'vota-emulator-load/1',scenario:'municipal-t1',config:{fase:'te',pe:2400,turno:1,uf:'ac',municipio:1,zona:1,secao:1},files};
for(const profile of ['P-521','Ed25519']){const key=await createWebCryptoProvider({profile}),jwk=await key.exportPrivateJwk(),imported=await createWebCryptoProvider({profile,privateJwk:jwk});assert.deepEqual(imported.spki,key.spki);await imported.selfTest();await F.signPackage(p,imported);assert.equal((await F.verifyPackage(p,key.spki)).trusted,true);const cert=new X509Certificate(imported.certificate);assert(verify(profile==='P-521'?'sha512':null,F.canonical(p),cert.publicKey,F.unbase64(p.signature.value)));const changed=structuredClone(p);changed.config.secao=2;assert.equal((await F.verifyPackage(changed)).valid,false);const alteredCertificate=structuredClone(p);alteredCertificate.signature.certificate='AAAA';assert.equal((await F.verifyPackage(alteredCertificate)).valid,false);const missing=structuredClone(p);missing.files.pop();assert.throws(()=>F.validatePackage(missing));}
const bad=structuredClone(p);bad.files[0].path='/dsk/fi/../../etc/x';assert.throws(()=>F.validatePackage(bad));bad.files[0].path=bad.files[1].path;assert.throws(()=>F.validatePackage(bad));
console.log(JSON.stringify({parsedRoundtrips:parsed,files:files.length,cp1252:true,importedKeys:true,independentSignatureVerification:true,tamperRejected:true,pathValidation:true}));

const provider=await createWebCryptoProvider({profile:'P-521'}),working=new Map(files.map(f=>[f.path,F.unbase64(f.data)]));
const signedInputs=await VotaLoadSignatures.resign(working,provider);
const media={...p,files:[...signedInputs.files].map(([path,b])=>({path,data:F.base64(b)})),inputSignatures:{profile:'emulator-p521-entity/1',paths:signedInputs.paths,omitted:signedInputs.omitted}};
delete media.signature;await F.signPackage(media,provider);
assert.equal((await VotaLoadSignatures.verifyAll(media)).verified,signedInputs.paths.length);
const changedInput=structuredClone(media);const ca=changedInput.files.find(f=>f.path.endsWith('-ca.dat'));const caBytes=F.unbase64(ca.data);caBytes[caBytes.length-1]^=1;ca.data=F.base64(caBytes);await assert.rejects(VotaLoadSignatures.verifyAll(changedInput));
// Independently verify every leaf and envelope signature using OpenSSL.
for(const path of signedInputs.paths){const root=F.parse(signedInputs.files.get(path)),c=root.children;const cert=new X509Certificate(F.unhex(c[4].hex));const content=F.unhex(c[3].hex);const tuple=c[2].children[3].children;assert(verify('sha512',F.unhex(tuple[1].hex),cert.publicKey,F.unhex(tuple[2].hex)));for(const entry of F.parse(content).children[0].children){const tuple=entry.children[1].children;assert(verify('sha512',F.unhex(tuple[1].hex),cert.publicKey,F.unhex(tuple[2].hex)));}}
fs.writeFileSync(evidencePath('signed-input-sample.vsc'),signedInputs.files.get(signedInputs.paths[0]));
console.log(JSON.stringify({inputSignatureEnvelopes:signedInputs.paths.length,missingCatalogEntries:signedInputs.omitted.length,inputTamperRejected:true,independentInputSignatureVerification:true}));
