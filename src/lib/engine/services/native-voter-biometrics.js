import { hookTableSlot } from '../runtime/table-hook.js';
import { BIOMETRIC_MARKER, BIOMETRIC_SALT } from '../load/simulated-biometrics.js';

// Synthetic enrollment and chosen recognition outcomes. The native decoder, prompts,
// retries, fallback, eligibility checks and attendance writers remain in control.
export function installVoterBiometrics(app) {
 if(app.voterBiometrics)return app.voterBiometrics;
 const table=app.exports.Fb,view=()=>new DataView(app.exports.Cb.buffer);
 const check=(p,n)=>{if(!Number.isInteger(p)||p<1024||p+n>view().byteLength)throw Error('Invalid voter biometric ABI range')};
 const get=p=>{check(p,4);return view().getUint32(p,true)};
 const bytes=(p,n)=>{check(p,n);return new Uint8Array(view().buffer,p,n)};
 for(const [slot,index] of [[2609,11419],[4169,10465],[6230,9500]])if(app.tableMetadata.find(m=>m.slot===slot)?.functionIndex!==index)throw Error('Unsupported voter biometric ABI');
 if(!app.exports.emuBiometricResult)throw Error('Native biometric result entry unavailable');
 for(const medium of ['fi','fe'])for(const area of ['trab1','trab2'])for(const category of ['habilitado','nao-habilitado','operador'])globalThis.Module.FS.mkdirTree(`/dsk/${medium}/dinamico/${area}/wsq/${category}`);
 const state={simulated:true,enrollmentReads:0,randomDraws:0,outcomes:[],biometricMatchPerformed:false};
 // CRngUniversal::GetInt32 (9500) rebuilds MT from this+4 every time. The
 // archive writer (2725) retries occupied filenames forever with that fixed draw.
 // Supply fresh host randomness at the RNG service boundary.
 hookTableSlot(table,6230,1,()=>{state.randomDraws++;return crypto.getRandomValues(new Int32Array(1))[0]},{result:true});
 function octets(entity,index){const node=get(get(entity+8)+index*4),start=get(node+8),end=get(node+12);return end===start?new Uint8Array():bytes(start,end-start)}
 const equals=(data,text)=>data.length===text.length&&data.every((v,i)=>v===text.charCodeAt(i));
 hookTableSlot(table,2609,4,(original,out,self,entity,params)=>{
  if(!equals(octets(entity,1),BIOMETRIC_MARKER)||!equals(octets(entity,2),BIOMETRIC_SALT))return original(out,self,entity,params);
  // CBiometriaEleitor (40 bytes): no photo, present empty finger map, no read error.
  // Matches CConversorBiometriaEleitor::DoDesconverte (11422). The empty map has
  // its end-node at +24; the native destructor owns it. No WSQ/template is invented.
  bytes(out,40).fill(0);view().setUint32(out+20,out+24,true);view().setUint8(out+32,1);
  state.enrollmentReads++;
  app.log?.('simulated-voter-biometric-enrollment',{mode:'fixture-converter',encrypted:false,templateCreated:false});
 });
 function requirePrompt(p){check(p,0x28);if(get(p)!==1591896||!app.fingerprint?.state.capturing)throw Error('Voter biometric result requires the active native fingerprint prompt')}
 async function respond(ctx,p,outcome){
  requirePrompt(p);
  if(!['correct','wrong','timeout'].includes(outcome))throw Error('Unknown biometric outcome');
  if(outcome==='timeout'){
   // CPedeDigital::ProcessTick: first-attempt timer at +11, later-attempt timer +12.
   const off=view().getUint8(0x18468c)===1?11:12;
   await ctx.table(4169,[p,view().getUint8(p+off)]);
  }else{
   for(const off of [11,12,13])await ctx.export('emuStopTimer',[await ctx.export('emuTimerController',[]),view().getUint8(p+off)]);
   // The native habilitation writer requires saved capture bytes. Supply an explicit
   // fixture marker, never a real fingerprint or a purported WSQ image. VOTA owns
   // vector allocation, encryption/archiving and the resulting attendance record.
   const capture=new TextEncoder().encode('VOTA-SIMULATED-CAPTURE-1;NOT-A-WSQ-IMAGE');
   const pCapture=table.get(5)(capture.length);
   try{bytes(pCapture,capture.length).set(capture);await ctx.export('emuAssignBytes',[0x1d1fc0,pCapture,pCapture+capture.length,capture.length]);}
   finally{const free=app.tableMetadata.find(m=>m.functionIndex===136).slot;table.get(free)(pCapture);}
   // Capture bookkeeping and diagnostic score used by the original result writer.
   // No counters are written here. Zero score explicitly carries no measured match.
   view().setUint32(0x184694,view().getUint8(0x18468c),true);
   view().setUint16(0x1d1fe4,0,true);
   await ctx.export('emuBiometricResult',[p,outcome==='correct'?1:0]);
  }
  const event={outcome,biometricMatchPerformed:false};state.outcomes.push(event);app.log?.('simulated-voter-biometric-result',event);
 }
 return app.voterBiometrics={state,respond};
}
