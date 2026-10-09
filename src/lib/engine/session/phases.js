// Educational phase of the session, derived from the engine snapshot: which part of the
// election-day procedure the urna and the terminal do mesário are in right now.
const BOOT_ZERESIMA = /Zeresima|ZerEsima|CVerificaEleicaoPassou|CDefineRotaPreVotacao|CIniciodeCiclo/;
const IDENTIFICATION = /CValidaIdentidade|CProcuraEleitor|CEleitorEncontrado|CNomeEleitor|CPedeAnoNascimento|CInformaEleitorPodeVotar|CIdentidadeInvalida|CEleitorJaVotou|CEleitorNaoEncontrado/;
const CLOSING_OPERATOR = /CIniciaFinalizacao|CPerguntaFilaEleitorVazia|CPedeTituloEncerramento|CConfirmaEncerramento|CFimAquisicaoVotos|CFinalizaOperador|CHorarioVotacaoTerminou/;
const BU_STATES = /CQuerImprimirBU|CImprimindoBU|CImprimirBUOutrasObrigatorias|CImprimindoBim|CEmitirMaisBU|CMostraQRCodeBU|CGeraBU|CGeraRelatorios|CGravaResultado|CCopiaResultadoParaMR/;

/**
 * @param {object|null} s engine snapshot (see store.js)
 * @returns {string} phase id; see explicacoes.js for the texts.
 */
export function derivePhase(s) {
	if (!s || s.bootStep !== 'ready') return 'carregando';
	if (s.error) return 'erro';
	const session = s.session, operator = s.operator?.current ?? '', vota = s.vota?.state ?? '';
	if (!session?.enabled) return s.operator?.enabled ? 'tela-isolada' : 'modo-simples';
	if (session.closed) return 'encerrada';
	if (session.booting) {
		// VOTA restarted mid-election (a snapshot put its saved files back): its own resumption
		// path. The keyboard-test state (testeteclado::CRetomada) is the same class on a fresh boot
		// ("Por favor, teste o teclado"), so only the restored files tell the two apart.
		if (/CReinicioVotacao/.test(operator) || (s.resumed && /testeteclado/.test(operator))) return 'reinicio';
		if (/testeteclado/.test(operator)) return 'teste-teclado';
		if (/CInicioVotacao/.test(operator) || s.waitingForStart) return 'aguardando-inicio';
		if (BOOT_ZERESIMA.test(operator)) return 'zeresima';
		return 'inicializacao';
	}
	if (session.operatorFinished) {
		if (/CRetirarMR/.test(vota)) return 'retirar-midia';
		if (BU_STATES.test(vota)) return 'emissao-bu';
		return 'encerramento';
	}
	if (/Inspec/.test(operator) || /CInspecionaUrna|CUrnaInspecionada/.test(vota)) return 'inspecao';
	if (/CEleitorDemorando|CPerguntaEleitorVotando|CPerguntaCodigoSuspensao|CSuspensaoAutomaticaEleitor|CEleitorVotouNaoVotou/.test(operator)) return 'eleitor-demorando';
	if (operator.startsWith('comum::')) return 'registro-mesarios';
	if (CLOSING_OPERATOR.test(operator)) return 'encerramento';
	if (session.voterEnabled) return 'votacao';
	if (/CEscolheOpcao/.test(operator)) return 'opcoes';
	if (IDENTIFICATION.test(operator)) return 'identificacao';
	return 'aguardando-eleitor';
}
