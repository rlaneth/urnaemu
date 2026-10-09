// UrnaEmu engine controller: owns the single VOTA runtime of this page.
// Ported from the research workbench (workbench.js); native call order and
// serialization are unchanged, DOM rendering moved to the Svelte UI.
import { VOTA_OPERATIONS } from './runtime/operations.js';
import { createNativeRuntime } from './runtime/native-runtime.js';
import { installNativeFullSession, installNoAutoVoter, installSessionVoice } from './services/native-full-session.js';
import { installNativeTestGap } from './services/native-test-gap.js';
import { installNativeRdvSync } from './services/native-rdv-sync.js';
import { installNativeTestKey } from './services/native-test-key.js';
import { installNativeResultHash } from './services/native-result-hash.js';
import { installNativePkcs11 } from './services/native-pkcs11.js';
import { installNativeSavd } from './services/native-savd.js';
import { installNativeFingerprint } from './services/native-fingerprint.js';
import { createWebCryptoProvider } from './services/webcrypto-provider.js';
import { createExperimentalScreens } from './session/experimental-screens.js';
import { createTrainingSession } from './session/training-session.js';
import { createNativeClock } from './devices/clock.js';
import { createPowerCompanion } from './devices/power.js';
import { createPrinter } from './devices/printer.js';
import { createSerialPrinter } from './devices/serial-printer.js';
import { createKeyRouter } from './runtime/key-router.js';
import { installTerminalDecoder } from './devices/terminal.js';
import { createLoadEditor } from './load/load-editor.js';
import { createLogd } from './devices/logd.js';
import { createVoterSimulator } from './simulator/voter-simulator.js';
import { createProcedures } from './session/procedures.js';
import { restoreSavedFiles } from './snapshot.js';
import { createLog, formatValue } from './log.js';
import { readOptions, reboot, TRAINING_SESSION_FLAGS } from './options.js';
import { prepareRuntime, resolveRuntime, EXPECTED } from './assets.js';
import { addBiometricExports } from './runtime/biometric-exports.js';
import { applyPatches } from './runtime/wasm-patches.js';
import { installVoterAlarm } from './services/native-voter-alarm.js';
import { installCorrespondenceFixture, applyCorrespondenceSection } from './services/native-eg-fixture.js';

export const VOTER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'B', '0', 'D', 'C'];
export const TERMINAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'D', '0', 'C'];
const PHYSICAL_KEYS = { Enter: 'C', Escape: 'D', Backspace: 'D', ' ': 'B' };

