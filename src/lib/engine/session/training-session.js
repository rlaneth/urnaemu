// Integrated session: native voter executor + reconstructed missing operator
// thread pump. It never sets vote counters, done flags or election results.
import { createOperatorEventPump } from './operator-event-pump.js';
import { installNativeFingerprint } from '../services/native-fingerprint.js';

export function createTrainingSession({ app, experiments, call, readState, pause, run, log, notify }) {
	const state = {
		enabled: false,
		booting: false,
		closed: false,
		voterEnabled: false,
		voterStarted: false,
		keyboardOwner: 'mesario',
		lastEvents: [],
		error: null,
		operatorFinished: false,
		reportPending: false,
		ticks: 0,
		lastTicks: []
	};
	let pump = null;

	function finishOperator() {
		state.voterEnabled = false;
		const pointer = experiments.state.active;
		state.operatorFinished = Boolean(pointer && new DataView(app.exports.Cb.buffer).getUint32(pointer, true) === 0x186e48);
		state.reportPending = state.operatorFinished;
		if (state.operatorFinished) state.keyboardOwner = 'voter';
		state.closed = !state.operatorFinished;
		if (state.closed) pause();
		notify();
	}
	// Native screen ticks (countdowns, clock re-checks): see operator-event-pump.js.
	// During boot the harness runs the voter thread's boot screens; afterwards the operator's.
	async function deliverTicks() {
		if (!pump || experiments.state.stopped) return;
		const delivered = await pump.deliverTicks(app.clock.now(), state.booting ? 'eleitor' : 'operador');
		if (delivered.length) {
			state.ticks += delivered.length;
			state.lastTicks = delivered;
		}
	}
	function recordEvents(events) {
		if (events.length) {
			state.lastEvents = events;
			log('native-operator-events', events);
		}
	}
	async function tick() {
		if (state.closed) return;
		if (state.booting) {
			await experiments.tick();
			await deliverTicks();
			const p = experiments.state.active;
			// The voting-start wait (vota::CInicioVotacao) re-checks the clock on its own native
			// tick, now delivered by deliverTicks().
			if (new DataView(app.exports.Cb.buffer).getUint32(p, true) === 0x176424) {
				await experiments.attachOperator();
				state.booting = false;
				state.voterStarted = true;
				state.keyboardOwner = 'mesario';
				recordEvents(await pump.drain());
				log('boot-handoff', 'Native boot reached waiting state; operator receives native queued messages');
			}
			notify();
			return;
		}
		if (experiments.state.stopped && !state.operatorFinished) {
			finishOperator();
			if (state.closed) return;
		}
		if (app.keys.pending()) throw Error('Há teclas sem dono na fila do VOTA; reinicie a sessão');
		try {
			// Full-session initialization omits the bridge's automatic voter event.
			// Keep processing native boot/registration messages before any voter exists.
			if (state.voterStarted) await pump.voterTick();
			if (!state.operatorFinished) {
				recordEvents(await pump.drain());
				await deliverTicks();
			}
			const current = await readState(), previouslyEnabled = state.voterEnabled;
			state.voterEnabled = state.voterStarted && current.state === 'vota::CEleitorVotando';
			if (state.voterEnabled !== previouslyEnabled) state.keyboardOwner = state.voterEnabled ? 'voter' : 'mesario';
			if (experiments.state.stopped) finishOperator();
			if (state.operatorFinished && current.state === 'vota::CAplicacaoEncerrada') {
				state.closed = true;
				state.reportPending = false;
				pause();
			}
			notify();
		} catch (error) {
			state.error = String(error);
			pause();
			notify();
			throw error;
		}
	}
	async function press(key, source) {
		// Keys are never refused: each goes to its own keypad's queue, VOTA reads it or not,
		// and whatever it did not read is dropped (runtime/key-router.js).
		const keypad = source === 'mesario' ? 'mesario' : 'voter';
		if (state.closed || (experiments.state.stopped && !state.operatorFinished)) {
			log('key-ignored', { source, key, reason: 'native session stopped' });
			return;
		}
		if (state.booting) {
			// Boot screens (keyboard test, zerésima) read the urna keypad.
			await app.keys.input(keypad, () => call('votaPressKey', null, ['string'], [key]));
			log('boot-key', { source, key });
			await tick();
			app.keys.drop(keypad, 'not read during boot');
			return;
		}
		// Keys on a locked urna still go to VOTA, which decides what to do with them. Each keypad
		// has its own queue (runtime/key-router.js): the voter executor reads only the urna's,
		// the operator's terminal screens only the terminal's.
		if (app.keys.pending()) throw Error('Há teclas sem dono na fila do VOTA; reinicie a sessão');
		state.error = null;
		await app.keys.input(keypad, () => call('votaPressKey', null, ['string'], [key]));
		log('key', { source, key, mode: (app.sessionPhase || 'training') + '-phase-session' });
		try {
			// After closing, the operator's screens are finished: only the urna side runs.
			if (source !== 'mesario') await pump.voterTick();
			else if (!experiments.state.stopped) await experiments.tick();
			// A key the active state did not read is discarded, not kept for a later screen.
			app.keys.drop(keypad, 'not read by the active native state');
			await tick();
		} catch (error) {
			app.keys.drop(null, 'error');
			state.error = String(error);
			pause();
			notify();
			throw error;
		}
	}
	async function start() {
		if (state.enabled) throw Error('A sessão já começou: reinicie o emulador para uma sessão nova');
		const options = app.sessionOptions;
		await app.installPrinter();
		if (options.persist) await app.installRdvPersistence();
		if (options.crypto) {
			await app.installTestCrypto();
			if (options.testkey) await app.installTestVoteKey();
		}
		options.locked = true;
		pump = createOperatorEventPump(app);
		// In a session the operator thread reads the terminal keypad, except on the boot screens
		// (keyboard test, zerésima), which the urna keypad drives as on the real urna.
		experiments.setKeypadRule(() => (state.booting ? 'voter' : 'mesario'));
		await experiments.start('startup');
		await app.native.transaction(() => installNativeFingerprint(app), 'Install simulated no-capture scanner');
		state.enabled = true;
		state.booting = true;
		state.keyboardOwner = 'voter';
		log('session-start', 'Cold native startup, required keyboard test, zerésima and operator message handoff');
		await tick();
		run();
	}
	function chooseKeyboard(owner) {
		if (state.booting && owner !== 'voter') throw Error('Durante a abertura, o teclado do computador controla a urna');
		if (!['mesario', 'voter'].includes(owner)) throw Error('Aparelho de teclado desconhecido');
		state.keyboardOwner = owner;
		notify();
	}

	return { state, start, tick, press, render: notify, chooseKeyboard };
}
