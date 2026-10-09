// Native ballot, closure, crypto and MEMFS diff in a training session.
// TEST_HSM=1 (test vote key), TEST_GAP=1 (report fixture), PERSIST_RDV=1, CAPTURE_PAPER=1.
import {connect,evidencePath} from '../tools/screen-session.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash,X509Certificate,verify} from 'node:crypto';
// Ed25519 (emulator default key) or ECDSA P-521/SHA-512 with DER signatures (a test identity).
const verifySigned=(data,key,signature)=>key.asymmetricKeyType==='ec'?verify('sha512',data,{key,dsaEncoding:'der'},signature):verify(null,data,key,signature);
const withTestKey=process.env.TEST_HSM==='1',withTestGap=process.env.TEST_GAP==='1',persist=process.env.PERSIST_RDV==='1',paper=process.env.CAPTURE_PAPER==='1';
const name=paper?'native-paper':withTestGap?'native-output-fixture':withTestKey?'native-output-hsm':'native-output';
const s=await connect({evaluationTimeoutMs:300000}),dir=path.dirname(evidencePath(name+'/.'));
try{
 await s.session({scenario:'municipal-t1',flags:{testgap:withTestGap?1:0,testkey:withTestKey?1:0,persist:persist?1:0,crypto:1}});
 const result=await s.evaluate(`(async()=>{
  const snapshot=()=>{const files=[];function walk(p){let names;try{names=Module.FS.readdir(p)}catch{return}for(const n of names){if(n==='.'||n==='..')continue;const f=p+'/'+n,x=Module.FS.stat(f);if(Module.FS.isDir(x.mode))walk(f);else files.push({path:f,bytes:Array.from(Module.FS.readFile(f))})}}walk('/dsk/fi/dinamico');walk('/dsk/fe/dinamico');return files};
  const before=snapshot();
  await qa.authorize(null);await qa.vote(0);
  const afterBallot=snapshot();let error,nativeStack;qa.toClosingTime();
  try{for(const key of ['D','2','C','C','C'])await urnaEmu.pressTerminal(key);for(let i=0;i<5;i++)await urnaEmu.tick()}catch(e){error=String(e);nativeStack=String(e.cause?.stack||e.stack)}
  return {before,afterBallot,afterClosing:snapshot(),error,nativeStack,state:await urnaEmu.readState(),runtime:urnaEmu.native.state,testKey:urnaEmu.testKey?.state,testGap:urnaEmu.testGap,paper:urnaEmu.paperCapture?.snapshot(),crypto:urnaEmu.pkcs11.state,certificate:Array.from(urnaEmu.pkcs11.provider.certificate),terminal:urnaEmu.terminalText};
 })()`);
 const digest=b=>createHash('sha256').update(Buffer.from(b)).digest('hex');
 const inventory=files=>files.map(f=>({path:f.path,size:f.bytes.length,sha256:digest(f.bytes)}));
 const before=inventory(result.before),ballot=inventory(result.afterBallot),closing=inventory(result.afterClosing);
 const changed=(from,to)=>to.filter(f=>from.find(x=>x.path===f.path)?.sha256!==f.sha256);
 const changes={duringBallot:changed(before,ballot),duringClosing:changed(ballot,closing)};
 const rdvChanged=changes.duringBallot.some(f=>f.path.endsWith('/rdv.dat'));if(persist)assert(rdvChanged,'Original RDV service must persist ballot'); 
 assert(changes.duringBallot.some(f=>f.path.endsWith('/logd.dat')),'Native ballot must change/create application log');
 assert(result.crypto.calls.some(x=>x.method==='sign'),'Native report must call signer');
 assert(result.crypto.calls.some(x=>x.method==='public-material'),'Native report must request certificate');
 if(paper){
  assert.equal(result.paper.active,null,'Native paper capture must finish');
  const ops=result.paper.operations;assert(ops.some(o=>o.kind==='text'&&o.text==='Boletim de Urna'));
  const qrs=ops.filter(o=>o.kind==='qr'&&o.capture===0);assert.equal(qrs.length,2,'BU and certificate native QR bitmaps');
  for(const qr of qrs){assert.equal(qr.bytes.length,Math.ceil(qr.width*qr.width/8));const bit=(x,y)=>(qr.bytes[(y*qr.width+x)>>3]>>((y*qr.width+x)&7))&1;for(let i=0;i<qr.width;i++)for(let border=0;border<2;border++){assert.equal(bit(i,border),0);assert.equal(bit(border,i),0);assert.equal(bit(i,qr.width-1-border),0);assert.equal(bit(qr.width-1-border,i),0)}for(const [x,y] of [[2,2],[qr.width-9,2],[2,qr.width-9]])for(let row=0;row<7;row++)for(let col=0;col<7;col++)assert.equal(bit(x+col,y+row),Number(row===0||row===6||col===0||col===6||(row>=2&&row<=4&&col>=2&&col<=4)))}
  fs.writeFileSync(path.join(dir,'printer-operations.json'),JSON.stringify(result.paper,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'printed-report.txt'),ops.map(o=>o.kind==='text'?o.text+'\n':o.kind==='newline'?'\n':o.kind==='qr'?'[Native QR bitmap: '+o.width+' × '+o.height+']\n':'').join(''));
 }
 const cert=new X509Certificate(Buffer.from(result.certificate));assert(cert.verify(cert.publicKey));
 for(const signed of result.crypto.signatures)assert(verifySigned(Buffer.from(signed.input),cert.publicKey,Buffer.from(signed.signature)),'Independent native digest signature verification');
 assert.equal(result.runtime.maxActive,1);assert(result.runtime.sleeps>=1);if(withTestKey){assert(!result.error?.includes('IKernelHSM'),'HSM registration must resolve');assert(result.testKey.calls.some(x=>x.method==='session-secret'),'Native HSM method must run')}else assert.match(result.error,/IKernelHSM/);
 for(const f of result.afterClosing){const target=path.join(dir,f.path.slice(1));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(f.bytes))}
 fs.writeFileSync(path.join(dir,'synthetic-certificate.der'),Buffer.from(result.certificate));
 const report={testedAt:new Date().toISOString(),scenario:'municipal-t1',ballots:1,testIdentity:result.crypto.profile,before,afterBallot:ballot,afterClosing:closing,changes,error:result.error,nativeStack:result.nativeStack,state:result.state,runtime:result.runtime,testKey:result.testKey,testGap:result.testGap,paper:result.paper,crypto:result.crypto,rdvChangedDuringBallot:rdvChanged,independentSignatureVerification:true};
 fs.writeFileSync(evidencePath(name+'.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({changes,error:report.error,signatures:result.crypto.signatures.length,runtime:result.runtime},null,2));
 await s.capture(paper?'native-browser-printer-capture':withTestGap?'native-integrated-report-fixture-output':withTestKey?'native-integrated-test-key-output':'native-integrated-webcrypto-output',{mode:'native with simulated hardware identity',purpose:'Integrated native ballot and report: verified real crypto, changed logs; working RDV files compared against bootstrap',blocker:result.error});
}finally{s.close()}
