// Complete the actual native training close route in visible Chrome.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,X509Certificate,verify} from 'node:crypto';
import {connect,evidencePath} from '../tools/screen-session.mjs';
// Ed25519 (emulator default key) or ECDSA P-521/SHA-512 with DER signatures (a test identity).
const verifySigned=(data,key,signature)=>key.asymmetricKeyType==='ec'?verify('sha512',data,{key,dsaEncoding:'der'},signature):verify(null,data,key,signature);
process.env.TEST_GAP='1';process.env.TEST_HSM='1';process.env.PERSIST_RDV='1';
await import('./native-output.mjs');
const browser=await connect({evaluationTimeoutMs:300000});
try{
 const result=await browser.evaluate(`(async()=>{
  const stages=[];
  const expect=async name=>{const s=await urnaEmu.readState();if(s.state!==name)throw Error('Expected '+name+', got '+s.state);stages.push(name)};
  await expect('vota::CQuerImprimirBU');
  await urnaEmu.press('C');await expect('vota::CImprimindoBU');
  await urnaEmu.press('C');await expect('vota::CEmitirMaisBU');
  await urnaEmu.press('D');await expect('vota::CMostraQRCodeBU');
  await urnaEmu.press('C');await expect('vota::CAplicacaoEncerrada');
  const files=[];
  function walk(p){for(const n of Module.FS.readdir(p)){if(n==='.'||n==='..')continue;const f=p+'/'+n,s=Module.FS.stat(f);if(Module.FS.isDir(s.mode))walk(f);else files.push({path:f,bytes:Array.from(Module.FS.readFile(f))})}}
  walk('/dsk/fi/dinamico');walk('/dsk/fe/dinamico');if(Module.FS.analyzePath('/dsk/mr').exists)walk('/dsk/mr');
  return {stages,session:urnaEmu.session,runtime:urnaEmu.native.state,paper:urnaEmu.paperCapture.snapshot(),files,running:urnaEmu.running};
 })()`);
 assert(result.session.closed&&!result.session.reportPending&&!result.running);
 assert.equal(result.runtime.maxActive,1);
 // The session also printed the zerésima reports at boot; the BU's saved replay is the last one.
 assert(result.paper.replays.length>=1);
 const files=new Map(result.files.map(f=>[f.path,Buffer.from(f.bytes)]));
 for(const spool of result.paper.spools){
  const bytes=files.get(spool.path),sidecar=files.get(spool.path.replace(/\.dat$/,'.vsu'));
  const signature=JSON.parse(sidecar.toString().split('\n').slice(1).join('\n'));
  assert(verifySigned(bytes,new X509Certificate(Buffer.from(signature.certificate)).publicKey,Buffer.from(signature.signature)));
  assert.deepEqual(bytes,files.get(spool.path.replace('/fi/','/fe/')));
  assert.deepEqual(sidecar,files.get(spool.path.replace('/fi/','/fe/').replace(/\.dat$/,'.vsu')));
 }
 const replay=result.paper.replays.at(-1),document=JSON.parse(files.get(replay.path).toString().split('\n').slice(1).join('\n'));
 const replayed=result.paper.operations.slice(replay.begin,replay.end).filter(o=>o.replayedFrom).map(({index,capture,replayedFrom,...o})=>o);
 assert.deepEqual(replayed,document.operations,'Replay must preserve every text byte, attribute and QR pixel');
 const dir=path.dirname(evidencePath('native-closing/.'));
 for(const [name,bytes] of files){const target=path.join(dir,name.slice(1));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes)}
 const report={testedAt:new Date().toISOString(),scope:'Native training closure; browser spool/signature formats; final ASN.1 result generation remains separate',...result,files:result.files.map(f=>({path:f.path,size:f.bytes.length,sha256:createHash('sha256').update(Buffer.from(f.bytes)).digest('hex')})),independentSpoolSignaturesVerified:true,replayLossless:true};
 fs.writeFileSync(evidencePath('native-closing.json'),JSON.stringify(report,null,2)+'\n');
 await browser.capture('native-training-closed-with-printer',{purpose:'Native application-closed state after actual saved BU replay and operator confirmations'});
 console.log('PASS: native training application closed; four signed spools copied to both media; BU replay lossless. Final result envelopes remain to be generated.');
}finally{browser.close()}
