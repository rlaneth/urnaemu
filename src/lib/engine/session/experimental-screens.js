// Traced native entry harness; addresses are specific to the immutable snapshot.
// Ported from the workbench: DOM rendering became `refresh()` + `notify()`.
import CATALOG from './vtable-catalog.json';
export const KNOWN_VTABLES = [[1594880,"comum::CMesarioRegistrado"],[1595176,"comum::CGestorDadoMesario"],[1594996,"comum::CGestorDadoMesarioInicial"],[1595056,"comum::CGestorDadoMesarioVotacao"],[1595116,"comum::CGestorDadoMesarioFinal"],[1601040,"vota::CAguardaInicio"],[0x179688,"vota::CVerificaHorarioZeresima"],[0x179258,"vota::CInicioZeresima"],[0x179310,"vota::CVerificaEleicaoPassou"],[0x17998c,"vota::CReinicioVotacao"],[0x17986c,"vota::CQuerReimprimirZeresima"],[0x183690,"vota::CHorarioVotacaoTerminou"],[0x176424,"vota::CAguardaMensagem"],[0x1765f8,"vota::CIniciodeCiclo"],[0x178db0,"vota::CInicioVotacao"],[0x178d20,"vota::CDefineRotaPreVotacao"],[0x179188,"vota::CGeraZeresima"],[0x179148,"vota::CGeraResumoZeresima"],[0x178d58,"vota::CImprimindoZeresima"],[0x1791c8,"vota::CImpressaoZeresimaTardia"],[0x185220,"comum::CEncerraRegistroMesarios"],[0x184840,"vota::CInformaEleitorPodeVotar"],[0x1848d0,"vota::CPedeAnoNascimentoSemBiometria"],[0x183ed0,"vota::CEleitorEncontrado"],[0x183f18,"vota::CProcuraEleitor"],[0x183f50,"vota::CValidaIdentidade"],[0x1857c8,"comum::CPedeDigitalMesario"],[0x185770,"comum::CDigitalMesarioNaoReconhecida"],[1547140, "vota::testeteclado::CTesteTeclado"], [1547064, "vota::testeteclado::CTesteFalhou"], [1546988, "vota::testeteclado::CEnviarManutencao"], [1546928, "vota::testeteclado::CErroTesteTecladoFim"], [1546708, "vota::testeteclado::CRetomada"], [1546044, "vota::testeteclado::CPreZeresima"], [1546780, "vota::testeteclado::CEsperaRetestar"], [1593592, "comum::CRegistrarMesarios"], [1593728, "comum::CPedeTituloMesario"], [1593960, "comum::CPedeTituloMesarioInicial"], [1594112, "comum::CPedeTituloMesarioFinal"], [1594264, "comum::CPedeTituloMesarioVotacao"], [1594568, "comum::CTituloMesarioVazio"], [1594656, "comum::CTituloMesarioInvalido"], [1588240, "vota::CPedeIdentidade"], [1588004, "vota::CEscolheOpcao"], [1587148, "vota::CConfirmaAudio"], [1586960, "vota::CHabilitaAudioManualmente"], [1544848, "vota::CQuerImprimirZeresima"], [1544720, "vota::CConfirmaImpressaoZeresima"], [1545312, "vota::CMaisInformacoes"], [1545600, "vota::CMenuVisualizarCandidatos"], [1547456, "vota::CInspecionaUrna"], [1547528, "vota::CUrnaInspecionada"], [1533956, "vota::CMostraTelaContinuaVotacao"], [1591256, "vota::CNomeEleitor"], [1593008, "vota::CMostraEleitorVotando"], [1587700, "vota::CPerguntaFilaEleitorVazia"], [1587276, "vota::CConfirmaEncerramento"], [1601096, "vota::CFinalizaOperador"], [1593800, "comum::CConfirmaFimRegistroMesarios"], [1601152, "vota::CSincronismoOperador"], [1587876, "vota::CIniciaFinalizacao"], [1587556, "vota::CPedeTituloEncerramento"], [1587220, "vota::CFimAquisicaoVotos"]];

