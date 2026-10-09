// Extend this registry only with evidence from loader bindings or decompilation.
export const VOTA_OPERATIONS = [
 {name:'votaGetStateJson', result:'string', types:[], args:[], index:10171, export:'Jb', note:'Copy the engine-owned state string immediately via ccall; never free its pointer.'},
 {name:'votaPressKey', result:null, types:['string'], args:['C'], index:10703, export:'Gb', note:'Enqueue a string; only its first character is consumed. C=confirm, D=correct, B=blank.'},
 {name:'votaTick', result:'number', types:[], args:[], index:10619, export:'Hb', note:'Advance the event loop once.'},
 {name:'votaSetAudioEnabled', result:null, types:['number'], args:[0], index:10240, export:'Ib', note:'Set browser audio playback; accessibility initialization is separate.'},
 {name:'votaInit', result:'number', types:['string'], args:['{}'], index:7840, export:'Eb', note:'Initialize using JSON; use the Session configuration for a populated example.'},
 {name:'uenux_wasm_web_sound_wait_cancel_requested', result:'number', types:['number'], args:[0], index:9614, export:'Lb', note:'Internal speech wait hook; wait ID argument. Signature binding only; use only a live wait ID.', experimental:true},
 {name:'uenux_wasm_web_sound_wait_finished', result:null, types:['number','number'], args:[0,1], index:9604, export:'Mb', note:'Internal speech wait callback; wait ID argument. Signature binding only; use only a live wait ID.', experimental:true}
];
