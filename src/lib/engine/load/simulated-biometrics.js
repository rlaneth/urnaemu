// Fixture for the exact bundled schema: SEQUENCE { ENUMERATED, OCTET STRING,
// OCTET STRING }. This is an emulator marker, NOT encrypted biometric material.
import { VotaLoadFormat as F } from './load-format.js';
export const BIOMETRIC_MARKER = 'VOTA-SIM-BIO-1';
export const BIOMETRIC_SALT = 'SIMULATED-NOT-ENCRYPTED';
const hex = text => F.hex(new TextEncoder().encode(text));
export function simulatedBiometricElement() {
 return {tag:48,children:[{tag:10,hex:'00'},{tag:4,hex:hex(BIOMETRIC_MARKER)},{tag:4,hex:hex(BIOMETRIC_SALT)}]};
}
export function isSimulatedBiometricElement(node) {
 const c=node?.children;
 return node?.tag===48 && c?.length===3 && c[0].tag===10 && c[0].hex==='00' && c[1].tag===4 && c[1].hex===hex(BIOMETRIC_MARKER) && c[2].tag===4 && c[2].hex===hex(BIOMETRIC_SALT);
}