const OPERATOR_STATES = /CHorarioVotacaoTerminou|CInformaEleitorPodeVotar|CPedeAnoNascimentoSemBiometria|CEleitorEncontrado|CProcuraEleitor|CValidaIdentidade|CPedeIdentidade|CEscolheOpcao|CConfirmaAudio|CHabilitaAudio|CNomeEleitor|CMostraEleitorVotando|CPerguntaFilaEleitorVazia|CConfirmaEncerramento|CFinalizaOperador|CSincronismoOperador|CIniciaFinalizacao|CPedeTituloEncerramento|CFimAquisicaoVotos/;

export function roleFor(current) {
	return current && (current.name.startsWith('comum::') || OPERATOR_STATES.test(current.name)) ? 'mesario' : 'voter';
}

export function createExperimentalScreens({ app, pause, log, notify }) {
	const state = {
		enabled: false,
		active: 0,
		scratch: 0,
		stopped: false,
		reason: '',
		fullStartup: false,
		entry: null,
		role: 'voter',
		// Last inspected native state ({pointer, vtable, name, …} or {pointer, error}).
		current: null
	};
	// Keypad a native state reads. Isolated screens use the hand-traced role list; a session
	// replaces this with its own rule (see training-session.js).
	let keypadOf = roleFor;
	// States traced by hand, plus every RTTI-named state of this binary. inspect() still
	// checks each state's start/input/needChange/getNext/end signatures before calling it.
	const knownVtables = new Map([...CATALOG.states, ...KNOWN_VTABLES]);

	function range(pointer, bytes) {
		if (!Number.isSafeInteger(pointer) || pointer <= 0 || pointer % 4 || pointer + bytes > app.exports.Cb.buffer.byteLength)
			throw Error(`Invalid native address ${pointer}`);
		return pointer;
	}
	function u32(pointer) {
		return new DataView(app.exports.Cb.buffer).getUint32(range(pointer, 4), true);
	}
	function table(slot, params, result) {
		const meta = app.tableMetadata.find((entry) => entry.slot === slot);
		if (!meta || JSON.stringify(meta.params) !== JSON.stringify(params) || meta.result !== result)
			throw Error(`Unexpected signature for table slot ${slot}`);
		const fn = app.exports.Fb.get(slot);
		if (typeof fn !== 'function') throw Error(`Table slot ${slot} is not callable`);
		return (...args) => app.native.callTable(slot, args);
	}
	function inspect(pointer) {
		range(pointer, 8);
		const vtable = u32(pointer);
		range(vtable, 32);
		const name = knownVtables.get(vtable);
		if (!name) throw Error(`Unverified state vtable 0x${vtable.toString(16)} at object 0x${pointer.toString(16)}; stopped before calling it`);
		const start = u32(vtable + 8), needChange = u32(vtable + 12), getNext = u32(vtable + 16), end = u32(vtable + 20), input = u32(vtable + 28);
		table(start, ['i32'], 'nil');
		table(input, ['i32'], 'nil');
		table(needChange, ['i32'], 'i32');
		table(getNext, ['i32'], 'i32');
		table(end, ['i32'], 'nil');
		return { pointer, vtable, name, start, input, needChange, getNext, end, next: u32(pointer + 4) };
	}

	/** Former render(): re-inspect the active state (which also updates the role) and publish. */
	function refresh() {
		let current = null;
		if (state.active) {
			try {
				current = inspect(state.active);
			} catch (error) {
				current = { pointer: state.active, error: String(error) };
			}
		}
		if (current?.name) state.role = roleFor(current);
		state.current = current;
		notify();
	}

	function stop(reason) {
		pause();
		state.stopped = true;
		state.reason = reason;
		refresh();
		log('experimental-stop', reason);
	}
	async function scratch() {
		if (!state.scratch) state.scratch = (await table(5, ['i32'], 'i32')(64)) >>> 0;
		range(state.scratch, 64);
		new Uint8Array(app.exports.Cb.buffer, state.scratch, 64).fill(0);
		return state.scratch;
	}
	async function initializeNative() {
		if (!state.fullStartup) {
			await table(970, ['i32'], 'nil')(await scratch());
			state.fullStartup = true;
			log('native-startup', { slot: 970, scratch: state.scratch });
		}
	}
	async function enter(pointer) {
		const next = inspect(pointer);
		state.active = pointer;
		state.role = roleFor(next);
		// Some screens read keys already in StartState (the candidate menu blocks there).
		await app.keys.as(keypadOf(next), () => table(next.start, ['i32'], 'nil')(pointer));
		log('experimental-transition', next);
	}
	async function settle() {
		for (let count = 0; count < 16; count++) {
			const current = inspect(state.active);
			if (!(await table(current.needChange, ['i32'], 'i32')(current.pointer))) return;
			await table(current.end, ['i32'], 'nil')(current.pointer);
			const next = (await table(current.getNext, ['i32'], 'i32')(current.pointer)) >>> 0;
			if (!next) {
				stop('Native flow finished with no continuation. Restart or reload normal session.');
				return;
			}
			if (next === current.pointer) return;
			await enter(next);
		}
		throw Error('Native automatic transition limit reached');
	}
	async function start(entry) {
		if (app.session?.enabled) throw Error('Reload before switching experimental entries during a training session');
		pause();
		if (!app.initialized) throw Error('Initialize the ordinary runtime first');
		state.enabled = true;
		state.stopped = true;
		state.reason = `Starting ${entry}`;
		state.entry = entry;
		refresh();
		try {
			let pointer;
			if (entry === 'keyboard') {
				await table(1869, ['i32', 'i32'], 'nil')(await scratch(), 0);
				pointer = u32(0x1c008c);
				if (!pointer || pointer !== u32(state.scratch + 4)) throw Error('Keyboard singleton and callback result disagree');
				const current = inspect(pointer);
				if (current.vtable !== 0x179b84 || current.start !== 1901 || current.input !== 1902) throw Error('Unexpected keyboard-test vtable');
				if (u32(pointer + 0x40) !== 0) throw Error('Keyboard test has an attached continuation; reload for a standalone test');
			} else if (entry === 'startup') {
				if (state.fullStartup) throw Error('Native startup already ran. Reload before running it again.');
				await initializeNative();
				pointer = u32(state.scratch + 4);
			} else if (entry === 'mesario' || entry === 'operator') {
				await initializeNative();
				await table(4579, ['i32', 'i32'], 'nil')(await scratch(), entry === 'mesario' ? 7 : 8);
				pointer = u32(state.scratch + 4);
			} else if (entry === 'zeresima') {
				await table(1712, ['i32'], 'nil')(await scratch());
				pointer = u32(state.scratch + 4);
			} else if (entry === 'inspection') {
				await table(904, ['i32', 'i32'], 'nil')(await scratch(), 12);
				pointer = u32(state.scratch + 4);
			} else throw Error('Unknown experimental entry');
			app.keys.drop(null, 'new experimental entry');
			state.stopped = false;
			state.reason = 'Native state active; ordinary voting engine paused';
			await enter(pointer);
			await settle();
			refresh();
		} catch (error) {
			stop(String(error));
			throw error;
		}
	}
	async function tick() {
		if (state.stopped) throw Error(`Isolated screen stopped: ${state.reason}`);
		try {
			await settle();
			if (state.stopped) return;
			const current = inspect(state.active);
			// Terminal screens read the terminal keypad; the others (keyboard test, zerésima…) the urna's.
			await app.keys.as(keypadOf(current), () => table(current.input, ['i32'], 'nil')(current.pointer));
			await settle();
			refresh();
		} catch (error) {
			stop(String(error));
			throw error;
		}
	}
	/**
	 * Re-run the active state's End/Start lifecycle so it re-evaluates its entry checks.
	 * Used for CInicioVotacao, which reads the clock on start and otherwise relies on a
	 * native timer this harness does not deliver.
	 */
	async function restart() {
		const current = inspect(state.active);
		await table(current.end, ['i32'], 'nil')(current.pointer);
		await table(current.start, ['i32'], 'nil')(current.pointer);
		log('experimental-restart', current.name);
		await settle();
		refresh();
	}
	async function attachOperator() {
		const pointer = await table(3696, ['i32'], 'i32')(0);
		if (u32(pointer) !== 1601040) throw Error('Unexpected initial operator state');
		state.entry = 'operator-thread';
		state.stopped = false;
		state.reason = 'Native operator thread connected';
		await enter(pointer);
		await settle();
		refresh();
	}

	return {
		state,
		/** Replace the rule that maps a native state to the keypad it reads. */
		setKeypadRule: (rule) => (keypadOf = rule),
		/** Keypad the active native state reads. */
		activeKeypad: () => keypadOf(inspect(state.active)),
		start,
		restart,
		attachOperator,
		startKeyboard: () => start('keyboard'), tick, refresh, render: refresh, stop, knownVtables };
}
