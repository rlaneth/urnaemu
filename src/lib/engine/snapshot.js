// Session snapshots (urnaemu-snapshot/1): a JSON file with everything needed to continue or
// repeat a session, and the evidence it produced.
//
//  - configuration: scenario, start options (URL), load media package (all input files, phase,
//    section, signatures), clock, and which test identity signs (its certificate; never the
//    private key);
//  - VOTA's saved files: everything VOTA wrote under /dsk (dynamic data, logs, results);
//  - evidence: the printed paper (text and operations), the host log and a summary.
//
// Restoring can (a) resume the session: the emulator restarts with the same configuration and
// puts VOTA's saved files back before VOTA starts, so VOTA itself takes its power-loss path
// ("REINÍCIO DA VOTAÇÃO") and continues with the votes already cast, as a real urna does after a
// restart; (b) start over with the same configuration; or (c) only open the files read-only.
// The memory of the running WebAssembly program (and native call stacks suspended by JSPI)
// is never saved: a snapshot is not a memory image.
import { VotaLoadFormat as F } from './load/load-format.js';
import { DRAFT_STORAGE_KEY, KEY_STORAGE_KEY } from './load/load-editor.js';
import { listIdentities } from './load/identity-store.js';
import hashes from './runtime-hashes.json';

export const FORMAT = 'urnaemu-snapshot/1';
export const RESUME_KEY = 'urnaemu:retomada:v1';
// Start-screen and one-time options are not part of a session's configuration.
const TRANSIENT = ['loadDraft', 'start', 'voters', 'clock', 'identity'];

/** Files VOTA writes during a session: everything under /dsk except the load media itself. */
export function savedFiles(fs) {
	const out = [];
	(function walk(dir) {
		let names;
		try {
			names = fs.readdir(dir);
		} catch {
			return;
		}
		for (const name of names) {
			if (name === '.' || name === '..') continue;
			const full = dir.replace(/\/$/, '') + '/' + name;
			// Load media (and its fe alias): already in the package. The fe mirror of the dynamic data
			// is restored from fi.
			if (full === '/dsk/fi/estatico' || full.startsWith('/dsk/fe')) continue;
			let st;
			try {
				st = fs.lstat(full);
			} catch {
				continue;
			}
			if (fs.isDir(st.mode)) walk(full);
			else if (fs.isFile(st.mode) && full !== '/dsk/fi/serialv.dat') out.push({ path: full, data: F.base64(fs.readFile(full)) });
		}
	})('/dsk');
	return out;
}

/** Write the files of a resumed snapshot (sessionStorage, read once) into MEMFS, before VOTA starts. */
export function restoreSavedFiles(fs) {
	let files;
	try {
		files = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null');
		sessionStorage.removeItem(RESUME_KEY);
	} catch {
		return null;
	}
	if (!Array.isArray(files)) return null;
	for (const f of files) {
		const bytes = F.unbase64(f.data);
		// The urna keeps its dynamic data on the internal flash (fi) and a mirror on the external
		// one (fe); after a restart VOTA reads both (verified: without the mirror it stops with
		// "O arquivo [/dsk/fe/dinamico/eg.bin] não existe"). The web build only writes fi during a
		// first session: restore the mirror from the same bytes.
		for (const path of f.path.startsWith('/dsk/fi/dinamico/') ? [f.path, f.path.replace('/dsk/fi/', '/dsk/fe/')] : [f.path]) {
			fs.mkdirTree(path.replace(/\/[^/]+$/, ''));
			fs.writeFile(path, bytes);
		}
	}
	return files.map((f) => f.path);
}

/** Build a snapshot of the running session. */
export async function createSnapshot(app) {
	const query = new URLSearchParams(location.search);
	for (const k of TRANSIENT) query.delete(k);
	const load = await app.loadEditor.packageDraft();
	const provider = app.loadEditor.provider;
	const terminalVotes = (app.terminalText || '').match(/Votos:\s*(\d+)/)?.[1];
	return {
		format: FORMAT,
		createdAt: new Date().toISOString(),
		runtime: { sha256: app.wasmPatches?.sha256 ?? null, supported: app.wasmPatches?.sha256 === hashes.files['vendor/wasm/vota_web_wasm.wasm'] },
		scenario: app.scenario?.id ?? query.get('scenario'),
		scenarioLabel: app.scenario?.label ?? null,
		query: query.toString(),
		clock: { ...app.clock.settings, now: new Date(app.clock.now()).toISOString() },
		load,
		identity: provider ? { ...(app.loadEditor.identity ?? {}), algorithm: provider.algorithm, certificate: F.base64(provider.certificate) } : null,
		summary: {
			phase: app.sessionPhase ?? null,
			session: !!app.session?.enabled,
			booting: !!app.session?.booting,
			closed: !!app.session?.closed,
			votes: terminalVotes ? Number(terminalVotes) : null
		},
		files: app.session?.enabled ? savedFiles(Module.FS) : [],
		printer: { text: app.printer?.text?.() ?? '', operations: app.printer?.snapshot?.() ?? null },
		log: app.logs.slice(-2000)
	};
}

