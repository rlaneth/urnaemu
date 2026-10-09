// One reactive snapshot of the engine, rebuilt at most once per animation frame.
// Engine objects stay plain JS (identity and DataView based); the UI only reads snapshots.
import { writable } from 'svelte/store';
import { terminalLines, terminalLamps } from './devices/terminal.js';
import { powerIcon } from './devices/power.js';
import { derivePhase } from './session/phases.js';

/** Which keypads accept input. Mirrors the former training/experimental render() rules. */
export function keypadState(app) {
	const session = app.session, exp = app.experiments?.state;
	if (session?.enabled) {
		if (session.booting) return { voter: !exp.stopped, terminal: false };
		const closing = session.operatorFinished && !session.closed;
		const stopped = session.closed || (exp.stopped && !closing);
		return { voter: !(stopped || (!session.voterEnabled && !closing)), terminal: !(stopped || closing) };
	}
	if (exp?.enabled) {
		const operator = exp.role === 'mesario' && !exp.stopped;
		return { voter: !operator, terminal: operator };
	}
	return { voter: true, terminal: false };
}

/** Session progress code; the UI translates it. */
export function sessionStatus(app) {
	const session = app.session, exp = app.experiments?.state;
	if (!session?.enabled) return exp?.enabled ? (exp.stopped ? 'experimental-stopped' : 'experimental') : 'bridge';
	if (session.booting) return exp.stopped ? 'boot-stopped' : 'booting';
	const closing = session.operatorFinished && !session.closed;
	const stopped = session.closed || (exp.stopped && !closing);
	if (session.error) return 'error';
	if (session.closed) return 'closed';
	if (stopped) return session.reportPending ? 'report-pending' : 'stopped';
	if (closing) return 'closing';
	if (session.voterEnabled) return 'voting';
	return 'awaiting-voter';
}

export function snapshot(app) {
	const s = baseSnapshot(app);
	s.phaseId = derivePhase(s);
	return s;
}

function baseSnapshot(app) {
	const exp = app.experiments?.state;
	const printer = app.printer, capture = app.paperCapture?.state;
	const raw = typeof document !== 'undefined' ? (document.getElementById('mt')?.textContent ?? '') : '';
	return {
		bootStep: app.bootStep,
		status: app.status,
		error: app.error,
		ready: app.ready,
		initialized: app.initialized,
		running: app.running,
		autoRun: app.autoRun,
		phase: app.sessionPhase ?? null,
		options: app.options,
		sessionOptions: { ...app.sessionOptions },
		scenario: app.scenario ?? null,
		scenarios: app.scenarios,
		native: app.nativeStatus ? { ...app.nativeStatus } : null,
		vota: app.lastState,
		operator: exp
			? {
					enabled: exp.enabled,
					entry: exp.entry,
					role: exp.role,
					stopped: exp.stopped,
					reason: exp.reason,
					fullStartup: exp.fullStartup,
					current: exp.current?.name ?? null,
					currentError: exp.current?.error ?? null
				}
			: null,
		session: app.session ? { ...app.session, status: sessionStatus(app) } : null,
		// VOTA's saved files were restored from a snapshot before it started (snapshot.js).
		resumed: !!app.resumedFiles?.length,
		// VOTA is waiting for the voting start time (08:00 on election day).
		waitingForStart: exp?.current?.name === 'vota::CInicioVotacao',
		keypads: keypadState(app),
		keyboardTarget: app.keyboardTarget?.() ?? 'voter',
		terminal: {
			lines: terminalLines(app, raw),
			// Decoded from the original bytes (UTF-8, Windows-1252 fallback); `raw` is the
			// vendor runtime's own UTF-8 conversion written into #mt.
			text: app.terminalText ?? '',
			raw,
			busy: app.terminalBusy ?? null,
			encoding: app.terminalEncoding ?? null,
			lamps: terminalLamps(app)
		},
		serialPrinter: app.serialPrinter ? { ...app.serialPrinter.state, settings: { ...app.serialPrinter.state.settings } } : null,
		power: app.power ? { ...app.power.state, image: powerIcon(app.power.state) } : null,
		clock: app.clock ? { ...app.clock.settings, installed: app.clock.installed, stats: { ...app.clock.stats } } : null,
		printer: printer
			? {
					installed: printer.installed,
					printing: printer.printing,
					pending: printer.pending,
					speed: printer.speed,
					visibleOperations: printer.visibleOperations,
					operations: capture?.operations.length ?? 0,
					captures: capture?.captures.length ?? 0,
					spools: capture?.spools?.length ?? 0,
					replays: capture?.replays?.length ?? 0
				}
			: null,
		resultMedia: app.resultMedia,
		fullSession: !!app.fullSession,
		scanner: {
			installed: !!app.fingerprint,
			status: app.scannerStatus,
			capturing: !!app.fingerprint?.state.capturing,
			indicator: app.fingerprint?.state.indicator ?? 0,
			// Only active native fingerprint prompts accept simulated outcomes.
			prompt: ['comum::CPedeDigitalMesario', 'vota::CPedeDigital'].includes(exp?.current?.name)
		},
		crypto: app.cryptoStatus,
		rdvPersistence: app.rdvPersistence,
		testGap: app.testGap ? { changed: app.testGap.changes.filter((x) => x.changed).length } : null,
		load: app.loadEditor
			? {
					status: app.loadEditor.status,
					dirty: app.loadEditor.dirty,
					signed: app.loadEditor.signed,
					trusted: app.loadEditor.trusted,
					revision: app.loadEditor.revision,
					provider: app.loadEditor.provider?.algorithm ?? null,
					identity: app.loadEditor.identity ?? null
				}
			: null,
		logRevision: app.logger?.revision ?? 0,
		logdRevision: app.logd?.revision ?? 0,
		simulator: app.simulator ? { ...app.simulator.state, tally: app.simulator.state.tally } : null,
		audioEnabled: app.audioEnabled,
		debug: app.debug
	};
}

export function createEngineStore() {
	const store = writable(null);
	let app = null, frame = 0;
	function flush() {
		frame = 0;
		if (app) store.set(snapshot(app));
	}
	return {
		subscribe: store.subscribe,
		bind(engine) {
			app = engine;
			flush();
		},
		notify() {
			if (!frame) frame = requestAnimationFrame(flush);
		},
		flush
	};
}
