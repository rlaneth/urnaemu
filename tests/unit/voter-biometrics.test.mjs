import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setVoters, parseVotersCsv, votersToCsv } from '#lib/engine/load/eleitorado-generator.js';
import { readEleitorado } from '#lib/engine/load/eleitorado.js';
import { VotaLoadFormat as F } from '#lib/engine/load/load-format.js';
import { isSimulatedBiometricElement } from '#lib/engine/load/simulated-biometrics.js';
import { addBiometricExports, BIOMETRIC_EXPORTS } from '#lib/engine/runtime/biometric-exports.js';
import { functionBodies } from '#lib/engine/runtime/wasm-patches.js';
const dir=new URL('../fixtures/bases/municipal-t1/dsk/fi/estatico/',import.meta.url);
const name=fs.readdirSync(dir).find(n=>n.endsWith('-el.dat'));
const original=new Uint8Array(fs.readFileSync(new URL(name,dir)));
const first=readEleitorado([[name,original]])[0];
test('per-voter biometric requirement survives BER round trip and can be removed',()=>{
 const input=[{...first,simulatedBiometrics:true},{...first,title:'700030012089',simulatedBiometrics:false}];
 const marked=setVoters(original,input);
 assert.equal(readEleitorado([[name,marked]])[0].simulatedBiometrics,true);
 assert.equal(readEleitorado([[name,marked]])[1].simulatedBiometrics,undefined);
 // The first record is the cloning template; its marker must not leak to new voters.
 const removed=setVoters(marked,input.map(v=>({...v,simulatedBiometrics:false})));
 assert.ok(readEleitorado([[name,removed]]).every(v=>!v.simulatedBiometrics));
 const element=F.parse(marked).children[2].children[0].children[1].children.at(-1);
 assert.equal(element.tag,48);assert.ok(isSimulatedBiometricElement(element));
 element.children[1].hex+='00';assert.equal(isSimulatedBiometricElement(element),false);
});
test('CSV preserves biometric choice and rejects ambiguous values',()=>{
 const voters=[{...first,simulatedBiometrics:true},{...first,title:'700030012089'}];
 assert.deepEqual(parseVotersCsv(votersToCsv(voters)),{voters,problems:[]});
 assert.equal(parseVotersCsv(votersToCsv(voters).replace(',sim\n',',perhaps\n')).problems.length,1);
 assert.deepEqual(parseVotersCsv('titulo,nome,nascimento\n010309782003,Teste,19600720').problems,[]);
});
test('biometric entry exports preserve all original WASM function bodies',()=>{
 const bytes=new Uint8Array(fs.readFileSync(new URL('../../static/vendor/wasm/vota_web_wasm.wasm',import.meta.url)));
 const snapshot=bytes.slice(),extended=addBiometricExports(bytes);
 assert.deepEqual(bytes,snapshot);
 const before=functionBodies(bytes),after=functionBodies(extended);
 assert.equal(after.size,before.size);
 for(const [index,range] of before){const next=after.get(index);assert.deepEqual(extended.subarray(next.start,next.end),bytes.subarray(range.start,range.end));}
 const exports=WebAssembly.Module.exports(new WebAssembly.Module(extended));
 for(const name of Object.keys(BIOMETRIC_EXPORTS))assert.ok(exports.some(e=>e.name===name&&e.kind==='function'));
});

test('native converter intercepts only the complete fixture marker',async()=>{
 const {installVoterBiometrics}=await import('#lib/engine/services/native-voter-biometrics.js');
 const {hookTableSlot}=await import('#lib/engine/runtime/table-hook.js');
 const {BIOMETRIC_MARKER,BIOMETRIC_SALT}=await import('#lib/engine/load/simulated-biometrics.js');
 const memory=new WebAssembly.Memory({initial:1}),table=new WebAssembly.Table({initial:6231,element:'anyfunc'}),v=new DataView(memory.buffer);
 let originalCalls=0;hookTableSlot(table,2609,4,()=>{originalCalls++});
 const previous=globalThis.Module;globalThis.Module={FS:{mkdirTree(){}}};
 try{
  const app={exports:{Cb:memory,Fb:table,emuBiometricResult(){}},tableMetadata:[{slot:2609,functionIndex:11419},{slot:4169,functionIndex:10465},{slot:6230,functionIndex:9500}],fingerprint:{state:{capturing:false}}};
  const adapter=installVoterBiometrics(app);
  table.get(6230)(1024);table.get(6230)(1024);assert.equal(adapter.state.randomDraws,2);
  const entity=2048,fields=2100,out=4096;v.setUint32(entity+8,fields,true);
  for(const [index,text] of [[1,BIOMETRIC_MARKER],[2,BIOMETRIC_SALT]]){
   const node=2200+index*32,data=2400+index*128;
   v.setUint32(fields+index*4,node,true);v.setUint32(node+8,data,true);v.setUint32(node+12,data+text.length,true);
   new Uint8Array(memory.buffer,data,text.length).set(new TextEncoder().encode(text));
  }
  table.get(2609)(out,0,entity,0);
  assert.equal(originalCalls,0);assert.equal(v.getUint8(out+32),1);assert.equal(v.getUint32(out+20,true),out+24);
  v.setUint8(2400+2*128,0);table.get(2609)(out,0,entity,0);assert.equal(originalCalls,1,'different salt must use original conversion');
  v.setUint32(2200+32+8,0,true);v.setUint32(2200+32+12,0,true);
  table.get(2609)(out,0,entity,0);assert.equal(originalCalls,2,'empty content must use original conversion');
  await assert.rejects(adapter.respond({},out,'correct'),/active native fingerprint prompt/);
 }finally{globalThis.Module=previous}
});