export function validateSnapshot(s) {
	if (s?.format !== FORMAT) throw Error('Este arquivo não é um instantâneo do UrnaEmu (urnaemu-snapshot/1).');
	F.validatePackage(s.load);
	if (!Array.isArray(s.files)) throw Error('Instantâneo sem a lista de arquivos.');
	for (const f of s.files) if (typeof f.path !== 'string' || !f.path.startsWith('/dsk/') || f.path.includes('..')) throw Error(`Caminho inválido no instantâneo: ${f.path}`);
	return s;
}

/** The stored identity whose certificate signed the snapshot's session, or null. */
async function identityFor(snapshot) {
	if (!snapshot.identity?.certificate) return null;
	const all = await listIdentities();
	return all.find((i) => i.certificate === snapshot.identity.certificate) ?? null;
}

/**
 * Restart the emulator from a snapshot. `resume`: VOTA's saved files come back and VOTA continues
 * the session; otherwise the session starts over with the same configuration.
 */
export async function restoreSnapshot(app, snapshot, { resume }) {
	validateSnapshot(snapshot);
	if (!app.scenarios.some((s) => s.id === snapshot.scenario)) throw Error(`Cenário desconhecido: ${snapshot.scenario}`);
	const p = structuredClone(snapshot.load);
	const official = p.config.fase === 'of';
	// The session signs with the same identity: it must be in this browser (private keys never travel in snapshots).
	const record = await identityFor(snapshot);
	if (official && !record) throw Error(`A identidade que assina esta sessão oficial (${snapshot.identity?.name ?? 'sem nome'}) não está neste navegador. Importe-a em Mídia de carga › Identidade (certificado e chave privada) e tente de novo.`);
	// Resume: the clock continues from the moment of the snapshot. Start over: 07:59 of election
	// day, like the start screen (VOTA opens at 08:00).
	const date = electionDate(p);
	if (resume) p.clock = { mode: snapshot.clock.mode === 'real' ? 'real' : 'running', iso: snapshot.clock.now };
	else if (date) p.clock = { mode: 'running', iso: new Date(`${date}T07:59:00`).toISOString() };
	delete p.signature;
	sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(p));
	if (record) sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify({ jwk: record.jwk, certificate: record.certificate, identity: { id: record.id, name: record.name } }));
	else sessionStorage.removeItem(KEY_STORAGE_KEY);
	if (resume && snapshot.files.length) sessionStorage.setItem(RESUME_KEY, JSON.stringify(snapshot.files));
	else sessionStorage.removeItem(RESUME_KEY);
	const query = new URLSearchParams(snapshot.query);
	query.set('scenario', snapshot.scenario);
	query.set('loadDraft', '1');
	location.search = query;
}

/** Election day (YYYY-MM-DD) of the package's round, from its -cp.dat. */
function electionDate(p) {
	try {
		const cp = p.files.find((f) => f.path.endsWith('-cp.dat'));
		const t = F.parse(F.unbase64(cp.data)), date = t.children[p.config.turno === 2 ? 3 : 2].children[2].text;
		return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
	} catch {
		return null;
	}
}

/** Read-only file source over a snapshot (load media + VOTA's saved files), for the viewers. */
export function snapshotSource(snapshot) {
	const files = new Map();
	for (const f of snapshot.load.files) files.set(f.path, f.data);
	for (const f of snapshot.files) files.set(f.path, f.data);
	const cache = new Map();
	const readFile = (path) => {
		if (!files.has(path)) throw Error(`Arquivo não encontrado no instantâneo: ${path}`);
		if (!cache.has(path)) cache.set(path, F.unbase64(files.get(path)));
		return cache.get(path);
	};
	async function browse(dir) {
		const base = dir.replace(/\/$/, ''), seen = new Map();
		for (const path of files.keys()) {
			if (!path.startsWith(base + '/')) continue;
			const rest = path.slice(base.length + 1), name = rest.split('/')[0];
			if (!seen.has(name)) seen.set(name, { name, path: `${base}/${name}`, isDir: rest.includes('/') });
		}
		return { path: dir, kind: 'directory', entries: [...seen.values()] };
	}
	return { browse, readFile, paths: () => [...files.keys()].sort(), size: (path) => readFile(path).length };
}
