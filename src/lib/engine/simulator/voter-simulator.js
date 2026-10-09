// Voter simulator: casts many ballots through the public keypad API, exactly as a mesário
// and voters would, and keeps the expected tally to compare with the BU. It never touches
// counters or native state directly.
import { createKeypadDriver } from '../session/keypad-driver.js';
import { readEleitorado } from '../load/eleitorado.js';

const STRATEGIES = ['candidato', 'legenda', 'branco', 'nulo'];

function rng(seed) {
	let x = seed >>> 0 || 1;
	return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function createVoterSimulator({ app, log, notify }) {
	const state = { running: false, cast: 0, total: 0, current: null, error: null, tally: {}, ballots: [] };
	let stopRequested = false;
	const driver = createKeypadDriver(app, { shouldStop: () => stopRequested });

	/** Weighted random choice; party votes only for proportional offices. */
	function chooser(random, weights) {
		return (cargo, apt) => {
			const allowed = STRATEGIES.filter((k) => (k !== 'legenda' || cargo.legendaDigits) && (k !== 'candidato' || apt.length));
			const total = allowed.reduce((n, k) => n + (weights[k] ?? 0), 0) || 1;
			let pick = random() * total, strategy = allowed[0];
			for (const k of allowed)
				if ((pick -= weights[k] ?? 0) <= 0) {
					strategy = k;
					break;
				}
			return { strategy, candidate: apt[Math.floor(random() * apt.length)] };
		};
	}
	async function ballot(random, weights, pace) {
		const choices = await driver.ballot(chooser(random, weights), pace);
		for (const { cargo, choice } of choices) (state.tally[cargo] ??= {})[choice] = (state.tally[cargo][choice] ?? 0) + 1;
		return choices;
	}
	const authorize = (voter, pace) => driver.authorize(voter, pace);

	async function start({ count = 5, seed = 1, weights = { candidato: 6, legenda: 1, branco: 1, nulo: 1 }, pace = 120 } = {}) {
		if (state.running) throw Error('O simulador já está em execução');
		if (!app.session?.enabled || app.session.booting) throw Error('Inicie uma sessão completa e conclua a abertura antes de simular eleitores');
		const official = app.sessionPhase === 'official';
		const eleitorado = official ? readEleitorado(app.loadEditor.files) : [];
		const total = official ? Math.min(count, eleitorado.length) : count;
		Object.assign(state, { running: true, cast: 0, total, current: null, error: null });
		stopRequested = false;
		app.run();
		notify();
		const random = rng(seed);
		log('voter-simulator', { event: 'start', count: total, seed, weights, official });
		try {
			for (let i = 0; i < total && !stopRequested; i++) {
				const voter = official ? eleitorado[i] : null;
				state.current = voter?.name ?? `Eleitor ${i + 1}`;
				notify();
				await authorize(voter, pace);
				state.ballots.push({ voter: state.current, choices: await ballot(random, weights, pace) });
				state.cast++;
				notify();
			}
		} catch (error) {
			if (error.message !== 'stopped') state.error = String(error.message ?? error);
		} finally {
			state.running = false;
			state.current = null;
			log('voter-simulator', { event: 'end', cast: state.cast, error: state.error });
			notify();
		}
	}
	function stop() {
		stopRequested = true;
	}
	function reset() {
		if (state.running) return;
		Object.assign(state, { cast: 0, total: 0, error: null, tally: {}, ballots: [] });
		notify();
	}
	return { state, start, stop, reset, eleitorado: () => readEleitorado(app.loadEditor.files) };
}
