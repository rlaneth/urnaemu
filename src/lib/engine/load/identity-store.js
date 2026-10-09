// Test identities of the emulator: a P-521 key with its self-signed certificate, kept in
// IndexedDB so the same identity (and the same certificate) is reused across visits.
// Not credentials of the Justiça Eleitoral. Import/export as PEM (certificate + PKCS#8 key).
import { createWebCryptoProvider, DEFAULT_CERTIFICATE_FIELDS } from '../services/webcrypto-provider.js';

const DB = 'urnaemu-identidades', STORE = 'identidades', ACTIVE_KEY = 'urnaemu:identidade:ativa';

function db() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function tx(mode, run) {
	const d = await db();
	return new Promise((resolve, reject) => {
		const t = d.transaction(STORE, mode), result = run(t.objectStore(STORE));
		t.oncomplete = () => resolve(result?.result ?? result);
		t.onerror = () => reject(t.error);
	});
}

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export function pem(label, bytes) {
	return `-----BEGIN ${label}-----\n${b64(bytes).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
}
export function fromPem(text, label) {
	const m = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`).exec(text);
	return m ? unb64(m[1].replace(/\s+/g, '')) : null;
}

/** Summary of an X.509 certificate for display (subject, serial, validity). */
export function describeCertificate(der) {
	try {
		// Minimal DER walk: tbs = cert[0]; fields of tbs: [version], serial, sigAlg, issuer, validity, subject.
		const read = (b, at) => {
			let len = b[at + 1], hdr = 2;
			if (len & 0x80) {
				const n = len & 0x7f;
				len = 0;
				for (let i = 0; i < n; i++) len = len * 256 + b[at + 2 + i];
				hdr = 2 + n;
			}
			return { tag: b[at], start: at + hdr, end: at + hdr + len };
		};
		const children = (b, node) => {
			const out = [];
			for (let at = node.start; at < node.end; ) {
				const c = read(b, at);
				out.push(c);
				at = c.end;
			}
			return out;
		};
		const cert = read(der, 0), tbs = children(der, cert)[0], f = children(der, tbs);
		const o = f[0].tag === 0xa0 ? 1 : 0;
		const serial = [...der.slice(f[o].start, f[o].end)].map((x) => x.toString(16).padStart(2, '0')).join('');
		const text = (n) => new TextDecoder().decode(der.slice(n.start, n.end));
		const [nb, na] = children(der, f[o + 3]).map(text);
		const time = (s) => (s.length === 13 ? (Number(s.slice(0, 2)) < 50 ? '20' : '19') + s : s).replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z');
		const names = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.6': 'C', '1.2.840.113549.1.9.1': 'emailAddress' };
		const oidText = (n) => {
			const b = der.slice(n.start, n.end), parts = [Math.floor(b[0] / 40), b[0] % 40];
			let v = 0;
			for (const x of b.slice(1)) {
				v = v * 128 + (x & 0x7f);
				if (!(x & 0x80)) (parts.push(v), (v = 0));
			}
			return parts.join('.');
		};
		const subject = {};
		for (const rdn of children(der, f[o + 4])) for (const atv of children(der, rdn)) {
			const [id, value] = children(der, atv);
			subject[names[oidText(id)] ?? oidText(id)] = text(value);
		}
		return { subject, serial, notBefore: time(nb), notAfter: time(na) };
	} catch {
		return null;
	}
}

export async function listIdentities() {
	const all = await tx('readonly', (s) => s.getAll()).catch(() => []);
	return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((i) => ({ ...i, info: describeCertificate(unb64(i.certificate)) }));
}
export async function getIdentity(id) {
	return id ? tx('readonly', (s) => s.get(id)) : null;
}
export async function deleteIdentity(id) {
	await tx('readwrite', (s) => s.delete(id));
	if (activeIdentityId() === id) setActiveIdentity(null);
}
export function activeIdentityId() {
	try {
		return localStorage.getItem(ACTIVE_KEY);
	} catch {
		return null;
	}
}
export function setActiveIdentity(id) {
	try {
		id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY);
	} catch {}
}

async function store(provider, name) {
	const record = { id: crypto.randomUUID(), name: name || describeCertificate(provider.certificate)?.subject.CN || 'Identidade de teste', createdAt: new Date().toISOString(), jwk: await provider.exportPrivateJwk(), certificate: b64(provider.certificate) };
	await tx('readwrite', (s) => s.put(record));
	return record;
}

/** Create a new identity from certificate fields ({CN, O, OU, L, ST, C, emailAddress, serial, notBefore, notAfter}). */
export async function createIdentity(fields, name) {
	const provider = await createWebCryptoProvider({ profile: 'P-521', certificateFields: fields });
	await provider.selfTest();
	return store(provider, name);
}
/**
 * An identity whose certificate covers `day` (AAAA-MM-DD, the election day): the first stored one
 * that does, or else a new one with the default certificate fields (Início › Sessão oficial).
 */
export async function identityCovering(day) {
	const found = (await listIdentities()).find((i) => i.info && i.info.notBefore.slice(0, 10) <= day && i.info.notAfter.slice(0, 10) >= day);
	if (found) return found;
	const at = Date.parse(day + 'T12:00:00Z'), now = Date.now();
	const notBefore = new Date(Math.min(now, at) - 86400000).toISOString(), notAfter = new Date(Math.max(now, at) + 86400000 * 730).toISOString();
	return createIdentity({ ...DEFAULT_CERTIFICATE_FIELDS, serial: '', notBefore, notAfter }, 'Identidade de teste (automática)');
}
/** Import from PEM text containing a CERTIFICATE and a PRIVATE KEY (PKCS#8, P-521). */
export async function importIdentityPem(text, name) {
	const certificate = fromPem(text, 'CERTIFICATE'), pkcs8 = fromPem(text, 'PRIVATE KEY');
	if (!certificate || !pkcs8) throw Error('O arquivo precisa conter um CERTIFICATE e uma PRIVATE KEY (PKCS#8) em PEM');
	const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-521' }, true, ['sign']);
	const jwk = await crypto.subtle.exportKey('jwk', key);
	const provider = await createWebCryptoProvider({ profile: 'P-521', privateJwk: jwk, certificate });
	await provider.selfTest();
	return store(provider, name);
}
/** Provider for a stored identity, with its stored certificate. */
export async function providerFor(record) {
	return createWebCryptoProvider({ profile: 'P-521', privateJwk: record.jwk, certificate: unb64(record.certificate) });
}
/** PEM export: certificate and, if asked, the private key (PKCS#8). */
export async function exportIdentityPem(record, { withPrivateKey = false } = {}) {
	let text = pem('CERTIFICATE', unb64(record.certificate));
	if (withPrivateKey) text += pem('PRIVATE KEY', await (await providerFor(record)).exportPkcs8());
	return text;
}
