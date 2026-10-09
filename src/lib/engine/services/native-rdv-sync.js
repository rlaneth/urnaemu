// Opt-in restoration of the ORIGINAL native synchronization implementation.
// The web and original constructors both allocate four bytes and assign only
// their vptr (functions10307 and7181). Ownership/control blocks stay untouched.
// No WASM bytes, table entries, reference files, or vendor files are modified.
export const installNativeRdvSync = async function(app) {
  if (app.rdvSync) return app.rdvSync;
  if (!app.native?.transaction) throw Error('Native RDV synchronization requires the serialized runtime');
  return app.native.transaction(() => {
    if (app.rdvSync) return app.rdvSync;
    const table = app.exports.Fb;
    const view = () => new DataView(app.exports.Cb.buffer);
    const bytes = () => new Uint8Array(app.exports.Cb.buffer);
    const check = (p,n) => {
      if (!Number.isInteger(p) || !Number.isInteger(n) || p < 1024 || n < 0 || p+n > view().byteLength)
        throw Error('Invalid native RDV synchronization ABI range');
    };
    const get = p => { check(p,4); return view().getUint32(p,true); };
    const text = (p,n) => { check(p,n); return new TextDecoder('utf-8',{fatal:true}).decode(bytes().subarray(p,p+n)); };
    const cstring = p => {
      check(p,1); const limit = Math.min(p+256,view().byteLength);
      let end=p; while(end<limit && bytes()[end]) end++;
      if(end===limit) throw Error('Unbounded native RDV RTTI name');
      return text(p,end-p);
    };
    const serviceName='N4vota4impl23ISincronismoVotoEleitorE';
    const webVtable=0x174dd4, originalVtable=0x1768d4;
    for (const [slot,index] of [[284,11265],[342,434],[965,7174]]) {
      const meta=app.tableMetadata.find(row=>row.slot===slot);
      if(!meta || meta.functionIndex!==index || meta.result!=='i32' ||
         meta.params.join(',')!==(slot===284?'':'i32') || typeof table.get(slot)!=='function')
        throw Error(`Unexpected native RDV function ABI at table${slot}`);
    }
    if(get(webVtable)!==340 || get(webVtable+4)!==341 || get(webVtable+8)!==342 ||
       get(originalVtable)!==340 || get(originalVtable+4)!==964 || get(originalVtable+8)!==965 ||
       cstring(get(get(webVtable-4)+4))!=='N12_GLOBAL__N_126CSincronismoVotoEleitorWebE' ||
       cstring(get(get(originalVtable-4)+4))!=='N4vota4impl23CSincronismoVotoEleitorE')
      throw Error('Native RDV implementation vtables/RTTI do not match the traced build');
    const registry=table.get(284)(); check(registry,0x94);
    const begin=get(registry),end=get(registry+4),capacity=get(registry+8);
    check(begin,end-begin);
    if((end-begin)%24 || end>capacity || capacity>view().byteLength || end-begin>24*4096)
      throw Error('Unexpected native singleton registry layout');
    const found=[];
    for(let row=begin;row<end;row+=24){
      const long=bytes()[row+11]&128;
      const p=long?get(row):row, n=long?get(row+4):bytes()[row+11];
      if(n>256 || (!long && n>10)) throw Error('Unexpected singleton service-name encoding');
      if(text(p,n)===serviceName) found.push(row);
    }
    if(found.length!==1) throw Error('Expected exactly one existing browser RDV synchronization service');
    const row=found[0], rtti=get(row+12),object=get(row+16);
    if(cstring(get(rtti+4))!==serviceName || get(object)!==webVtable)
      throw Error('Refusing to replace an unknown/already-modified RDV synchronization service');
    // The only mutation: select the original stateless four-byte implementation.
    // Keeping the same pointer preserves singleton ownership and cached references.
    view().setUint32(object,originalVtable,true);
    const state={enabled:true,originalImplementation:true,
      identity:app.pkcs11?.state?.simulated ? 'host test identity' : 'not asserted by this adapter',
      registry,object,previousVtable:webVtable,vtable:originalVtable,
      functionIndex:7174,slot:965,persistenceVerified:false,
      note:'Original persistence service enabled; verify generated files and dependencies independently. Reload to reset.'};
    const api={state,inspect:()=>({...state,currentVtable:get(object),intact:get(object)===originalVtable})};
    app.rdvSync=api;
    app.log?.('native-rdv-sync',{event:'original-service-restored',...state});
    return api;
  },'restore original RDV synchronization');
};
