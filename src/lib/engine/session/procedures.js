// Election-day procedures done "for" the user (guided tours, "Fazer por mim"): the same keys a
// mesário and a voter would press, in answer to what VOTA shows. Nothing here changes VOTA's
// state other than through the keypads, the clock, the fingerprint reader and the result media.
import { createKeypadDriver } from './keypad-driver.js';
import { readEleitorado } from '../load/eleitorado.js';

export function createProcedures(app) {
	let stopRequested = false;
	const d = createKeypadDriver(app, { shouldStop: () => stopRequested });
	const operator = () => app.experiments?.state.current?.name ?? '';
	const booting = () => !!app.session?.booting;
	const waitingForStart = () => operator() === 'vota::CInicioVotacao';

	/** Keyboard test: CONFIRMA, then each key VOTA asks for, in order. */
	async function keyboardTest() {
		await d.waitFor(() => app.session?.enabled && /testeteclado/.test(operator()), 'teste de teclado', 60000);
		await d.press('C', 'voter', 150);
		for (let i = 0; i < 20 && /testeteclado/.test(operator()); i++) {
			const key = app.keyboardTestExpectedKey();
			if (!key) {
				await d.sleep(100);
				continue;
			}
			await d.press(key, 'voter', 150);
		}
	}
	/** Zerésima: confirm its printing (and the "late" confirmation after opening time). */
	async function zeresima() {
		const deadline = Date.now() + 180000;
		while (booting() && !waitingForStart()) {
			if (Date.now() > deadline) throw Error('A zerésima não terminou');
			if (d.keypadEnabled('voter') && /Zeresima|Reimprimir/.test(operator())) await d.press('C', 'voter', 400);
			else await d.sleep(150);
		}
	}
	/** Voting starts at 08:00: move the simulated clock there if VOTA is waiting. */
	async function startTime() {
		if (waitingForStart()) app.clock.apply({ mode: 'running', iso: app.clock.electionDayPreset().iso });
		await d.waitFor(() => !booting(), 'início da votação', 60000);
	}
	async function opening() {
		if (/testeteclado/.test(operator()) || (booting() && !/Zeresima|Reimprimir|CInicioVotacao/.test(operator()))) await keyboardTest();
		await zeresima();
		await startTime();
	}

	/** One voter: release the urna on the terminal, then vote for the first candidate of each office. */
	async function vote({ voter = null } = {}) {
		if (app.sessionPhase === 'official' && !voter) throw Error('Na fase oficial, o mesário identifica um eleitor do eleitorado');
		await d.authorize(voter, 200);
		return d.ballot((cargo, apt, seen) => {
			const candidate = apt.find((c) => !seen.has(c.number)) ?? apt[0];
			return candidate ? { strategy: 'candidato', candidate } : { strategy: 'branco' };
		}, 250);
	}
	/** Training: CONFIRMA on the terminal releases the urna for an anonymous trainee. */
	async function release() {
		await d.authorize(null, 200);
	}
	/** Only the urna's part: vote for the first candidate of each office (urna already released). */
	async function castBallot() {
		await d.waitFor(() => app.session?.voterEnabled, 'urna liberada');
		return d.ballot((cargo, apt, seen) => {
			const candidate = apt.find((c) => !seen.has(c.number)) ?? apt[0];
			return candidate ? { strategy: 'candidato', candidate } : { strategy: 'branco' };
		}, 250);
	}

	/** VOTA's periodic cabin inspection: CONFIRMA on the urna, then on the terminal. */
	async function inspection() {
		for (let i = 0; i < 12; i++) {
			const s = await app.readState();
			if (s.state === 'vota::CInspecionaUrna' && d.keypadEnabled('voter')) await d.press('C', 'voter', 300);
			else if (/Inspec/.test(operator()) && d.keypadEnabled('mesario')) await d.press('C', 'mesario', 300);
			else if (s.state === 'vota::CInspecionaUrna' || /Inspec/.test(operator())) await d.sleep(150);
			else return;
		}
	}
	/** CORRIGE on the terminal until VOTA shows the mesário's options. */
	async function options() {
		await inspection();
		for (let i = 0; i < 6 && !/Selecione a op/i.test(d.terminalText()); i++) {
			if (d.keypadEnabled('mesario')) await d.press('D', 'mesario', 300);
			else await d.sleep(150);
		}
		if (!/Selecione a op/i.test(d.terminalText())) throw Error('As opções do mesário não abriram');
	}
	/** Voting closes from 17:00 (Brasília) on election day: move the simulated clock there. */
	function toClosingTime() {
		const preset = app.clock.electionDayPreset();
		const closing = Date.parse(new Date(preset.local.replace('T08:00:00', 'T17:00:00')).toISOString());
		if (app.clock.now() < closing) app.clock.apply({ mode: 'running', iso: new Date(closing + 5 * 60000).toISOString() });
	}
	/** Close the voting: options › Encerrar, answer VOTA's prompts, print the BU, remove the media. */
	async function closing() {
		toClosingTime();
		await d.sleep(500);
		await options();
		const option = d.terminalText().match(/(\d)\s*[-–:.)]?\s*Encerr/i)?.[1] ?? '2';
		await d.press(option, 'mesario', 300);
		const title = readEleitorado(app.loadEditor.files)[0]?.title ?? '';
		let mediaQueries = app.fullSession?.state.resultMedia?.presenceQueries ?? 0;
		const deadline = Date.now() + 240000;
		while (!app.session?.closed) {
			if (Date.now() > deadline) throw Error('O encerramento não terminou');
			if (app.error) throw Error(app.error);
			const s = await app.readState(), term = d.terminalText();
			if (app.fullSession?.state.resultMedia?.presenceQueries > mediaQueries && app.resultMedia?.present) {
				app.media.eject();
				mediaQueries = Infinity;
			} else if (s.state === 'vota::CInspecionaUrna' || /Inspec/.test(operator())) await inspection();
			else if (app.fingerprint?.state.capturing && operator() === 'comum::CPedeDigitalMesario') await app.scanner.place(true);
			else if (d.keypadEnabled('mesario') && !app.session.operatorFinished) {
				if (/^\s*Registrar mes[aá]rio\?/i.test(term)) await d.press('D', 'mesario', 300);
				else {
					// The closing asks for a mesário's title; the voter prompt ("Digite o Título ou o CPF") is not it.
					if (title && /t[ií]tulo/i.test(term) && !/CPF/.test(term) && !/\d{12}/.test(term)) for (const k of title) await d.press(k, 'mesario', 120);
					await d.press('C', 'mesario', 400);
				}
			} else if (d.keypadEnabled('voter')) await d.press(s.state === 'vota::CEmitirMaisBU' ? 'D' : 'C', 'voter', 400);
			else await d.sleep(150);
		}
	}

	/** Run one procedure; a new one stops the previous. */
	async function run(name, ...args) {
		const fn = { keyboardTest, zeresima, startTime, opening, release, vote, castBallot, inspection, options, toClosingTime, closing }[name];
		if (!fn) throw Error(`Procedimento desconhecido: ${name}`);
		stopRequested = false;
		app.run?.();
		return fn(...args);
	}
	return {
		run,
		stop() {
			stopRequested = true;
		}
	};
}
