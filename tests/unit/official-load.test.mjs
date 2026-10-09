import fs from 'node:fs';import assert from 'node:assert/strict';
import {VotaLoadFormat} from '#lib/engine/load/load-format.js';
import {VotaLoadSignatures} from '#lib/engine/load/load-signature.js';
import {generateOfficialLoad} from '#lib/engine/load/official-load.js';
import {createWebCryptoProvider} from '#lib/engine/services/webcrypto-provider.js';
import {evidencePath} from './evidence.mjs';
const F=VotaLoadFormat,provider=await createWebCryptoProvider({profile:'P-521'}),manifest=JSON.parse(fs.readFileSync(new URL('../../static/vendor/wasm/bases/manifest.json',import.meta.url))),reports=[];
for(const s of manifest.scenarios){const root=new URL('../fixtures/bases/'+s.id+'/dsk/fi/',import.meta.url),files=[];
 for(const name of fs.readdirSync(new URL('estatico/',root)))files.push({path:'/dsk/fi/estatico/'+name,data:F.base64(fs.readFileSync(new URL('estatico/'+name,root)))});
 files.push({path:'/dsk/fi/serialv.dat',data:F.base64(fs.readFileSync(new URL('serialv.dat',root)))});
 const source={format:'vota-emulator-load/1',scenario:s.id,config:{fase:'te',pe:s.pe,turno:s.turno,uf:s.uf,municipio:s.municipio,zona:s.zona,secao:s.secao},files};const before=JSON.stringify(source),p=await generateOfficialLoad(source,provider);assert.equal(JSON.stringify(source),before);assert.equal(p.config.fase,'of');assert.equal((await F.verifyPackage(p,provider.spki)).trusted,true);const verified=await VotaLoadSignatures.verifyAll(p);assert(verified.verified>0);
 for(const f of p.files){assert(!/\/t\d{5}|scueconf-t|infomidia-fv-\d-t/.test(f.path));if(f.path.endsWith('.pid'))assert.equal(F.parse(F.unbase64(f.data)).children[1].children[1].hex,'02');if(/infomidia.*\.dat$/.test(f.path))assert.equal(F.parse(F.unbase64(f.data)).children[1].hex,'02');}
 const changed=structuredClone(p);changed.generation.loadTimestamp='20000101T000000';assert.equal((await F.verifyPackage(changed)).valid,false);await assert.rejects(generateOfficialLoad(p,provider));
 reports.push({scenario:s.id,files:p.files.length,inputSignatures:verified.verified,electionDate:p.generation.electionDate,omitted:p.inputSignatures.omitted.length});
}
fs.writeFileSync(evidencePath('official-load-generation-verification.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));
