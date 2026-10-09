// Guided tours: short walkthroughs of election day on a training session. Each step points at
// a part of the workspace (data-tour), says what to do, and advances by itself when the
// session gets there (`concluido`, from the engine snapshot). "Fazer por mim" runs the step's
// procedure (engine/session/procedures.js) with the same keys a mesário or voter would press.
// Steps already done are skipped, so a tour can start in the middle of a session.

const BOOT = ['carregando', 'inicializacao', 'teste-teclado'];
const booting = (s) => !!s.session?.booting;

// Voting and closing need an open polling station: the opening first, if not done yet.
const OPENING_FIRST = {
	id: 'abrir-secao',
	alvo: 'terminal',
	titulo: 'Primeiro, a abertura da seção',
	texto: 'A seção ainda não está aberta: falta o teste de teclado, a zerésima ou o início da votação às 8h. Faça a abertura (o tour "Abertura da seção" mostra cada passo) ou deixe que o emulador faça.',
	concluido: (s) => !booting(s),
	fazer: { rotulo: 'Abrir a seção por mim', procedimento: 'opening' }
};

export const TOURS = [
	{
		id: 'abertura',
		titulo: 'Abertura da seção',
		resumo: 'Da urna ligada até a votação aberta: teste de teclado, zerésima e início às 8h.',
		requer: (s) => (!booting(s) ? 'A abertura desta sessão já foi feita.' : null),
		passos: [
			{
				id: 'urna',
				alvo: 'urna',
				titulo: 'A urna eletrônica',
				texto: 'Esta é a urna: a tela e o teclado que o eleitor usa na cabina. A tela mostra o VOTA, o aplicativo de votação da urna, compilado pelo TSE para o Simulador de Votação e executado no seu navegador. Telas, regras e relatórios são do próprio VOTA; o que o emulador acrescenta está em Ajuda › Fidelidade e limitações.'
			},
			{
				id: 'terminal',
				alvo: 'terminal',
				titulo: 'O terminal do mesário',
				texto: 'Este é o terminal do mesário, ligado à urna por um cabo. Nele o mesário identifica cada eleitor e libera a urna. As luzes mostram se a cabina está livre (LIBERADO) ou ocupada por um eleitor (AGUARDE), e se a urna está na bateria interna.'
			},
			{
				id: 'teste-teclado',
				alvo: 'voter-keypad',
				titulo: 'Teste do teclado',
				texto: 'Antes de tudo, o mesário confere que cada tecla da urna funciona. Aperte CONFIRMA e depois cada tecla que a tela pedir, uma por vez. As teclas 0–9, Enter (CONFIRMA), Esc (CORRIGE) e Espaço (BRANCO) do computador também funcionam.',
				teclas: [{ aparelho: 'Urna', tecla: 'CONFIRMA' }, { aparelho: 'Urna', tecla: 'teclas pedidas' }],
				concluido: (s) => !BOOT.includes(s.phaseId),
				fazer: { rotulo: 'Fazer o teste por mim', procedimento: 'keyboardTest' }
			},
			{
				id: 'zeresima',
				alvo: 'urna',
				abrir: 'bobina',
				titulo: 'Zerésima',
				texto: 'A urna imprime a zerésima: um relatório que mostra todos os candidatos com zero votos, provando que nenhum voto foi registrado antes da votação. Confirme a impressão com CONFIRMA na urna e acompanhe o papel na janela da impressora.',
				teclas: [{ aparelho: 'Urna', tecla: 'CONFIRMA' }],
				concluido: (s) => !booting(s) || s.waitingForStart,
				fazer: { rotulo: 'Imprimir por mim', procedimento: 'zeresima' }
			},
			{
				id: 'inicio',
				alvo: 'terminal',
				titulo: 'Início da votação às 8h',
				texto: 'A votação só começa às 8h (horário de Brasília) do dia da eleição. Até lá, o terminal mostra o horário e espera. O relógio da urna é simulado: você pode avançá-lo para as 8h.',
				concluido: (s) => !booting(s),
				fazer: { rotulo: 'Avançar o relógio para as 8h', procedimento: 'startTime' }
			},
			{
				id: 'aberta',
				alvo: 'terminal',
				titulo: 'A votação está aberta',
				texto: 'Pronto: o terminal pede a identificação do próximo eleitor. Para ver um eleitor votando, use o tour "Um eleitor vota".'
			}
		]
	},
	{
		id: 'votacao',
		titulo: 'Um eleitor vota',
		resumo: 'O mesário libera a urna e o eleitor vota em cada cargo.',
		requer: (s) => (s.session?.operatorFinished ? 'A votação desta sessão já foi encerrada.' : null),
		passos: [
			OPENING_FIRST,
			{
				id: 'liberar',
				alvo: 'terminal-keypad',
				titulo: 'O mesário libera a urna',
				texto: 'Na eleição real, o mesário digita o título (ou o CPF) do eleitor e confere a identidade; a urna é liberada só para ele. Nesta sessão de treinamento, basta apertar CONFIRMA no terminal. O terminal mostra CABINA: OCUPADA e a luz AGUARDE acende.',
				teclas: [{ aparelho: 'Terminal', tecla: 'CONFIRMA' }],
				concluido: (s) => !!s.session?.voterEnabled,
				fazer: { rotulo: 'Liberar por mim', procedimento: 'release' }
			},
			{
				id: 'votar',
				alvo: 'voter-keypad',
				titulo: 'O eleitor vota',
				texto: 'Para cada cargo, o eleitor digita o número do candidato e confere nome, partido e foto. CONFIRMA grava o voto; CORRIGE apaga o número; BRANCO vota em branco. Um número que não existe vira voto nulo. Depois do último cargo, a urna mostra FIM.',
				teclas: [{ aparelho: 'Urna', tecla: 'números' }, { aparelho: 'Urna', tecla: 'CONFIRMA' }, { aparelho: 'Urna', tecla: 'CORRIGE' }, { aparelho: 'Urna', tecla: 'BRANCO' }],
				concluido: (s) => !s.session?.voterEnabled,
				fazer: { rotulo: 'Votar por mim', procedimento: 'castBallot' }
			},
			{
				id: 'votou',
				alvo: 'terminal',
				titulo: 'Voto registrado',
				texto: 'O voto foi gravado de forma embaralhada no Registro Digital do Voto (RDV), sem ligação com o eleitor, e o contador de votos do terminal aumentou. O terminal já espera o próximo eleitor.'
			}
		]
	},
	{
		id: 'encerramento',
		titulo: 'Encerramento e boletim de urna',
		resumo: 'Às 17h: encerrar a votação, imprimir o BU e retirar a mídia de resultado.',
		requer: (s) => (s.session?.closed ? 'Esta sessão já foi encerrada.' : null),
		passos: [
			OPENING_FIRST,
			{
				id: 'horario',
				alvo: 'terminal',
				titulo: 'A votação termina às 17h',
				texto: 'A votação só pode ser encerrada a partir das 17h (horário de Brasília); quem já está na fila ainda vota. O relógio da urna é simulado: avance-o para depois das 17h.',
				concluido: (s, app) => app.clock.now() >= closingTime(app),
				fazer: { rotulo: 'Avançar o relógio para as 17h05', procedimento: 'toClosingTime' }
			},
			{
				id: 'opcoes',
				alvo: 'terminal-keypad',
				titulo: 'As opções do mesário',
				texto: 'No terminal, CORRIGE abre o menu de opções do mesário: ativar o áudio para o eleitor e encerrar a votação.',
				teclas: [{ aparelho: 'Terminal', tecla: 'CORRIGE' }],
				concluido: (s) => s.phaseId === 'opcoes' || !!s.session?.operatorFinished,
				fazer: { rotulo: 'Abrir as opções por mim', procedimento: 'options' }
			},
			{
				id: 'encerrar',
				alvo: 'terminal',
				titulo: 'Encerrar a votação',
				texto: 'Escolha a opção de encerramento pelo número mostrado e responda às perguntas do VOTA no terminal e na urna (confirmação, título de um mesário). Depois disso, nenhum voto pode mais ser registrado.',
				teclas: [{ aparelho: 'Terminal', tecla: 'número da opção' }, { aparelho: 'Terminal', tecla: 'CONFIRMA' }],
				concluido: (s) => !!s.session?.operatorFinished,
				fazer: { rotulo: 'Encerrar por mim', procedimento: 'closing' }
			},
			{
				id: 'bu',
				alvo: 'urna',
				abrir: 'bobina',
				titulo: 'Boletim de urna (BU)',
				texto: 'A urna gera o boletim de urna, com os votos de cada candidato, e imprime as vias do BU. Confirme na urna cada pergunta sobre as vias. Na fase oficial, ela também grava os resultados assinados na mídia de resultado e pede que a mídia seja retirada.',
				teclas: [{ aparelho: 'Urna', tecla: 'CONFIRMA' }],
				concluido: (s) => !!s.session?.closed,
				fazer: { rotulo: 'Concluir por mim', procedimento: 'closing' }
			},
			{
				id: 'encerrada',
				alvo: 'urna',
				titulo: 'Seção encerrada',
				texto: 'A seção está encerrada. O BU impresso, na janela da impressora, traz os votos de cada candidato. Na fase oficial, os arquivos de resultado assinados (BU, RDV e logs) também podem ser abertos no navegador de arquivos, que confere as assinaturas, a cadeia de resumos e os totais com o RDV.'
			}
		]
	}
];

/** 17:00 of election day (Brasília), in the simulated clock's milliseconds. */
export function closingTime(app) {
	const preset = app.clock.electionDayPreset();
	return Date.parse(new Date(preset.local.replace('T08:00:00', 'T17:00:00')).toISOString());
}

/** Whether the current session can run tours at all (a training session that is running). */
export function sessionProblem(s) {
	if (!s?.session?.enabled) return 'Os tours usam uma sessão de treinamento completa (urna e terminal do mesário).';
	if (s.phase !== 'training') return 'Os tours usam uma sessão de treinamento; esta é uma sessão oficial.';
	return null;
}
export const tourById = (id) => TOURS.find((t) => t.id === id);
