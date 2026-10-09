// Expose existing functions of the hash-verified VOTA build to its simulated biometric
// device. Function bodies and vendor files are unchanged. These functions own the native
// result transition and timer lifecycle; the host never writes attendance counters.
export const BIOMETRIC_EXPORTS = { emuBiometricResult: 5397, emuTimerController: 270, emuStopTimer: 422, emuAssignBytes: 1681 };
export function addBiometricExports(bytes) {
 const read=(p)=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7}while(b&128);return [n,p]};
 const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b)}while(n);return a};
 for(let at=8;at<bytes.length;){const id=bytes[at], [size,start]=read(at+1),end=start+size;
  if(id===7){const [count,body]=read(start);const extra=[];
   for(const [name,index] of Object.entries(BIOMETRIC_EXPORTS)){const text=new TextEncoder().encode(name);extra.push(...leb(text.length),...text,0,...leb(index))}
   const payload=new Uint8Array([...leb(count+Object.keys(BIOMETRIC_EXPORTS).length),...bytes.subarray(body,end),...extra]);
   const header=new Uint8Array([7,...leb(payload.length)]),out=new Uint8Array(at+header.length+payload.length+bytes.length-end);
   out.set(bytes.subarray(0,at));out.set(header,at);out.set(payload,at+header.length);out.set(bytes.subarray(end),at+header.length+payload.length);return out;
  }at=end;
 }throw Error('Native export section unavailable');
}