export function hexDump(bytes, start = 0) {
	return Array.from({ length: Math.ceil(bytes.length / 16) }, (_, i) => {
		const row = bytes.slice(i * 16, i * 16 + 16);
		return (
			(start + i * 16).toString(16).padStart(8, '0') +
			'  ' +
			Array.from(row, (x) => x.toString(16).padStart(2, '0')).join(' ').padEnd(47) +
			'  ' +
			Array.from(row, (x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('')
		);
	}).join('\n');
}

export function downloadBytes(bytes, name) {
	const a = document.createElement('a');
	const url = URL.createObjectURL(new Blob([bytes]));
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Create the engine. `notify()` is called whenever observable state changed;
 * the store batches those into one snapshot per frame.
 */
export function createEngine({ notify = () => {} } = {}) {
	const options = readOptions();
	const app = {
		ready: false,
		initialized: false,
		running: false,
		exports: null,
		scenarios: [],
		operations: VOTA_OPERATIONS,
		options,
		// Services installed when a training/full session starts (formerly checkboxes).
		sessionOptions: { persist: options.persist, crypto: options.crypto, testkey: options.crypto && options.testkey, locked: false },
		status: { code: 'loading' },
		error: null,
		lastState: null,
		resultMedia: null,
		scannerStatus: null,
		cryptoStatus: null,
		rdvPersistence: false,
		// The emulator always executes. Internal pauses (around scanner actions, developer
		// calls, …) resume automatically; only an explicit urnaEmu.pause() holds the engine,
		// which automated tests and tools use for deterministic stepping.
		autoRun: true,
		bootStep: 'discovery',
		audioEnabled: false,
		// The TSE runtime's console debug messages are on by default (they only log; see DevPanel).
		debug: true,
		notify
	};
	let chain = Promise.resolve(), frame = 0;

	const logger = createLog({ onChange: notify });
	const log = (kind, ...args) => logger.push('host', kind, ...args);
	const votaLog = (kind, ...args) => logger.push('vota', kind, ...args);
	// The TSE web wrapper compiled into the binary (vota_web_wasm.cpp), not the urna application.
	const bridgeLog = (kind, ...args) => logger.push('bridge', kind, ...args);
	// Kinds the native runtime emits on behalf of VOTA's own diagnostic imports.
	const VOTA_DIAGNOSTICS = new Set(['thread', 'error', 'screen', 'resource']);
	app.logger = logger;
	Object.defineProperty(app, 'logs', { get: () => logger.lines() });
	logger.captureConsole();

	function setStatus(code, detail) {
		app.status = { code, detail };
		notify();
	}
	function fail(error) {
		pause();
		log('error', String(error));
		app.error = String(error?.message ?? error);
		setStatus('error', app.error);
	}
	window.addEventListener('error', (e) => fail(e.message));
	window.addEventListener('unhandledrejection', (e) => fail(e.reason));

	app.native = createNativeRuntime({
		app,
		log: (kind, ...args) => (VOTA_DIAGNOSTICS.has(kind) ? votaLog : log)(kind, ...args),
		onError: fail,
		onStatus: (state) => {
			app.nativeStatus = { ...state };
			notify();
		}
	});

	function enqueue(fn) {
		const result = chain.then(fn);
		chain = result.catch(fail);
		return result;
	}

	app.installRdvPersistence = async () => {
		const service = await installNativeRdvSync(app);
		app.rdvPersistence = true;
		notify();
		return service;
	};
	app.installTestVoteKey = () =>
		app.native.transaction(() => {
			const key = installNativeTestKey(app);
			if (app.fullSession) {
				installNativeResultHash(app);
				app.fullSession.installMedia();
				app.resultMedia = { present: true };
			}
			notify();
			return key;
		}, 'Install synthetic vote key / HSM secret');
	app.installTestCrypto = async () => {
		const provider = app.pkcs11?.provider || app.loadSigningProvider || (await createWebCryptoProvider({ profile: app.fullSession ? 'P-521' : 'Ed25519' }));
		const service = await app.native.transaction(() => installNativePkcs11(app, provider), 'Install synthetic test crypto');
		if (app.fullSession) await app.native.transaction(() => installNativeSavd(app), 'Install synthetic SAVD result signer');
		app.cryptoStatus = { algorithm: provider.algorithm };
		notify();
		return service;
	};
	/** Insert (true) or remove (false) the simulated result media (pen drive / MR). */
	function setResultMedia(present) {
		if (!app.fullSession) throw Error('A mídia de resultado só existe na sessão oficial');
		app.fullSession.setMediaPresent(present);
		app.resultMedia = { present };
		log('result-media', present ? 'inserted' : 'removed');
		notify();
	}
	app.media = { eject: () => setResultMedia(false), insert: () => setResultMedia(true) };

	app.powerCompanion = createPowerCompanion({ app, log, notify });
	app.setPower = (state) => enqueue(() => app.powerCompanion.set(state));
	app.printer = createPrinter({ app, log, notify });
	app.serialPrinter = createSerialPrinter({ app, log, notify });
	app.installPrinter = () => app.printer.install();
	app.clock = createNativeClock({ app, log, notify });
	app.loadEditor = createLoadEditor({ app, log, notify });
	// VOTA's own log file, tailed from MEMFS while the runtime runs.
	app.logd = createLogd({ app, notify });
	setInterval(() => app.logd.poll(), 400);
	app.simulator = createVoterSimulator({ app, log, notify });
	app.procedures = createProcedures(app);
	// One queue per keypad behind the vendor's single Module.uenuxKeys (runtime/key-router.js).
	app.keys = createKeyRouter({ log });
	const experiments = (app.experiments = createExperimentalScreens({ app, pause, log, notify }));
	const training = (app.training = createTrainingSession({ app, experiments, call, readState, pause, run, log, notify }));
	app.session = training.state;

	function call(name, result, types = [], args = []) {
		if (experiments.state.enabled && ['votaInit', 'votaTick'].includes(name)) throw Error('Reload normal session before calling the official engine init/tick');
		if (!app.ready) throw Error('O VOTA ainda não terminou de carregar');
		return app.native.ccall(name, result, types, args);
	}
	async function readState() {
		const value = await call('votaGetStateJson', 'string');
		app.lastState = JSON.parse(value);
		app.logd.poll();
		notify();
		return JSON.parse(value);
	}
	async function tick() {
		if (training.state.enabled) return training.tick();
		if (experiments.state.enabled) return experiments.tick();
		if (!app.initialized) throw Error('O VOTA ainda não foi inicializado');
		// Voting-only mode (TSE simulator): only the urna exists.
		const value = await app.keys.as('voter', () => call('votaTick', 'number'));
		await readState();
		return value;
	}
	function runningMode() {
		return training.state.enabled ? 'session' : experiments.state.enabled ? 'experimental' : 'bridge';
	}
	function pause() {
		app.running = false;
		cancelAnimationFrame(frame);
		if (!app.initialized) return notify();
		// A session that reached its end ("fim dos trabalhos") is concluded, not merely paused.
		setStatus(training.state?.closed ? 'done' : 'paused', runningMode());
	}
	function run() {
		if (app.running) return;
		if (experiments.state.enabled && experiments.state.stopped && !training.state.operatorFinished) throw Error('Restart the stopped experimental screen first');
		if (!app.initialized) throw Error('O VOTA ainda não foi inicializado');
		app.running = true;
		setStatus('running', runningMode());
		const next = () => {
			if (app.running)
				enqueue(tick)
					.then(() => {
						if (app.running) frame = requestAnimationFrame(next);
					})
					.catch(fail);
		};
		next();
	}
	function script(src) {
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = src;
			s.onload = resolve;
			s.onerror = () => reject(Error(`Falha ao carregar ${src}`));
			document.head.append(s);
		});
	}
	async function waitFor(test, label) {
		const deadline = Date.now() + 60000;
		while (!test()) {
			if (Date.now() > deadline) throw Error(`Tempo esgotado: ${label}`);
			await new Promise((r) => setTimeout(r, 40));
		}
	}
	/** Sessions with the poll-worker terminal (training or official), as opposed to voting-only mode. */
	function terminalSession() {
		return !!(options.session || options.fullSession);
	}
	function configFor(s) {
		return {
			fase: s.fase || 'te',
			pe: s.pe,
			turno: s.turno,
			uf: s.uf,
			municipio: s.municipio,
			zona: s.zona,
			secao: s.secao,
			// The bridge initializes the speech synthesizer only with audioEleitorHabilitado. Sessions
			// always set it (installSessionVoice keeps voters from starting with audio); in the
			// voting-only mode it keeps the simulator's meaning: every voter uses audio.
			audioEleitorHabilitado: options.voice || terminalSession(),
			reproduzirAudio: options.voice || terminalSession()
		};
	}
	async function initialize() {
		const config = { ...app.bootConfig };
		app.sessionConfig = { ...config };
		await app.powerCompanion.install();
		if (options.fullSession) installNativeFullSession(app);
		else if (options.session) installNoAutoVoter(app);
		if (terminalSession()) installSessionVoice(app);
		// The bridge's fixed correspondence (section 1) follows the configured section.
		applyCorrespondenceSection(app);
		// The late-voter alarm thread is patched out; the browser plays its beep instead.
		if (app.wasmPatches?.applied.some((p) => p.id === 'thread-alarme-eleitor-demorando')) installVoterAlarm(app);
		const overlay = options.testgap
			? installNativeTestGap({ config, ...(app.loadGeneration ? { timestamp: app.loadGeneration.loadTimestamp, loadCode: app.loadGeneration.loadCode } : {}) })
			: null;
		let ok;
		try {
			ok = await call('votaInit', 'number', ['string'], [JSON.stringify({ ...config, fase: config.fase === 'of' ? 'oficial' : config.fase })]);
		} finally {
			if (overlay) {
				overlay.restore();
				app.testGap = overlay.state;
				log('simulated-load-history', overlay.state);
			}
		}
		if (!ok) throw Error('O VOTA não conseguiu iniciar com esta mídia de carga (votaInit retornou 0); o motivo, quando o VOTA informa, está no Registro');
		// Browser playback is always on: VOTA decides when a voter uses audio. (The bridge leaves it
		// off unless the voting-only mode starts every voter with audio.)
		await call('votaSetAudioEnabled', null, ['number'], [1]);
		app.audioEnabled = true;
		app.initialized = true;
		app.sessionPhase = config.fase === 'of' ? 'official' : 'training';
		await app.powerCompanion.refresh();
		setStatus('paused', 'bridge');
		log('init', config);
		await readState();
	}

	// Blocking native code (verified: CMenuVisualizarCandidatos::StartState) reads keys through
	// wasm_input_get_key while its call is suspended. Keys pressed meanwhile are queued for it
	// without entering WASM again.
	let ingressOwner = 0;
	function deliverDuringSuspension(key, source) {
		if (!app.native.state.busy || !app.native.state.suspended) return false;
		// A suspended native call (e.g. the blocking candidate menu) may read keys when it
		// resumes: queue the key on its own keypad without re-entering WASM. The suspended code
		// reads only the keypad of its side (runtime/key-router.js); leftovers are dropped
		// when the call returns.
		if (typeof key !== 'string' || !/^[0-9BCD]$/.test(key)) throw Error('Teclas válidas: 0–9, B (BRANCO), C (CONFIRMA), D (CORRIGE)');
		const keypad = source === 'mesario' ? 'mesario' : 'voter';
		if (app.keys.pending(keypad) >= 32) {
			log('key-ignored', { source, key, reason: 'keypad buffer full during a suspended native call' });
			return true;
		}
		if (ingressOwner !== app.native.state.calls) {
			ingressOwner = app.native.state.calls;
			app.native.afterCurrent(() => {
				app.keys.drop(null, 'suspended native call returned');
				ingressOwner = 0;
			});
		}
		app.keys.queue(keypad, key);
		log('key', { source, key, mode: 'during-suspended-native-call', native: app.native.state.current });
		return true;
	}
	function submitKey(key, source = 'voter') {
		try {
			if (deliverDuringSuspension(key, source)) return Promise.resolve();
			return enqueue(() => press(key, source));
		} catch (error) {
			fail(error);
			return Promise.reject(error);
		}
	}
	async function press(key, source = 'voter') {
		if (training.state.enabled) return training.press(key, source);
		// Never refused: a key the active native state does not read is dropped below.
		if ((experiments.state.enabled && experiments.state.stopped) || !app.initialized) {
			log('key-ignored', { source, key, reason: app.initialized ? 'isolated screen stopped' : 'not initialized' });
			return;
		}
		const keypad = source === 'mesario' ? 'mesario' : 'voter';
		await app.keys.input(keypad, () => call('votaPressKey', null, ['string'], [key]));
		log('key', { source, key });
		await tick();
		app.keys.drop(keypad, 'not read by the active native state');
	}
	/** Device that receives physical-keyboard input right now. */
	function keyboardTarget() {
		return training.state.enabled ? training.state.keyboardOwner : experiments.state.enabled && experiments.state.role === 'mesario' ? 'mesario' : 'voter';
	}
	document.addEventListener('keydown', (e) => {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.target.closest?.('input,textarea,select,button,[contenteditable],[role=menu],[role=menuitem],[role=dialog]')) return;
		const key = /^[0-9]$/.test(e.key) ? e.key : PHYSICAL_KEYS[e.key];
		if (key) {
			e.preventDefault();
			submitKey(key, keyboardTarget()).catch(() => {});
		}
	});

	for (const name of ['ready', 'state', 'done', 'error'])
		window.addEventListener(`vota:${name}`, (e) => {
			bridgeLog(`vota:${name}`, e.detail);
			if (name === 'done' || name === 'error') {
				pause();
				setStatus(name === 'done' ? 'done' : 'engine-error');
			}
		});

	/** Whether the engine can keep executing on its own right now. */
	function canRun() {
		if (!app.initialized || app.error) return false;
		if (training.state.closed || training.state.error) return false;
		if (experiments.state.enabled && experiments.state.stopped && !training.state.operatorFinished) return false;
		return !app.native.state.busy && !app.native.state.cancelled;
	}
	setInterval(() => {
		if (app.autoRun && !app.running && canRun()) {
			try {
				run();
			} catch {}
		}
	}, 250);

	// ---- Developer tools (formerly workbench sections) ----
	function browse(path) {
		const fs = Module.FS;
		const stat = fs.stat(path);
		if (fs.isDir(stat.mode)) {
			const entries = [];
			for (const name of fs.readdir(path)) {
				if (name === '.') continue;
				const target = name === '..' ? path.replace(/\/$/, '').replace(/\/[^/]*$/, '') || '/' : path.replace(/\/$/, '') + '/' + name;
				let isDir = false;
				try {
					isDir = fs.isDir(fs.stat(target).mode);
				} catch {}
				entries.push({ name, path: target, isDir });
			}
			return { path, kind: 'directory', entries };
		}
		if (!fs.isFile(stat.mode)) throw Error('Escolha um arquivo comum (dispositivos não são lidos)');
		const bytes = fs.readFile(path);
		return { path, kind: 'file', size: bytes.length, preview: hexDump(bytes.slice(0, 4096)), text: new TextDecoder().decode(bytes.slice(0, 4096)) };
	}
	function readFile(path) {
		const fs = Module.FS;
		if (!fs.isFile(fs.stat(path).mode)) throw Error('Escolha um arquivo comum');
		return fs.readFile(path);
	}
	function writeFile(path, contents) {
		if (!path.startsWith('/')) throw Error('Use an absolute path');
		Module.FS.writeFile(path, contents);
		log('fs-write', path);
		notify();
	}
	async function callOperation(name, args) {
		pause();
		const op = app.operations.find((o) => o.name === name);
		if (!op) throw Error(`Unknown bridge operation ${name}`);
		if (!Array.isArray(args) || args.length !== op.types.length) throw Error('Arguments do not match signature');
		const value = await call(op.name, op.result, op.types, args);
		log('call', { name: op.name, args, result: value });
		if (op.name === 'votaInit') app.initialized = Boolean(value);
		if (app.initialized) await readState();
		return value;
	}
	function signatureFor(kind, target) {
		return kind === 'export' ? app.exportSignatures?.find((x) => x.export === target) : app.tableMetadata?.find((x) => x.slot === Number(target));
	}
	function sourceContextFor(meta) {
		const index = meta?.functionIndex ?? meta?.index;
		return (app.sourceContexts || [])
			.filter((x) => x.function_index === index)
			.map((x) => `${x.function}\n${x.file}:${x.line}`)
			.filter((v, i, a) => a.indexOf(v) === i);
	}
	function searchContexts(query) {
		query = query.toLowerCase().trim();
		if (!query) throw Error('Enter a source context search');
		const indices = new Set(app.sourceContexts.filter((x) => (x.function + ' ' + x.file).toLowerCase().includes(query)).map((x) => x.function_index));
		return app.tableMetadata.filter((x) => indices.has(x.functionIndex));
	}
	async function callNative(kind, target, args) {
		pause();
		if (!Array.isArray(args)) throw Error('Arguments must be an array');
		const values = args.map((v) => {
			if (typeof v === 'number' && Number.isFinite(v)) return v;
			if (typeof v === 'string' && /^-?\d+n$/.test(v)) return BigInt(v.slice(0, -1));
			throw Error('Native arguments must be numbers or i64 strings');
		});
		let fn;
		if (kind === 'export') fn = app.exports[target];
		else {
			const slot = Number(target);
			if (!Number.isSafeInteger(slot) || slot < 0) throw Error('Invalid table slot');
			fn = app.exports.Fb.get(slot);
		}
		if (typeof fn !== 'function') throw Error('Target is not a callable function');
		const meta = signatureFor(kind, target);
		if (!meta) throw Error('No verified signature for target');
		if (meta.params.length !== values.length) throw Error(`Expected ${meta.params.length} arguments: ${meta.params.join(', ')}`);
		values.forEach((v, i) => {
			if (meta.params[i] === 'i64' && typeof v !== 'bigint') throw Error('i64 argument requires a bigint string');
			if (meta.params[i] !== 'i64' && typeof v !== 'number') throw Error('Non-i64 argument requires a number');
			if (meta.params[i] === 'i32' && (!Number.isInteger(v) || v < -2147483648 || v > 4294967295)) throw Error('i32 argument outside integer range');
		});
		const result = await app.native.callFunction(fn, values, `${kind} ${target}`);
		log('native', { kind, target, args, result });
		return result;
	}
	async function readContext() {
		const buffer = app.exports.Cb.buffer, pointer = new DataView(buffer).getUint32(1832600, true);
		if (!pointer || pointer + 40 > buffer.byteLength) throw Error('Bridge context is unavailable');
		const flags = Array.from(new Uint8Array(buffer, pointer, 4));
		const state = await readState();
		return {
			pointerSlot: 1832600,
			pointer,
			flags: { initialized: flags[0], done: flags[1], audioEnabled: flags[2], audioEleitorHabilitado: flags[3] },
			matchesState: flags.every((v, i) => Boolean(v) === [state.initialized, state.done, state.audioEnabled, state.audioEleitorHabilitado][i]),
			evidence: 'Static funcs 2094, 7840, 10619, 10171; live checked. Read only; specific to this binary.'
		};
	}
	function readMemory(offset, length) {
		const buffer = app.exports.Cb.buffer;
		if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 1 || length > 4096 || offset + length > buffer.byteLength)
			throw Error('Memory range out of bounds');
		return hexDump(new Uint8Array(buffer, offset, length), offset);
	}
	function readKeyQueue() {
		return app.keys.snapshot();
	}
	function clearKeyQueue() {
		pause();
		app.keys.drop(null, 'cleared by developer');
		log('queue', 'cleared');
		notify();
	}

	/** During the native keyboard test: the key VOTA asks for next ('0'–'9', 'B', 'D', 'C'), else null. */
	function keyboardTestExpectedKey() {
		const p = experiments.state.active;
		if (!p || !app.exports) return null;
		const v = new DataView(app.exports.Cb.buffer);
		if (v.getUint32(p, true) !== 1547140) return null;
		// libc++ std::string in a vector indexed by the test's current position (short/long layouts).
		const a = v.getUint32(p + 48, true) + v.getUint32(p + 60, true) * 12, l = v.getUint8(a + 11);
		const ptr = l & 128 ? v.getUint32(a, true) : a, n = l & 128 ? v.getUint32(a + 4, true) : l;
		const label = new TextDecoder().decode(new Uint8Array(v.buffer, ptr, n));
		return { BRANCO: 'B', CORRIGE: 'D', CONFIRMA: 'C' }[label] || label;
	}

	// ---- Scanner (simulated biometric reader) ----
	async function installScanner() {
		pause();
		if (!experiments.state.fullStartup || training.state.enabled) throw Error('Open isolated Register poll workers first');
		await app.native.transaction(() => installNativeFingerprint(app), 'Install simulated no-capture scanner');
		app.scannerStatus = 'installed';
		notify();
	}
	async function scannerAccept() {
		pause();
		if (!app.fingerprint) throw Error('O leitor biométrico só funciona na sessão completa');
		await app.native.transaction(ctx => experiments.state.current?.name === 'vota::CPedeDigital'
			? app.voterBiometrics.respond(ctx, experiments.state.active, 'correct')
			: app.fingerprint.accept(experiments.state.active), 'Explicit simulated biometric acceptance');
		app.scannerStatus = 'accepted';
		await experiments.tick();
		if (training.state.enabled) await training.tick();
	}
	async function scannerTimeout() {
		pause();
		if (!app.fingerprint) throw Error('O leitor biométrico só funciona na sessão completa');
		await app.native.transaction(ctx => experiments.state.current?.name === 'vota::CPedeDigital'
			? app.voterBiometrics.respond(ctx, experiments.state.active, 'timeout')
			: app.fingerprint.timeout(experiments.state.active), 'Simulated fingerprint timeout');
		app.scannerStatus = 'timeout';
		await experiments.tick();
	}

	async function scannerReject() {
		if (experiments.state.current?.name !== 'vota::CPedeDigital') return scannerTimeout();
		pause();
		await app.native.transaction(ctx => app.voterBiometrics.respond(ctx, experiments.state.active, 'wrong'), 'Simulated voter fingerprint rejection');
		app.scannerStatus = 'rejected';
		await experiments.tick();
	}

	/**
	 * PNG of the urna screen at its native 1280×800 resolution: the original canvas plus
	 * any overlay images the runtime positions over it (e.g. the LIBRAS interpreter).
	 */
	async function captureScreen() {
		const source = document.getElementById('uenux-screen');
		const canvas = document.createElement('canvas');
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext('2d');
		context.drawImage(source, 0, 0);
		const layer = document.getElementById('uenux-gif-layer');
		if (layer) {
			const box = layer.getBoundingClientRect();
			for (const image of layer.querySelectorAll('img')) {
				if (!image.complete || !image.naturalWidth || image.offsetParent === null) continue;
				const r = image.getBoundingClientRect();
				const sx = canvas.width / box.width, sy = canvas.height / box.height;
				context.drawImage(image, (r.left - box.left) * sx, (r.top - box.top) * sy, r.width * sx, r.height * sy);
			}
		}
		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}
	async function exportScreen() {
		const blob = await captureScreen();
		const stamp = new Date(app.clock.now()).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
		downloadBytes(new Uint8Array(await blob.arrayBuffer()), `urna-${stamp}.png`);
		log('screenshot', `exported ${blob.size} bytes`);
	}

	// ---- Module configuration for the unchanged vendor runtime ----
	window.Module = {
		uenuxExternalKeyboard: true,
		votaScreenWidth: 1280,
		votaScreenHeight: 800,
		uenuxDebug: true,
		locateFile(path) {
			return resolveRuntime('vendor/wasm/' + (path.endsWith('.data') && !path.startsWith('vota_web_wasm.') && !path.startsWith('rhvoice-leticia.') ? 'bases/' : '') + path);
		},
		print: (...args) => votaLog('stdout', ...args),
		printErr: (...args) => votaLog('stderr', ...args),
		onAbort: (reason) => fail(`Runtime aborted: ${reason}`),
		instantiateWasm(imports, receive) {
			app.native.installImports(imports);
			app.clock.install(imports);
			// Diagnostics: record the wasm call stack of each native C++ throw (import a.b is
			// ___cxa_throw), so errors can be traced to VOTA functions. Behaviour is unchanged.
			if (typeof imports.a.b !== 'function') throw Error('Native throw import mapping changed');
			const cxaThrow = imports.a.b;
			imports.a.b = (...args) => {
				const limit = Error.stackTraceLimit;
				Error.stackTraceLimit = 80;
				const frames = (new Error().stack || '').match(/wasm-function\[\d+\]/g) ?? [];
				Error.stackTraceLimit = limit;
				app.lastNativeThrow = { at: new Date().toISOString(), frames: frames.map((f) => Number(f.slice(14, -1))) };
				log('native-throw', app.lastNativeThrow);
				return cxaThrow(...args);
			};
			// Diagnostics: log each sound VOTA hands to the browser (import a.da is
			// js_wasm_web_sound_play_wav: header, header size, data, data size, volume, mode).
			if (typeof imports.a.da !== 'function') throw Error('Native sound import mapping changed');
			const playWav = imports.a.da;
			app.soundStats = { calls: 0, bytes: 0, last: null };
			imports.a.da = (...args) => {
				app.soundStats.calls++;
				app.soundStats.bytes += args[3] >>> 0;
				app.soundStats.last = { at: new Date().toISOString(), dataSize: args[3] >>> 0, volume: args[4], mode: args[5] };
				log('native-sound', app.soundStats.last);
				return playWav(...args);
			};
			installTerminalDecoder({ app, imports, log, notify, rawText: () => document.getElementById('mt')?.textContent ?? '' });
			// Compatibility patches are applied in memory to a copy of the TSE binary, only if it is
			// exactly the analysed build (runtime/wasm-patches.js, documented in adaptacoes.js).
			fetch(resolveRuntime('vendor/wasm/vota_web_wasm.wasm'))
				.then((r) => r.arrayBuffer())
				.then((bytes) => applyPatches(bytes, EXPECTED['vendor/wasm/vota_web_wasm.wasm']))
				.then((patched) => {
					app.wasmPatches = { sha256: patched.sha256, applied: patched.applied, skipped: patched.skipped };
					log('wasm-patches', app.wasmPatches);
					const bytes = patched.sha256 === EXPECTED['vendor/wasm/vota_web_wasm.wasm'] ? addBiometricExports(patched.bytes) : patched.bytes;
					return WebAssembly.instantiate(bytes, imports);
				})
				.then(({ instance, module }) => {
					app.exports = instance.exports;
					// Before the module's constructors run (receive() starts them). A staged media's
					// configuration is known already (its section feeds the correspondence fixture).
					try {
						app.stagedConfig = options.loadDraft ? JSON.parse(sessionStorage.getItem('vota-load-draft-v1'))?.config ?? null : null;
					} catch {
						app.stagedConfig = null;
					}
					if (app.wasmPatches.applied.length) installCorrespondenceFixture(app);
					app.wasmModule = module;
					app.exportInventory = WebAssembly.Module.exports(module);
					receive(instance, module);
				})
				.catch(fail);
			return {};
		},
		postRun: [
			() => {
				Module.ccall = (...args) => app.native.ccall(...args);
				app.ready = true;
				log('runtime', 'ready');
				notify();
			}
		]
	};
	// The vendor's single key queue becomes the per-keypad router, and stays it (runtime/key-router.js).
	app.keys.install(window.Module);

	function step(name) {
		app.bootStep = name;
		notify();
	}
	async function boot() {
		step('discovery');
		await prepareRuntime();
		// Canvas text does not wait for web fonts: load the urna font before VOTA draws,
		// or the first screens fall back to Arial and later ones switch fonts.
		await Promise.all(['400', '700'].map((w) => document.fonts.load(`${w} 16px "Atkinson Hyperlegible Next"`))).catch((e) => log('font-load-error', String(e)));
		[app.tableMetadata, app.exportSignatures, app.sourceContexts] = await Promise.all(
			['function-table', 'exports', 'source-location-uses'].map(async (name) => (await fetch(`discovery/${name}.json`)).json())
		);
		const response = await fetch(resolveRuntime('vendor/wasm/bases/manifest.json'));
		if (!response.ok) throw Error('A lista de cenários não foi encontrada nesta instalação');
		app.scenarios = (await response.json()).scenarios;
		const scenario = app.scenarios.find((s) => s.id === options.scenario);
		if (!scenario) throw Error('Cenário desconhecido');
		app.scenario = scenario;
		app.audioEnabled = options.voice;
		step('runtime');
		await script(resolveRuntime('vendor/wasm/vota_web_wasm.js'));
		await waitFor(() => app.ready, 'runtime');
		step('scenario');
		await script(resolveRuntime('vendor/wasm/bases/' + scenario.dataJs));
		const sentinel = `/dsk/fi/estatico/${scenario.fase === 'of' ? 'o' : 't'}${String(scenario.pe).padStart(5, '0')}${scenario.uf.toLowerCase()}-pu.dat`;
		await waitFor(() => Module.FS.analyzePath(sentinel).exists, 'scenario package');
		for (const alias of scenario.aliases || []) {
			if (!Module.FS.analyzePath(alias.target).exists) {
				Module.FS.mkdirTree(alias.target.replace(/\/[^/]+$/, ''));
				Module.FS.symlink(alias.source, alias.target);
			}
		}
		if (options.voice || terminalSession()) {
			step('voice');
			await script(resolveRuntime('vendor/wasm/rhvoice-leticia.data.js'));
			await waitFor(() => Module.FS.analyzePath('/share/RHVoice/voices/Leticia-F123/16000/voice.data').exists, 'voice package');
		}
		step('init');
		app.bootConfig = await app.loadEditor.bootstrap(scenario, configFor(scenario));
		// Session snapshot resumed after a restart: VOTA's own saved files come back before it starts.
		app.resumedFiles = restoreSavedFiles(Module.FS);
		// Start-screen clock (staged media carry their own clock).
		if (options.clock && !options.loadDraft) {
			if (options.clock === 'real') app.clock.configure({ mode: 'real', iso: new Date().toISOString() });
			else if (options.clock === 'election') {
				const preset = app.clock.electionDayPreset();
				app.clock.configure({ mode: 'running', iso: new Date(preset.local.replace('T08:00:00', 'T07:59:00')).toISOString() });
			} else if (!Number.isNaN(Date.parse(options.clock))) app.clock.configure({ mode: 'running', iso: options.clock });
		}
		try {
			await enqueue(initialize);
			app.loadEditor.nativeResult(true);
		} catch (e) {
			app.loadEditor.nativeResult(false, String(e));
			throw e;
		}
		experiments.refresh();
		step('ready');
		if (options.start && !options.loadDraft) {
			await startFollowUp();
			return;
		}
		if (options.session || options.fullSession) await enqueue(() => training.start());
	}

	/** Start-screen follow-ups that need the booted scenario's files. */
	async function startFollowUp() {
		const editor = app.loadEditor;
		if (options.start === 'official') {
			// Official sessions are prepared in the Mídia de carga window (identity, eleitorado,
			// candidates, signatures): the start screen only opens it on this scenario.
			app.officialSetup = true;
			notify();
			return;
		} else if (options.start === 'import') {
			step('official');
			const { storedMedia } = await import('../launcher/prefs.js');
			const text = await storedMedia();
			if (!text) throw Error('A mídia enviada na tela de inicialização não está mais disponível. Envie-a novamente.');
			await editor.importPackage(JSON.parse(text));
		}
		await editor.apply();
	}

	// ---- Public API (window.urnaEmu) ----
	Object.assign(app, {
		log,
		fail,
		enqueue,
		call: (...args) => enqueue(() => call(...args)),
		tick: () => enqueue(tick),
		readState: () => enqueue(readState),
		press: (key) => submitKey(key),
		pressTerminal: (key) => submitKey(key, 'mesario'),
		submitKey,
		/** Press an on-screen keypad button ([data-vota-key] / [data-terminal-key]) and await the key. */
		pressKeyElement: (element) => {
			if (!element) throw Error('Tecla não encontrada');
			if (element.disabled) throw Error('Tecla desativada');
			const terminal = element.dataset.terminalKey;
			return submitKey(terminal ?? element.dataset.votaKey, terminal ? 'mesario' : 'voter');
		},
		keyboardTarget,
		keyboardTestExpectedKey,
		/** Hold the engine until urnaEmu.run() (tests/tools); the interface never pauses. */
		pause: () => {
			app.autoRun = false;
			pause();
		},
		run: () => {
			app.autoRun = true;
			run();
		},
		toggleRun: () => (app.running ? app.pause() : app.run()),
		step: () => enqueue(() => {
			pause();
			return tick();
		}),
		browse: (path = '/') => enqueue(() => browse(path)),
		readFile,
		writeFile,
		downloadBytes,
		captureScreen,
		exportScreen,
		startSession: (opts = {}) => {
			const next = { scenario: opts.scenario ?? options.scenario, voice: opts.voice ?? options.voice };
			for (const flag of TRAINING_SESSION_FLAGS) next[flag] = true;
			reboot(next);
		},
		loadScenario: (scenario = options.scenario, voice = options.voice) => reboot({ scenario, voice }),
		reload: () => location.reload(),
		setDebug: (enabled) => {
			Module.uenuxDebug = app.debug = Boolean(enabled);
			log('debug', Module.uenuxDebug);
			notify();
		},
		scanner: {
			install: () => enqueue(installScanner),
			accept: () => enqueue(scannerAccept),
			timeout: () => enqueue(scannerTimeout),
			/**
			 * Place a finger on the simulated reader. The correct finger injects the
			 * native acceptance; a wrong finger selects the native voter rejection (or
			 * the registration timeout for mesários). No biometric matching happens.
			 */
			place: (correct) => enqueue(correct ? scannerAccept : scannerReject)
		},
		dev: {
			browse,
			readFile,
			writeFile,
			callOperation: (name, args) => enqueue(() => callOperation(name, args)),
			callNative: (kind, target, args) => enqueue(() => callNative(kind, target, args)),
			signatureFor,
			sourceContextFor,
			searchContexts,
			readContext: () => enqueue(readContext),
			readMemory,
			readKeyQueue,
			clearKeyQueue: () => enqueue(clearKeyQueue),
			startEntry: (entry) => enqueue(() => experiments.start(entry)),
			startKeyboardTest: () => enqueue(() => experiments.startKeyboard()),
			initialize: () =>
				enqueue(() => {
					pause();
					return initialize();
				}),
			installPrinter: () =>
				enqueue(async () => {
					if (!experiments.state.fullStartup) throw Error('Initialize native startup or start a training session first');
					await app.installPrinter();
				}),
			hexDump,
			formatValue
		},
		cancelNative: () => {
			pause();
			app.native.cancel();
		},
		boot: () => boot().catch(fail)
	});
	return app;
}
