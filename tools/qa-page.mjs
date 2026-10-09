// In-page helpers for driving a live UrnaEmu session (window.qa). Shared by the stress
// QA tool and the browser tests; evaluate QA_PAGE in the page, then call qa.boot() etc.
// They press keys through the same elements a user clicks and never pause the engine.
export const QA_PAGE = String.raw`
window.qa = (() => {
	const w = urnaEmu;
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
	const report = { steps: [], votes: [], errors: [] };
	const note = (label) => report.steps.push({ label, at: w.lastState?.state, operator: w.experiments.state.current?.name, terminal: (w.terminalText || '').split('\n')[0].trim() });
	const stopped = () => (w.experiments.state.stopped && !w.session.operatorFinished) || w.session.error;
	const guard = () => {
		if (w.error) throw Error(w.error);
		if (stopped()) throw Error(w.session.error || w.experiments.state.reason);
	};
	// Whether VOTA's terminal / urna side is reading its keypad right now (keys are never disabled).
	const terminalEnabled = () => document.querySelector('[data-testid=terminal-keypad]')?.dataset.listening === 'true';
	const urnaEnabled = () => document.querySelector('[data-testid=urna]')?.dataset.listening === 'true';
	const press = async (key, device = 'vota') => { await frames(); await w.pressKeyElement(document.querySelector('[data-' + device + '-key="' + key + '"]')); guard(); };
	const typed = async (keys, device) => { for (const k of keys) await press(k, device); };
	const settle = async () => {
		for (let i = 0; i < 120; i++) {
			await w.tick(); guard();
			const s = await w.readState();
			if (!s.substate?.includes('CConfereVotoEmCargo')) return s;
			await sleep(40);
		}
		throw Error('Vote did not settle');
	};
	async function boot() {
		while (!w.session.enabled) { if (w.error) throw Error(w.error); await sleep(50); }
		await press('C');
		for (let i = 0; i < 13; i++) await press(w.keyboardTestExpectedKey());
		note('keyboard-test');
		// Confirm the zerésima prompts (VOTA adds a "late" confirmation after opening time).
		// Time-based: VOTA may legitimately wait for the voting start time (08:00).
		const deadline = Date.now() + 90000;
		while (w.session.booting && Date.now() < deadline) {
			if (urnaEnabled() && /Zeresima|Reimprimir/.test(w.experiments.state.current?.name || '')) { await press('C'); note('zeresima-confirm'); }
			else { await w.tick(); guard(); await sleep(150); }
		}
		if (w.session.booting) throw Error('Boot did not hand off to the operator');
		note('boot-complete');
	}
	async function authorize(official) {
		if (official) await typed(official.title + 'CC' + official.birth + 'CC', 'terminal');
		else await press('C', 'terminal');
		for (let i = 0; i < 15 && !w.session.voterEnabled; i++) { await w.tick(); guard(); }
		if (!w.session.voterEnabled) throw Error('Voter not authorized: ' + (w.terminalText || '').split('\n')[0]);
		note('authorized');
	}
	const STRATEGIES = ['candidato', 'branco', 'nulo', 'legenda', 'corrige'];
	async function vote(seed) {
		const ballot = [];
		for (let office = 0; office < 12; office++) {
			const s = await w.readState();
			if (s.state !== 'vota::CEleitorVotando' || !s.cargo) break;
			const cargo = s.cargo, apt = (s.candidates || []).filter((c) => c.apt !== false);
			let strategy = STRATEGIES[(seed + office) % STRATEGIES.length];
			if (strategy === 'legenda' && !cargo.legendaDigits) strategy = 'branco';
			if ((strategy === 'candidato' || strategy === 'corrige') && !apt.length) strategy = 'branco';
			const pick = apt[(seed * 7 + office) % Math.max(1, apt.length)];
			if (strategy === 'branco') await press('B');
			else if (strategy === 'candidato') await typed(String(pick.number));
			else if (strategy === 'nulo') await typed('9'.repeat(cargo.digits));
			else if (strategy === 'legenda') await typed(String(pick?.party ?? '9'.repeat(cargo.legendaDigits)).slice(0, cargo.legendaDigits));
			else if (strategy === 'corrige') { await typed(String(pick.number).slice(0, 2)); await press('D'); await typed(String(pick.number)); }
			await settle();
			// Confirm; some choices (nulo, legenda) ask again.
			for (let i = 0; i < 3; i++) {
				const before = await w.readState();
				if (before.state !== 'vota::CEleitorVotando' || before.cargo?.id !== cargo.id) break;
				await press('C'); await settle();
			}
			ballot.push({ cargo: cargo.name, strategy, number: pick?.number });
		}
		for (let i = 0; i < 40 && w.session.voterEnabled; i++) { await w.tick(); guard(); await sleep(40); }
		for (let i = 0; i < 10; i++) { await w.tick(); guard(); }
		report.votes.push(ballot);
		note('ballot-complete');
	}
	async function exploreOptions() {
		// CORRIGE on the terminal opens the operator options; CORRIGE again returns.
		await press('D', 'terminal'); note('terminal-options');
		const options = (w.terminalText || '').split('\n').map((l) => l.trim()).filter(Boolean);
		await press('D', 'terminal'); for (let i = 0; i < 5; i++) { await w.tick(); guard(); }
		note('terminal-options-back');
		return options;
	}
	/**
	 * VOTA's periodic cabin inspection: "Por favor, inspecione cabina e urna" (CONFIRMA on the
	 * urna), then the mesário confirms on the terminal (CConfirmaInspecionada).
	 */
	async function completeInspection() {
		let acted = false;
		for (let i = 0; i < 12; i++) {
			await frames(); await w.tick(); guard();
			const s = await w.readState(), op = w.experiments.state.current?.name || '';
			if (s.state === 'vota::CInspecionaUrna') await press('C');
			else if (/Inspec/.test(op)) await press('C', 'terminal');
			else return acted;
			acted = true;
			note('inspection-step');
		}
		throw Error('Inspection did not finish');
	}
	async function close(official) {
		// Finish any ballot left open (e.g. by fuzzing) before jumping the clock; otherwise
		// the jump makes VOTA suspend that voter, a path the web build cannot run (threads).
		if (w.session.voterEnabled) { await vote(0); note('ballot-finished-before-closing'); }
		toClosingTime(official?.closeTime);
		// Jumping the clock can make VOTA's inspection timer due: complete the inspection first.
		await sleep(400);
		await completeInspection();
		// Back to the voter-identification screen, then open the options menu.
		for (let i = 0; i < 6 && !/Digite o T[ií]tulo/i.test(w.terminalText || ''); i++) {
			if (terminalEnabled()) await press('D', 'terminal'); else { await w.tick(); guard(); }
		}
		// CORRIGE first erases typed digits; press until the options menu shows.
		for (let i = 0; i < 4 && !/Selecione a op/i.test(w.terminalText || ''); i++) await press('D', 'terminal');
		const text = w.terminalText || '';
		const option = text.match(/(\d)\s*[-–:.)]?\s*Encerr/i)?.[1] ?? '2';
		note('closing-menu');
		await press(option, 'terminal');
		const title = official?.title ?? '010309782003';
		let mediaQueries = w.fullSession?.state.resultMedia?.presenceQueries ?? 0;
		for (let step = 0; step < 80 && !w.session.closed; step++) {
			await frames();
			if (w.fullSession?.state.resultMedia?.presenceQueries > mediaQueries && w.resultMedia?.present) { w.media.eject(); note('media-ejected'); mediaQueries = Infinity; }
			const s = await w.readState(), term = w.terminalText || '';
			if (s.state === 'vota::CInspecionaUrna') { await completeInspection(); continue; }
			if (w.fingerprint?.state.capturing && scannerPrompt()) { await w.scanner.place(true); note('closing-finger'); continue; }
			if (terminalEnabled() && !w.session.operatorFinished && /^\s*Registrar mes[aá]rio\?/i.test(term)) { await press('D', 'terminal'); note('closing-skip-registration'); continue; }
			if (terminalEnabled() && !w.session.operatorFinished) {
				// The closing asks for a mesário's title; the voter prompt ("Digite o Título ou o CPF") is not it.
				if (/t[ií]tulo/i.test(term) && !/CPF/.test(term) && !/\d{12}/.test(term)) { await typed(title, 'terminal'); note('closing-title'); }
				await press('C', 'terminal');
			} else if (urnaEnabled()) {
				await press(s.state === 'vota::CEmitirMaisBU' ? 'D' : 'C');
			} else { await w.tick(); guard(); await sleep(60); }
			note('closing-step');
		}
		note(w.session.closed ? 'closed' : 'closing-incomplete');
	}
	async function register(official, fingers) {
		// React to VOTA's own prompts: title, finger attempts (false = wrong finger), retry
		// after a rejection, then finish registration and reach voter identification.
		const queue = [...fingers];
		let registered = 0;
		for (let step = 0; step < 60; step++) {
			await frames();
			const term = w.terminalText || '';
			if (/Digite o T[ií]tulo/i.test(term)) { note('registration-done'); return; }
			if (w.fingerprint?.state.capturing && scannerPrompt()) {
				const correct = queue.length ? queue.shift() : true;
				await w.scanner.place(correct); note(correct ? 'finger-correct' : 'finger-wrong');
				if (correct) registered++;
				continue;
			}
			if (!terminalEnabled()) { await w.tick(); guard(); await sleep(60); continue; }
			if (/J[aá] registrado/i.test(term)) await press('D', 'terminal');
			else if (/Informe o t[ií]tulo/i.test(term)) await (registered ? press('D', 'terminal') : typed(official.title + 'C', 'terminal'));
			else if (/Registrar (outro )?mes[aá]rio/i.test(term)) await press(registered ? 'D' : 'C', 'terminal');
			else await press('C', 'terminal');
		}
		throw Error('Registration did not reach voter identification: ' + (w.terminalText || '').split('\n')[0]);
	}
	const scannerPrompt = () => w.experiments.state.current?.name === 'comum::CPedeDigitalMesario';
	async function audioOption() {
		await press('D', 'terminal'); await press('1', 'terminal'); note('audio-option');
		for (let i = 0; i < 6; i++) { if (terminalEnabled()) await press('D', 'terminal'); else { await w.tick(); guard(); } }
		for (let i = 0; i < 5; i++) { await w.tick(); guard(); }
		note('audio-option-back');
	}
	/** Voting can only be closed from 17:00: move the running clock there (election day). */
	function toClosingTime(iso) {
		const p = w.clock.electionDayPreset();
		w.clock.configure({ mode: 'running', iso: iso ?? new Date(p.local.replace('T08:00:00', 'T17:05:00')).toISOString() });
	}
	async function earlyClose() {
		// Before 17:00 VOTA should refuse or ask; back out with CORRIGE.
		await press('D', 'terminal'); await press('2', 'terminal'); note('early-close');
		for (let i = 0; i < 6; i++) { if (terminalEnabled()) await press('D', 'terminal'); else { await w.tick(); guard(); } }
		for (let i = 0; i < 5; i++) { await w.tick(); guard(); }
		note('early-close-back');
	}
	async function fuzzKeys(count, seed) {
		let x = seed >>> 0;
		const rand = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
		const actions = [];
		for (let i = 0; i < count && !w.session.closed && !stopped(); i++) {
			await frames();
			const devices = [terminalEnabled() && 'terminal', urnaEnabled() && 'vota'].filter(Boolean);
			if (!devices.length) { await w.tick(); continue; }
			const device = devices[Math.floor(rand() * devices.length)];
			const keys = device === 'terminal' ? '0123456789DC' : '0123456789BDC';
			const key = keys[Math.floor(rand() * keys.length)];
			try { await press(key, device); } catch (e) { actions.push(device + ':' + key + ' ✗ ' + String(e.message).slice(0, 80)); break; }
			actions.push(device + ':' + key);
			if (rand() < 0.3) for (let k = 0; k < 3; k++) { await w.tick(); if (stopped()) break; }
		}
		note('fuzz-done');
		return actions;
	}
	return { report, boot, authorize, vote, exploreOptions, close, note, stopped, register, audioOption, earlyClose, toClosingTime, completeInspection, fuzzKeys };
})();
`;
