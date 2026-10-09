import assert from 'node:assert/strict';
import { derivePhase } from '#lib/engine/session/phases.js';
import { EXPLICACOES } from '#lib/explicacoes.js';

const base = { bootStep: 'ready', error: null, vota: { state: 'vota::CAguardaMensagem' }, operator: { enabled: true, current: null }, waitingForStart: false };
const session = (extra) => ({ enabled: true, booting: false, closed: false, operatorFinished: false, voterEnabled: false, ...extra });
const phase = (patch) => derivePhase({ ...base, ...patch });

const cases = [
	[null, 'carregando'],
	[{ bootStep: 'runtime' }, 'carregando'],
	[{ error: 'x' }, 'erro'],
	[{ session: { enabled: false }, operator: { enabled: false } }, 'modo-simples'],
	[{ session: { enabled: false }, operator: { enabled: true } }, 'tela-isolada'],
	[{ session: session({ booting: true }), operator: { current: 'vota::testeteclado::CTesteTeclado' } }, 'teste-teclado'],
	[{ session: session({ booting: true }), operator: { current: 'vota::CConfirmaImpressaoZeresima' } }, 'zeresima'],
	[{ session: session({ booting: true }), operator: { current: 'vota::testeteclado::CRetomada' } }, 'teste-teclado'],
	[{ session: session({ booting: true }), resumed: true, operator: { current: 'vota::testeteclado::CRetomada' } }, 'reinicio'],
	[{ session: session({ booting: true }), operator: { current: 'vota::CReinicioVotacao' } }, 'reinicio'],
	[{ session: session({ booting: true }), operator: { current: 'vota::CInicioVotacao' } }, 'aguardando-inicio'],
	[{ session: session({ booting: true }), operator: { current: 'vota::CAguardaInicio' } }, 'inicializacao'],
	[{ session: session(), operator: { current: 'comum::CPedeDigitalMesario' } }, 'registro-mesarios'],
	[{ session: session(), operator: { current: 'vota::CPedeIdentidade' } }, 'aguardando-eleitor'],
	[{ session: session(), operator: { current: 'vota::CPedeAnoNascimentoSemBiometria' } }, 'identificacao'],
	[{ session: session(), operator: { current: 'vota::CIdentidadeInvalida' } }, 'identificacao'],
	[{ session: session(), operator: { current: 'vota::CEscolheOpcao' } }, 'opcoes'],
	[{ session: session({ voterEnabled: true }), operator: { current: 'vota::CMostraEleitorVotando' } }, 'votacao'],
	[{ session: session(), operator: { current: 'vota::CConfirmaEncerramento' } }, 'encerramento'],
	[{ session: session(), operator: { current: 'vota::CAguardaInspecao' }, vota: { state: 'vota::CInspecionaUrna' } }, 'inspecao'],
	[{ session: session({ voterEnabled: true }), operator: { current: 'vota::CEleitorDemorando' } }, 'eleitor-demorando'],
	[{ session: session({ voterEnabled: true }), operator: { current: 'vota::CSuspensaoAutomaticaEleitor' } }, 'eleitor-demorando'],
	[{ session: session({ operatorFinished: true }), vota: { state: 'vota::CImprimindoBU' } }, 'emissao-bu'],
	[{ session: session({ operatorFinished: true }), vota: { state: 'vota::CRetirarMR' } }, 'retirar-midia'],
	[{ session: session({ closed: true }) }, 'encerrada']
];
for (const [patch, expected] of cases) {
	const got = patch === null ? derivePhase(null) : phase(patch);
	assert.equal(got, expected, JSON.stringify(patch));
	assert.ok(EXPLICACOES[got], `missing explanation for ${got}`);
}
console.log(`PASS: ${cases.length} phase derivations, each with an explanation.`);
