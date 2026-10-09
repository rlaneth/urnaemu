// Explanations shown in the Explicação panel, one per session phase (see engine/session/phases.js).
// Each: título, o que está acontecendo, o que fazer agora (aparelho + ação), e notas sobre a urna
// real e sobre o que é simulado neste emulador.
export const EXPLICACOES = {
	carregando: {
		titulo: 'Carregando o emulador',
		acontecendo: 'O navegador está carregando o VOTA, o aplicativo de votação da urna, compilado para WebAssembly pelo próprio TSE, e a mídia de carga do cenário escolhido: eleitorado, candidatos, partidos e parâmetros da eleição.',
		fazer: [],
		real: 'Na urna real, a mídia de carga é gravada por um cartório eleitoral em uma cerimônia pública, e a urna é lacrada depois de carregada.'
	},
	erro: {
		titulo: 'O emulador parou',
		acontecendo: 'O VOTA ou o emulador relatou um erro e a execução foi interrompida. A mensagem aparece na parte de baixo da tela.',
		fazer: [{ aparelho: 'Sessão', acao: 'Use Sessão › Reiniciar emulador para começar de novo.' }],
		emulador: 'Algumas situações dependem de recursos que a versão web do VOTA não tem, como linhas de execução nativas.'
	},
	'modo-simples': {
		titulo: 'Modo simples: só a votação',
		acontecendo: 'Neste modo, apenas a tela do eleitor está ativa, como no Simulador de Votação do TSE. Não há inicialização, zerésima, mesário nem encerramento.',
		fazer: [
			{ aparelho: 'Urna', acao: 'Digite o número do candidato e aperte CONFIRMA, ou vote BRANCO.' },
			{ aparelho: 'Sessão', acao: 'Para o dia de eleição completo, use Sessão › Nova sessão completa.' }
		]
	},
	'tela-isolada': {
		titulo: 'Tela nativa isolada',
		acontecendo: 'Uma tela do VOTA foi aberta isoladamente por uma ferramenta de teste (urnaEmu.experiments), fora do fluxo normal da seção eleitoral.',
		fazer: [{ aparelho: 'Sessão', acao: 'Reinicie o emulador para voltar ao fluxo normal.' }]
	},
	inicializacao: {
		titulo: 'Inicialização da urna',
		acontecendo: 'O VOTA está iniciando: confere a data, a fase da eleição e se a votação já começou antes de mostrar a primeira tela, o teste de teclado.',
		fazer: [{ aparelho: 'Urna', acao: 'Siga as instruções que aparecem na tela da urna.' }],
		real: 'Antes do VOTA, o sistema da urna verifica a assinatura digital de cada pacote de software e dos dados da mídia, e o VOTA registra energia, espaço livre e memória. Só então aparece o teste de teclado.',
		emulador: 'A verificação de assinaturas do sistema não é emulada: o emulador começa diretamente no VOTA. A versão web do VOTA também não registra energia, espaço e memória no log.'
	},
	reinicio: {
		titulo: 'Reinício da votação',
		acontecendo: 'A urna foi reiniciada no meio da votação, e o VOTA encontrou os dados que ele mesmo gravou: votos já registrados, zerésima, logs. Em vez de começar do zero, ele retoma a seção. Primeiro pergunta se o mesário quer testar o teclado de novo; depois mostra "REINÍCIO DA VOTAÇÃO" com a identificação da seção.',
		fazer: [
			{ aparelho: 'Urna', acao: 'CORRIGE para não testar o teclado (ou CONFIRMA para testar).' },
			{ aparelho: 'Urna', acao: 'CONFIRMA em "REINÍCIO DA VOTAÇÃO" para continuar; o terminal volta a pedir o próximo eleitor, com o contador de votos preservado.' }
		],
		real: 'Na urna real, isso acontece depois de uma queda de energia sem bateria ou de um desligamento: os votos ficam gravados nas memórias interna e externa da urna, e a votação continua de onde parou.',
		emulador: 'O emulador chega aqui ao retomar um snapshot da sessão: reinicia com a mesma configuração e devolve ao VOTA os arquivos que ele havia gravado, antes de ele começar. A memória do programa em execução não é restaurada; quem retoma a seção é o próprio VOTA.'
	},
	'teste-teclado': {
		titulo: 'Teste do teclado',
		acontecendo: 'Antes de abrir a votação, o mesário confere que cada tecla da urna funciona. O VOTA pede uma tecla de cada vez, em ordem.',
		fazer: [{ aparelho: 'Urna', acao: 'Aperte CONFIRMA para começar e depois cada tecla pedida na tela. As teclas físicas 0–9, Enter (CONFIRMA), Esc (CORRIGE) e Espaço (BRANCO) também funcionam.' }],
		real: 'Se uma tecla falhar, o VOTA espera alguns segundos e permite repetir o teste; se continuar falhando, a urna é encaminhada para manutenção e substituída.'
	},
	zeresima: {
		titulo: 'Zerésima',
		acontecendo: 'A zerésima é um relatório impresso que prova que a urna não tem nenhum voto registrado antes do início da votação: todos os candidatos aparecem com zero votos.',
		fazer: [
			{ aparelho: 'Urna', acao: 'Confirme a impressão com CONFIRMA. Se a urna avisar que o horário da zerésima passou, confirme novamente.' },
			{ aparelho: 'Impressora', acao: 'Para acompanhar o relatório saindo no papel, use Ver impressora no aviso de impressão (ou Exibir › Impressora).' }
		],
		real: 'Os mesários e os fiscais dos partidos assinam a zerésima, que fica com os documentos da seção.',
		emulador: 'A velocidade do papel é simulada e pode ser ajustada no painel da impressora.'
	},
	'aguardando-inicio': {
		titulo: 'Aguardando o início da votação',
		acontecendo: 'A urna está pronta, mas a votação só começa às 8h (horário de Brasília) do dia da eleição. Até lá, o terminal do mesário mostra o horário atual e espera.',
		fazer: [{ aparelho: 'Relógio', acao: 'Use o aviso na parte de baixo da tela para avançar o relógio da urna para as 08:00, ou aguarde.' }],
		emulador: 'O relógio da urna é simulado: você pode escolhê-lo no painel Relógio da urna.'
	},
	'registro-mesarios': {
		titulo: 'Registro dos mesários',
		acontecendo: 'Os mesários que trabalham na seção se identificam no terminal com o título de eleitor e, quando cadastrada, a digital. O registro fica no arquivo de log da urna.',
		fazer: [
			{ aparelho: 'Terminal', acao: 'CONFIRMA para registrar um mesário; digite o título e CONFIRMA.' },
			{ aparelho: 'Leitor biométrico', acao: 'Quando o leitor acender, use Dedo correto, Dedo errado ou Tempo esgotado ao lado do terminal.' },
			{ aparelho: 'Terminal', acao: 'Para terminar o registro, CORRIGE e depois CONFIRMA.' }
		],
		emulador: 'Não há comparação biométrica real: "Dedo correto" faz o VOTA aceitar a digital, e "Dedo errado" leva à mesma tela de digital não reconhecida que o VOTA mostra.'
	},
	'aguardando-eleitor': {
		titulo: 'Aguardando o próximo eleitor',
		acontecendo: 'A votação está aberta. O mesário identifica cada eleitor no terminal antes de liberar a urna. O contador "Votos" no terminal mostra quantos eleitores já votaram.',
		fazer: [
			{ aparelho: 'Terminal', acao: 'Em sessões de treinamento, CONFIRMA libera um eleitor. Na fase oficial, digite o título (ou o CPF) do eleitor e CONFIRMA.' },
			{ aparelho: 'Terminal', acao: 'CORRIGE abre as opções do mesário (áudio, encerramento…).' }
		],
		real: 'A luz LIBERADO do terminal acende quando a cabine está livre; AGUARDE, quando um eleitor está votando.'
	},
	inspecao: {
		titulo: 'Inspeção da cabina e da urna',
		acontecendo: 'Periodicamente, o VOTA pede que a mesa inspecione a cabina de votação e a urna, para garantir que nada foi deixado ou alterado ali (por exemplo, papéis com instruções de voto).',
		fazer: [
			{ aparelho: 'Urna', acao: 'Depois de inspecionar, aperte CONFIRMA na urna ("Por favor, inspecione cabina e urna").' },
			{ aparelho: 'Terminal', acao: 'Confirme no terminal que a inspeção foi feita.' }
		],
		real: 'O VOTA registra no log o início, a confirmação e o término da inspeção.',
		emulador: 'A inspeção é disparada por um temporizador do próprio VOTA, entregue pelo emulador. Ela não acontece nas sessões de treinamento.'
	},
	'eleitor-demorando': {
		titulo: 'Eleitor demorando',
		acontecendo: 'O eleitor está há muito tempo sem apertar nenhuma tecla. O VOTA avisa o mesário e, se ninguém responder, faz a suspensão automática depois de uma contagem regressiva.',
		fazer: [
			{ aparelho: 'Terminal', acao: 'CONFIRMA, e depois responda se o eleitor ainda está votando.' },
			{ aparelho: 'Terminal', acao: 'Se não estiver, CORRIGE, digite o título do presidente da mesa e CONFIRMA para suspender: "NÃO VOTOU. Não entregar o comprovante".' }
		],
		real: 'O eleitor suspenso pode voltar para votar até o encerramento, às 17h.',
		emulador: 'O alarme sonoro da suspensão automática é tocado pelo navegador; veja Ajuda › Fidelidade e limitações.'
	},
	opcoes: {
		titulo: 'Opções do mesário',
		acontecendo: 'O terminal mostra o menu de opções: ativar o áudio para eleitores com deficiência visual, encerrar a votação e outras funções da seção.',
		fazer: [{ aparelho: 'Terminal', acao: 'Digite o número da opção e CONFIRMA, ou CORRIGE para voltar.' }],
		real: 'A votação só pode ser encerrada a partir das 17h (horário de Brasília), exceto se todos os eleitores da seção já tiverem votado.'
	},
	identificacao: {
		titulo: 'Identificação do eleitor',
		acontecendo: 'O VOTA procura o eleitor no cadastro da seção e confere a identidade: pela digital quando cadastrada, ou pelo ano de nascimento quando a biometria não é usada.',
		fazer: [{ aparelho: 'Terminal', acao: 'Siga as perguntas do terminal (ano de nascimento, confirmação) e CONFIRMA.' }],
		real: 'Um título digitado errado gera um alerta no log ("Identificador do eleitor digitado inválido"), visível no Registro.'
	},
	votacao: {
		titulo: 'O eleitor está votando',
		acontecendo: 'A urna está liberada e o eleitor vota cargo por cargo. A ordem dos cargos aparece no alto da tela da urna. Enquanto isso, o terminal mostra só o cargo em votação ("VOTANDO PARA: Vereador"), nunca o voto, e a luz AGUARDE fica acesa.',
		fazer: [
			{ aparelho: 'Urna', acao: 'Digite o número do candidato (ou do partido, nos cargos proporcionais) e confira o nome e a foto na tela.' },
			{ aparelho: 'Urna', acao: 'CONFIRMA registra o voto; CORRIGE apaga o número; BRANCO vota em branco. Um número inexistente vira voto nulo.' }
		],
		real: 'O voto vai para o Registro Digital do Voto (RDV) sem nenhuma ligação com o eleitor: o sigilo é garantido pela forma como a urna embaralha os votos.'
	},
	encerramento: {
		titulo: 'Encerramento da votação',
		acontecendo: 'O mesário encerra a votação no terminal. A partir daqui nenhum eleitor pode votar, e a urna passa a gerar os resultados da seção.',
		fazer: [
			{ aparelho: 'Terminal', acao: 'Siga as confirmações do terminal: título do mesário que encerra e confirmação final.' },
			{ aparelho: 'Urna', acao: 'Depois do encerramento, a urna conduz a emissão do boletim.' }
		],
		real: 'Antes de encerrar, o presidente da mesa confirma que não há mais eleitores na fila.'
	},
	'emissao-bu': {
		titulo: 'Boletim de Urna (BU)',
		acontecendo: 'A urna soma os votos e imprime o Boletim de Urna: o resultado da seção, com o total de cada candidato, brancos e nulos, e um QR code que qualquer pessoa pode conferir.',
		fazer: [
			{ aparelho: 'Urna', acao: 'Confirme as impressões pedidas na tela com CONFIRMA.' },
			{ aparelho: 'Impressora', acao: 'Acompanhe as vias do BU na bobina.' }
		],
		real: 'Uma via do BU é afixada na porta da seção, para que qualquer cidadão possa conferir o resultado.'
	},
	'retirar-midia': {
		titulo: 'Retirada da mídia de resultado',
		acontecendo: 'Os arquivos de resultado (BU, RDV, log, assinaturas) foram gravados na mídia de resultado, um pen drive que segue para o cartório eleitoral e é transmitido ao TSE.',
		fazer: [
			{ aparelho: 'Arquivos', acao: 'Quando a urna pedir, retire a mídia pelo botão de ejetar ao lado de "Mídia de resultado" no navegador de arquivos.' },
			{ aparelho: 'Urna', acao: 'Confirme na urna que o compartimento da mídia foi lacrado.' }
		],
		emulador: 'Os arquivos ficam no sistema de arquivos do emulador e podem ser examinados no navegador de arquivos.'
	},
	encerrada: {
		titulo: 'Sessão encerrada',
		acontecendo: 'A votação terminou e os resultados foram gravados. Os arquivos gerados pelo VOTA (BU, RDV, log) estão no navegador de arquivos.',
		fazer: [
			{ aparelho: 'Arquivos', acao: 'Examine os arquivos de resultado em Arquivos › Mídia de resultado ou Dados dinâmicos.' },
			{ aparelho: 'Sessão', acao: 'Para votar de novo, comece uma nova sessão.' }
		]
	}
};
