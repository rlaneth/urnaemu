// Drives a session through the public keypad API, as a mesário and a voter would: waits for
// VOTA to read the right keypad, presses keys, and reacts to VOTA's own prompts. Shared by the
// voter simulator and the guided tours ("Fazer por mim"). It never touches counters or
// native state directly.
import { keypadState } from '../store.js';

export function createKeypadDriver(app, { shouldStop = () => false } = {}) {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const terminalText = () => app.terminalText || '';
	// Whether VOTA's side for that keypad is reading it right now (keys are never disabled).
	const keypadEnabled = (device) => keypadState(app)[device === 'mesario' ? 'terminal' : 'voter'];

	async function waitFor(test, label, timeout = 30000) {
		const deadline = Date.now() + timeout;
		while (!(await test())) {
			if (shouldStop()) throw Error('stopped');
			if (app.error) throw Error(app.error);
			if (Date.now() > deadline)
				throw Error(`Tempo esgotado aguardando: ${label} (terminal: ${JSON.stringify(terminalText())}; eleitor liberado: ${app.session?.voterEnabled}; teclado do terminal: ${keypadEnabled('mesario')})`);
			await sleep(60);
		}
	}
	async function press(key, device, pace = 0) {
		await waitFor(() => keypadEnabled(device), `teclado ${device === 'mesario' ? 'do terminal' : 'da urna'}`);
		await app.submitKey(key, device);
		if (pace) await sleep(pace);
	}
	async function settle() {
		for (let i = 0; i < 120; i++) {
			const s = await app.readState();
			if (!s.substate?.includes('CConfereVotoEmCargo')) return s;
			await sleep(40);
		}
		throw Error('O voto não foi processado');
	}

	/** Release the urna for a voter: training (voter null) or a voter of the eleitorado. */
	async function authorize(voter, pace) {
		// VOTA's operator state, shown on the terminal, is the reliable signal: the prompt for
		// the next voter with the cabin free means ready; "CABINA: OCUPADA" means released.
		const occupied = () => /CABINA: OCUPADA/.test(terminalText());
		await waitFor(() => /CABINA: LIVRE/.test(terminalText()) && /CONFIRMA: votar|Digite o T[ií]tulo/i.test(terminalText()) && keypadEnabled('mesario'), 'identificação do eleitor');
		if (!voter) {
			// Training: CONFIRMA releases an anonymous trainee; retry if the key was not taken.
			for (let attempt = 0; attempt < 3 && !occupied(); attempt++) {
				await press('C', 'mesario', pace);
				const until = Date.now() + 4000;
				while (!occupied() && Date.now() < until) await sleep(80);
			}
		} else {
			for (const k of voter.title) await press(k, 'mesario', pace);
			await press('C', 'mesario', pace);
			// Answer VOTA's own prompts until the urna is released.
			for (let step = 0; step < 12 && !occupied(); step++) {
				await sleep(120);
				if (occupied()) break;
				const text = terminalText();
				if (/j[aá] votou/i.test(text)) throw Error(`${voter.name} já votou`);
				if (app.experiments.state.current?.name === 'vota::CPedeDigital' && app.fingerprint?.state.capturing) {
					await app.scanner.place(true);
				} else if (/ano de nascimento/i.test(text) && keypadEnabled('mesario')) {
					for (const k of voter.birth.slice(0, 4)) await press(k, 'mesario', pace);
					await press('C', 'mesario', pace);
				} else if (keypadEnabled('mesario')) await press('C', 'mesario', pace);
			}
		}
		await waitFor(() => occupied() && app.session.voterEnabled, 'liberação da urna');
	}

	/**
	 * Vote every office of the ballot. `choose(cargo, apt)` returns {strategy, candidate}
	 * with strategy 'candidato', 'legenda', 'branco' or 'nulo'.
	 * @returns {{cargo: string, choice: string}[]}
	 */
	async function ballot(choose, pace) {
		const choices = [];
		// Offices with several seats (e.g. two Senate seats) are voted once per seat; voting for
		// the same candidate again makes that vote null ("nulo por repetição").
		const chosen = {};
		for (let office = 0; office < 12; office++) {
			const s = await app.readState();
			if (s.state !== 'vota::CEleitorVotando' || !s.cargo) break;
			const cargo = s.cargo, apt = (s.candidates ?? []).filter((c) => c.apt !== false);
			const { strategy, candidate } = choose(cargo, apt, chosen[cargo.name] ?? new Set());
			let label;
			if (strategy === 'branco') {
				await press('B', 'voter', pace);
				label = 'Branco';
			} else {
				let digits;
				if (strategy === 'candidato') {
					digits = String(candidate.number);
					const seen = (chosen[cargo.name] ??= new Set());
					label = seen.has(candidate.number) ? 'Nulo' : `${candidate.number} · ${candidate.name}`;
					seen.add(candidate.number);
				} else if (strategy === 'legenda') {
					digits = String(candidate?.party ?? '').padStart(cargo.legendaDigits, '0').slice(0, cargo.legendaDigits);
					label = `Legenda ${digits}`;
				} else {
					digits = '9'.repeat(cargo.digits);
					label = 'Nulo';
				}
				for (const k of digits) await press(k, 'voter', pace);
			}
			await settle();
			for (let i = 0; i < 3; i++) {
				const before = await app.readState();
				if (before.state !== 'vota::CEleitorVotando' || before.cargo?.id !== cargo.id) break;
				await press('C', 'voter', pace);
				await settle();
			}
			choices.push({ cargo: cargo.name, choice: label });
		}
		await waitFor(() => !/CABINA: OCUPADA/.test(terminalText()), 'fim do voto');
		return choices;
	}

	return { sleep, terminalText, keypadEnabled, waitFor, press, settle, authorize, ballot };
}
