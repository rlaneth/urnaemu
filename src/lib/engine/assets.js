// The TSE runtime files (VOTA WebAssembly build, its JS glue, data packages and scenario
// bases): bundled with UrnaEmu when available, or uploaded by the user and kept in IndexedDB.
// The engine resolves every runtime URL through here.
import HASHES from './runtime-hashes.json';
import { readZip } from '../results/zip.js';

export const REQUIRED = ['vendor/wasm/vota_web_wasm.js', 'vendor/wasm/vota_web_wasm.wasm', 'vendor/wasm/vota_web_wasm.data', 'vendor/wasm/bases/manifest.json'];
export const EXPECTED = HASHES.files;
const DB = 'urnaemu-runtime', STORE = 'files', SOURCE_KEY = 'urnaemu:runtime:fonte';

// ---- IndexedDB ----
function db() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function tx(mode, fn) {
	const database = await db();
	return new Promise((resolve, reject) => {
		const t = database.transaction(STORE, mode), store = t.objectStore(STORE);
		const result = fn(store);
		t.oncomplete = () => resolve(result.result ?? result);
		t.onerror = () => reject(t.error);
	});
}
export const storedPaths = () => tx('readonly', (s) => s.getAllKeys());
export const storedFile = (path) => tx('readonly', (s) => s.get(path));
export const clearStored = () => tx('readwrite', (s) => s.clear());
export const putStored = (path, blob) => tx('readwrite', (s) => s.put(blob, path));
export const deleteStored = (path) => tx('readwrite', (s) => s.delete(path));
/** Remove uploaded runtime files only (keeps other stored data such as media packages). */
export async function clearRuntime() {
	for (const path of await storedPaths()) if (String(path).startsWith('vendor/')) await deleteStored(path);
}

// ---- Hashing ----
export async function sha256(blob) {
	const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Where an uploaded file belongs, from its name (a simulator package keeps these names). */
export function targetPath(name) {
	const base = name.split('/').pop();
	if (/^vota_web_wasm\.(js|wasm|data|version)$/.test(base) || /^rhvoice-leticia\.data(\.js)?$/.test(base)) return `vendor/wasm/${base}`;
	if (/^(geral|municipal)[\w-]*\.data(\.js)?$/.test(base) || base === 'manifest.json') return `vendor/wasm/bases/${base}`;
	return null;
}

/**
 * Store uploaded runtime files (individual files and/or .zip packages).
 * @returns {Promise<{path: string, size: number, hash: string, matches: boolean|null}[]>}
 */
export async function importRuntime(fileList) {
	const entries = [];
	for (const file of fileList) {
		if (/\.zip$/i.test(file.name)) {
			for (const entry of await readZip(new Uint8Array(await file.arrayBuffer()))) {
				const path = targetPath(entry.name);
				if (path) entries.push({ path, blob: new Blob([await entry.read()]) });
			}
		} else {
			const path = targetPath(file.name);
			if (path) entries.push({ path, blob: file });
		}
	}
	if (!entries.length) throw Error('Nenhum arquivo do VOTA reconhecido. Envie vota_web_wasm.wasm (e, se faltarem, os demais arquivos do simulador) ou um .zip com eles.');
	const report = [];
	for (const { path, blob } of entries) {
		const hash = await sha256(blob);
		await tx('readwrite', (s) => s.put(blob, path));
		report.push({ path, size: blob.size, hash, matches: EXPECTED[path] ? EXPECTED[path] === hash : null });
	}
	return report;
}

// ---- Availability and selection ----
async function bundledAvailable(path) {
	try {
		const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
		return response.ok;
	} catch {
		return false;
	}
}

/** Which runtime sources are complete, and the hash of each one's .wasm. */
export async function probeRuntime() {
	const bundled = await Promise.all(REQUIRED.map(bundledAvailable));
	const stored = new Set((await storedPaths().catch(() => [])).filter((p) => String(p).startsWith('vendor/')));
	const bundledOk = bundled.every(Boolean);
	// An upload is usable when, together with the bundled files, every required file exists.
	const uploadedOk = stored.has('vendor/wasm/vota_web_wasm.wasm') && REQUIRED.every((p, i) => stored.has(p) || bundled[i]);
	let uploadedHash = null;
	if (stored.has('vendor/wasm/vota_web_wasm.wasm')) uploadedHash = await sha256(await storedFile('vendor/wasm/vota_web_wasm.wasm'));
	return {
		bundled: { ok: bundledOk, missing: REQUIRED.filter((_, i) => !bundled[i]), hash: bundledOk ? EXPECTED['vendor/wasm/vota_web_wasm.wasm'] : null },
		uploaded: { ok: uploadedOk, files: [...stored], hash: uploadedHash, matches: uploadedHash ? uploadedHash === EXPECTED['vendor/wasm/vota_web_wasm.wasm'] : null },
		expected: EXPECTED['vendor/wasm/vota_web_wasm.wasm'],
		selected: selectedSource()
	};
}

export function selectedSource() {
	try {
		return localStorage.getItem(SOURCE_KEY) === 'uploaded' ? 'uploaded' : 'bundled';
	} catch {
		return 'bundled';
	}
}
export function selectSource(source) {
	try {
		localStorage.setItem(SOURCE_KEY, source);
	} catch {}
}

// ---- URL resolution for the engine ----
const urls = new Map();
let source = 'bundled';

/** Call before booting: turns stored files into object URLs when the upload is selected. */
export async function prepareRuntime() {
	source = selectedSource();
	urls.clear();
	if (source !== 'uploaded') return;
	for (const path of await storedPaths()) if (String(path).startsWith('vendor/')) urls.set(path, URL.createObjectURL(await storedFile(path)));
	if (!urls.has('vendor/wasm/vota_web_wasm.wasm')) throw Error('O VOTA enviado não está mais disponível neste navegador. Envie-o novamente na tela de inicialização.');
}

/** URL of a runtime file: the uploaded copy when selected and present, else the bundled path. */
export function resolveRuntime(path) {
	return urls.get(path) ?? path;
}
export const runtimeSource = () => source;

/** Scenario manifest from the selected source (falls back to the other one). */
export async function loadManifest() {
	const fromStore = async () => {
		const blob = await storedFile('vendor/wasm/bases/manifest.json').catch(() => null);
		return blob ? JSON.parse(await blob.text()) : null;
	};
	const fromBundle = async () => {
		try {
			const response = await fetch('vendor/wasm/bases/manifest.json', { cache: 'no-store' });
			return response.ok ? await response.json() : null;
		} catch {
			return null;
		}
	};
	const first = selectedSource() === 'uploaded' ? [fromStore, fromBundle] : [fromBundle, fromStore];
	for (const load of first) {
		const manifest = await load();
		if (manifest) return manifest;
	}
	return null;
}

/**
 * The VOTA application version written inside the bundled .wasm (e.g. "10.23.0.1 - DESENVOLVIMENTO",
 * the text VOTA shows on its screens). Fetched once; the boot reuses the browser cache.
 */
export async function bundledVersion() {
	try {
		const bytes = new Uint8Array(await (await fetch('vendor/wasm/vota_web_wasm.wasm')).arrayBuffer());
		const text = new TextDecoder('latin1').decode(bytes);
		return /\0(\d+\.\d+\.\d+\.\d+ - [A-ZÀ-Ý ]+)\0/.exec(text)?.[1].trim() ?? null;
	} catch {
		return null;
	}
}
