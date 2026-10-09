// Existing visible Chrome; restore original service and observe actual writes.
import {connect,evidencePath} from '../tools/screen-session.mjs';import path from 'node:path';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const s=await connect({evaluationTimeoutMs:300000});try{
 await s.session({scenario:'municipal-t1',flags:{persist:1}});
 const r=await s.evaluate(`(async()=>{const files=()=>['/dsk/fi/dinamico/trab1/rdv.dat','/dsk/fe/dinamico/trab1/rdv.dat'].map(path=>({path,bytes:Array.from(Module.FS.readFile(path))}));const before=files();let error,nativeStack;
 try{await qa.authorize(null);await qa.vote(0)}catch(e){error=String(e);nativeStack=String(e.cause?.stack||e.stack)}
 return {before,after:files(),error,nativeStack,state:await urnaEmu.readState(),service:urnaEmu.rdvSync.state,logs:urnaEmu.logs.slice(-30),terminal:urnaEmu.terminalText};})()`);
 const hash=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
 const files=r.after.map((f,i)=>({path:f.path,beforeBytes:r.before[i].bytes.length,afterBytes:f.bytes.length,beforeSha256:hash(r.before[i].bytes),afterSha256:hash(f.bytes),changed:hash(r.before[i].bytes)!==hash(f.bytes)}));
 assert(r.service,'Service installation');assert.equal(r.error,undefined,'Original native synchronization must complete');assert(files.every(f=>f.changed&&f.afterBytes>f.beforeBytes),'Both RDV copies must change');assert.equal(files[0].afterSha256,files[1].afterSha256,'Internal/external RDV must match');assert(r.terminal.includes('0001'),'Native counter must complete');const dir=path.dirname(evidencePath('native-rdv-sync/.'));for(const f of r.after)fs.writeFileSync(dir+'/'+(f.path.includes('/fi/')?'rdv-internal.dat':'rdv-external.dat'),Buffer.from(f.bytes));
 const report={persistenceVerified:true,testedAt:new Date().toISOString(),files,error:r.error,nativeStack:r.nativeStack,state:r.state,service:r.service,terminal:r.terminal,logs:r.logs};fs.writeFileSync(evidencePath('native-rdv-sync.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await s.capture('native-original-rdv-sync',{mode:'original native persistence service',result:files,blocker:r.error});
}finally{s.close()}
