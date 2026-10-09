// "Fidelidade e limitações": what the TSE's VOTA does by itself in UrnaEmu, what the emulator
// reconstructs or replaces around it, every in-memory patch, and the known limits. This is the
// single source for the in-app screen (Ajuda › Fidelidade e limitações). Function numbers refer
// to the WebAssembly function index space of the supported build; "slot" is the index in the
// indirect-call table.
//
// Block types: { p }, { lista: [...] }, { codigo }, { tabela: { colunas, linhas } }, { aviso }.
// Adaptations carry `ativa(app)` to show, in the app, whether they are active right now.

import HASHES from './engine/runtime-hashes.json' with { type: 'json' };

export const VERSAO_SUPORTADA = {
	origem: 'Simulador de Votação do TSE, captura de 06/10/2026',
	arquivo: 'vendor/wasm/vota_web_wasm.wasm',
	// The build the in-memory patches are written for (the same hash the patcher checks).
	sha256: HASHES.files['vendor/wasm/vota_web_wasm.wasm'],
	versao: 'VOTA 10.23.0.1 - DESENVOLVIMENTO (registrado pelo próprio VOTA no log)'
};

/** Adaptations: everything the emulator does to or around VOTA, by kind. */
export const ADAPTACOES = [
	// ---- In-memory patches of the binary ----
	{
		id: 'thread-alarme-eleitor-demorando',
		tipo: 'correcao',
		titulo: 'Alarme da suspensão automática sem linha de execução',
		onde: 'Função 5392 (início da std::thread do alarme de vota::CSuspensaoAutomaticaEleitor::DisparaSinalizacaoSonora()).',
		problema:
			'Quando o eleitor fica inativo, o VOTA mostra "Suspensão automática em N segundos…" e, a cada segundo, dispara um alarme sonoro em uma std::thread. O lambda dessa thread (função 10410) só toca um bipe no terminal do mesário (IScreenMT, método da posição 6 da vtable, argumentos 50 e 3). Na versão web, compilada sem suporte a threads, o compilador transformou a criação da thread em um lançamento incondicional de exceção ("thread constructor failed", erro 138, chamada 1223), então a tela parava logo no início: o CTickManager::StartTick (função 700), que arma a contagem regressiva, nunca era chamado.',
		mudanca:
			'Os bytes iniciais da função 5392, global.get 0 (23 00), viram return + unreachable (0f 00). A função retorna sem tentar criar a thread, e o restante do StartState (contagem, StartTick, redesenho) roda normalmente no código original. O bipe é tocado pelo navegador nos mesmos pontos em que a thread seria criada (no StartState, slot 4247 → função 10409, e em cada ProcessTick da contagem, slot 4251 → função 10405, nas mesmas condições testadas pelo código nativo), por services/native-voter-alarm.js.',
		efeito: 'A contagem "Suspensão automática em 10…1 segundos" corre, o alarme toca, e o VOTA suspende o eleitor ("Eleitor foi suspenso automaticamente").',
		teste: 'tests/late-voter.mjs',
		ativa: (app) => app?.wasmPatches?.applied?.some((p) => p.id === 'thread-alarme-eleitor-demorando')
	},
	{
		id: 'justificativa-uso-apos-liberacao',
		tipo: 'correcao',
		titulo: 'Justificativa: leitura de memória já liberada (defeito no VOTA)',
		onde: 'Função 10590 (entrada da tela vota::CPedeAnoNascimento, com comum::CJustificador::Justifica e SaveCurrentInternal embutidos).',
		problema:
			'Ao salvar uma justificativa, o VOTA obtém a identidade do eleitor em um objeto temporário (chamada 1535, IInformacaoThreadOperador::GetIdentidadeEleitor), libera o buffer do título desse temporário (operator delete, chamada 136) e, em seguida, constrói o número do título (CNumeroInscricaoEleitoral, chamada 1241) a partir do texto já liberado. É um caso clássico de referência pendente em C++. Quando o alocador reaproveita a memória, os primeiros bytes passam a conter ponteiros internos do alocador, e o VOTA rejeita o "título" (ex.: "O número de identificação de eleitor deve ser numérico ($Œ␝"). O erro era intermitente, conforme o estado do alocador. Não sabemos se a urna real, com outro alocador, manifesta o problema.',
		mudanca: 'A chamada que libera o buffer (10 88 01, call 136) vira drop + nop + nop (1a 01 01): o buffer não é liberado (alguns bytes por justificativa permanecem alocados), e o título lido é o correto.',
		efeito: 'A justificativa de um eleitor de outra seção termina com "AUSÊNCIA JUSTIFICADA" todas as vezes.',
		teste: 'tests/justification.mjs',
		bugVota: true,
		ativa: (app) => app?.wasmPatches?.applied?.some((p) => p.id === 'justificativa-uso-apos-liberacao')
	},
	{
		id: 'fone-espera-thread-eleitor',
		tipo: 'correcao',
		titulo: '"Retire o fone de ouvido": espera ativa pela thread do eleitor',
		onde: 'Função 10435 (entrada da tela vota::CDesabilitaAudioEleitor).',
		problema:
			'Após o CONFIRMA do mesário, o VOTA envia a mensagem 10 (desativar áudio) à thread do eleitor e espera, em um laço com usleep(300) (função 3966 → nanosleep 6265), que a thread do eleitor sinalize o estado 2. Na versão web há uma só thread: enquanto esse laço roda, o lado do eleitor não pode rodar, e a aba do navegador travava.',
		mudanca: 'A condição do laço (i32.const 2; i32.ne, bytes 41 02 47) vira drop; i32.const 0 (1a 41 00): não há espera. O lado do eleitor processa a mensagem 10 na sua próxima execução, logo em seguida.',
		efeito: 'O CONFIRMA após "Retire o fone de ouvido da urna" conclui o voto normalmente.',
		teste: 'tests/headphones.mjs',
		ativa: (app) => app?.wasmPatches?.applied?.some((p) => p.id === 'fone-espera-thread-eleitor')
	},

	// ---- Reconstructions of what the web build omits ----
	{
		id: 'thread-operador',
		tipo: 'reconstrucao',
		titulo: 'Thread do operador (terminal do mesário)',
		onde: 'session/training-session.js, session/operator-event-pump.js, session/experimental-screens.js.',
		problema:
			'Na urna, o terminal do mesário é conduzido por vota::CThreadOperador::Run() (função 10204), uma thread própria. O Simulador do TSE só tem a urna: essa thread nunca roda na versão web.',
		mudanca:
			'O emulador executa as telas do operador uma a uma, chamando os métodos originais de cada estado (StartState, NeedChangeState, GetNextState, EndState, ProcessInput) pela tabela de funções, depois de conferir a assinatura de cada um contra o catálogo de 197 estados com nome RTTI. Mensagens da fila de prioridade original (no objeto da thread, global 0x1d2b9c) são entregues ao estado ativo pelo seu tratador (posição 6 da vtable), como faria o laço nativo. O lado do eleitor roda no executor original (slot 863 → função 7823, CThreadEleitor::ProcessarEntrada).',
		efeito: 'Abertura (teste de teclado, zerésima), registro de mesários, identificação, liberação, justificativa, suspensão e encerramento seguem as máquinas de estado originais.',
		teste: 'tests/training-session.mjs, tests/official-eleitorado.mjs, tools/qa-stress.mjs',
		ativa: (app) => !!app?.session?.enabled
	},
	{
		id: 'ticks',
		tipo: 'reconstrucao',
		titulo: 'Temporizadores das telas (CTickManager)',
		onde: 'session/operator-event-pump.js (deliverTicks).',
		problema:
			'As telas registram temporizadores com api::CTickManager (AddTick, StartTick, StopTick: funções 3644, 700, 5451) e recebem ProcessTick(id) (posição 8 da vtable) quando o prazo vence. Quem entrega esses ticks é o laço da thread, que não roda na versão web. Sem eles, a contagem da suspensão automática não andava, o reteste do teclado ficava em "espere 0s" e a espera pelo início da votação (08:00) dependia de um paliativo.',
		mudanca:
			'O emulador lê a tabela de ticks do próprio VOTA (um std::map no objeto da thread: raiz em +24, tamanho em +28; cada nó tem o id em +16, o período em ms em +24, o próximo prazo em +32/+40 e a marca de parado em +48) e, quando um prazo vence pelo relógio da urna, chama o ProcessTick original da tela ativa e adianta o prazo em um período. Durante a abertura, usa a tabela da thread do eleitor (CThreadEleitor, global 0x1bf8fc), cujas telas de abertura o emulador executa; depois, a da thread do operador. Depois da abertura, os ticks do lado do eleitor são entregues pelo próprio laço original.',
		efeito: 'Contagens, retestes, a espera pelo horário de início e a inspeção periódica da cabina ("Por favor, inspecione cabina e urna", na fase oficial) funcionam com o código original.',
		teste: 'tests/keyboard-retry.mjs, tests/voting-start.mjs, tests/late-voter.mjs',
		ativa: (app) => !!app?.session?.enabled
	},
	{
		id: 'teclados',
		tipo: 'reconstrucao',
		titulo: 'Dois teclados separados',
		onde: 'runtime/key-router.js.',
		problema:
			'A versão web tem um único teclado: o VOTA lê toda tecla por wasm_input_get_key, que tira da fila Module.uenuxKeys sem indicar o dispositivo. A urna real tem dois dispositivos: o teclado da urna e o do terminal do mesário. Com uma fila só, uma tecla do terminal poderia chegar ao eleitor.',
		mudanca:
			'Module.uenuxKeys passa a ser um roteador com uma fila por teclado (protegido contra a substituição feita por wasm_input_clear). Uma leitura nativa só recebe teclas do teclado do lado que está executando: o executor do eleitor lê a urna; as telas do operador leem o terminal, exceto as telas de abertura (teste de teclado, zerésima), que leem a urna como na urna real. Nenhuma tecla é recusada: o VOTA lê ou ignora; o que não foi lido é descartado e registrado no log do desenvolvedor.',
		efeito: 'Teclas do terminal não alteram o voto; teclas da urna não liberam eleitores.',
		teste: 'tests/keypads.mjs, tests/suspended-menu.mjs',
		ativa: (app) => !!app?.keys
	},

	// ---- Adjustments to the TSE bridge ----
	{
		id: 'sem-eleitor-automatico',
		tipo: 'ponte',
		titulo: 'Sem eleitor liberado automaticamente',
		onde: 'services/native-full-session.js (installNoAutoVoter).',
		problema: 'Durante votaInit, a ponte do Simulador envia incondicionalmente um evento "habilitar eleitor" (slot 57 → função 11026): no simulador, a urna começa liberada. Com o terminal, isso criava, logo na inicialização, um eleitor que o mesário nunca liberou.',
		mudanca: 'Em sessões com terminal, esse evento é omitido durante a inicialização. Depois dela, o slot volta a chamar a função original.',
		efeito: 'A urna fica bloqueada até o mesário liberar o eleitor.',
		teste: 'tests/training-session.mjs',
		ativa: (app) => !!app?.noAutoVoter
	},
	{
		id: 'voz-nas-sessoes',
		tipo: 'ponte',
		titulo: 'Voz para eleitores com áudio habilitado pelo mesário',
		onde: 'services/native-full-session.js (installSessionVoice), controller.js (configuração do votaInit).',
		problema:
			'A ponte só inicializa o sintetizador de voz RHVoice (slot 42 → função 11264, configuração /etc/RHVoice) quando a opção audioEleitorHabilitado está ligada, e a mesma opção faz todo eleitor começar com áudio (IExecucaoVota::GetInst, slot 54, e depois slot 55 → função 11100). Sem ela, um eleitor com áudio habilitado pelo mesário via a tela acessível em silêncio.',
		mudanca: 'Sessões ligam a opção (o sintetizador é inicializado) e omitem, só durante votaInit, a etapa do slot 55. A reprodução no navegador fica sempre ligada; quem decide quando falar é o VOTA.',
		efeito: 'Só os eleitores com áudio habilitado pelo mesário ouvem a voz.',
		teste: 'tests/headphones.mjs',
		ativa: (app) => !!app?.sessionVoice
	},
	{
		id: 'correspondencia-secao',
		tipo: 'ponte',
		titulo: 'Correspondência do BU com a seção da mídia',
		onde: 'services/native-eg-fixture.js (slot 404 → função 10261).',
		problema:
			'O estado geral da urna (eg.bin) da versão web é uma simulação de teste do TSE ("7.2.1.3 - TESTE EG ASN1"). A correspondência que o BU registra (a seção para a qual a urna foi carregada, comum::md::CCorrespondenciaResultado) é montada com valores fixos, entre eles município 1, zona 1 e seção 1, enquanto o RDV usa a seção configurada. Numa mídia de outra seção, BU e RDV discordavam e o BU não passava na verificação (correspondência e cadeia de hashes).',
		mudanca: 'A função que monta essa correspondência é envolvida desde a criação do módulo: o código original monta o registro e, em seguida, o emulador grava nele o local da mídia: município (32 bits em +40), zona (16 bits em +44) e seção (16 bits em +46), campos localizados no registro vivo. Só o registro intacto da simulação (município 1, zona 1, seção 1) é alterado, e só quando a mídia é de outro local.',
		efeito: 'Numa mídia movida para outro município, zona ou seção, o BU traz o novo local e é verificado (BU, RDV, cadeia de hashes, assinaturas).',
		teste: 'tests/section-change.mjs',
		ativa: (app) => (app?.correspondenceFixture?.applied ?? 0) > 0
	},
	{
		id: 'sessao-oficial',
		tipo: 'ponte',
		titulo: 'Inicialização completa (fase oficial)',
		onde: 'services/native-full-session.js (installNativeFullSession).',
		problema: 'A ponte marca a seção como "já votando" e pula a criação dinâmica dos dados da sessão, adequado ao simulador mas não a uma sessão completa.',
		mudanca:
			'Na fase oficial, o emulador preserva o estado produzido pela criação dinâmica original (slot 51), executa DynamicCreate e CompleteLoad originais (slot 41, tabela 1800), cria os diretórios de resultado vazios e fornece metadados de teste para os módulos de resultado (arquivos /etc/dependencias.properties e /etc/versoes.properties, vazios na mídia do simulador). Esses metadados não atestam compatibilidade com uma urna física.',
		efeito: 'BU, RDV, logs e assinaturas são gerados pelo código original ao encerrar a votação.',
		teste: 'tests/official-eleitorado.mjs, tests/native-closing.mjs',
		ativa: (app) => !!app?.fullSession
	},

	// ---- Devices and services the emulator provides ----
	{ id: 'relogio', tipo: 'dispositivo', titulo: 'Relógio da urna', onde: 'devices/clock.js', problema: 'A urna tem relógio próprio; o simulador usa o do computador.', mudanca: 'As chamadas de data e hora do VOTA (importações a.R, a.ia e a.aa) leem um relógio simulado: o do computador, fixo ou correndo a partir de uma data escolhida. Relógios monotônicos e as pausas nativas continuam no tempo real.', efeito: 'É possível votar "no dia da eleição" e encerrar após as 17h a qualquer momento.', teste: 'tests/unit/native-clock.test.mjs', ativa: (app) => !!app?.clock?.installed },
	{ id: 'impressora', tipo: 'dispositivo', titulo: 'Impressora térmica', onde: 'devices/printer.js, services/native-paper-capture.js, devices/escpos.js', problema: 'A versão web não tem impressora.', mudanca: 'As chamadas nativas de impressão (texto, quebras, QR em bitmap, corte) são capturadas e desenhadas em uma bobina com alimentação simulada (100 mm/s por padrão, uma estimativa: não há velocidade oficial publicada). O VOTA espera o papel terminar. Opcionalmente, as mesmas operações são enviadas a uma impressora ESC/POS real por porta serial.', efeito: 'Zerésima, BU e demais relatórios saem como o VOTA os gera.', teste: 'tests/printer-feed.mjs, tests/printer-ui.mjs', ativa: (app) => !!app?.printer?.installed },
	{ id: 'energia', tipo: 'dispositivo', titulo: 'Energia e bateria', onde: 'services/native-power.js', problema: 'O simulador usa uma simulação fixa de energia (api::teste::CPowerMock).', mudanca: 'O emulador altera os campos de fonte e carga desse objeto e pede ao VOTA que redesenhe os indicadores.', efeito: 'Ícone de bateria e luz "Bateria interna" seguem a escolha do usuário.', teste: 'tests/native-power.mjs, tests/power-ui.mjs', ativa: (app) => !!app?.power },
	{ id: 'biometria', tipo: 'dispositivo', titulo: 'Leitor biométrico', onde: 'services/native-fingerprint.js', problema: 'Não há leitor biométrico no navegador, e a versão web não registra os serviços api::IFingerScanner e api::IFingerDetection que o VOTA pede.', mudanca: 'O emulador registra os dois serviços no registro de singletons do VOTA. A cada temporizador da tela de digital do mesário (CPedeDigitalMesario::ProcessTick, função 10316), o VOTA pede uma imagem ao leitor e só considera o dedo capturado se o tamanho da imagem for o esperado; o leitor simulado devolve sempre uma imagem vazia ("nenhum dedo ainda"), então o VOTA continua esperando e, sem resposta, encerra pelo próprio tempo limite ("Mesário(a) não reconhecido(a)"). "Dedo correto" injeta a aceitação no estado nativo que a aguarda; "Dedo errado" e "Tempo esgotado" seguem o caminho nativo de rejeição. Não há comparação biométrica real. (Antes do registro de api::IFingerDetection, esperar alguns segundos na tela de digital encerrava a sessão com "solicitada uma instancia nao criada".)', efeito: 'O registro de mesários e a identificação por digital seguem as telas originais, inclusive o tempo limite do próprio VOTA.', teste: 'tests/biometric-acceptance.mjs', ativa: (app) => !!app?.fingerprint },
	{ id: 'biometria-eleitor', tipo: 'dispositivo', titulo: 'Biometria simulada por eleitor', onde: 'load/simulated-biometrics.js, services/native-voter-biometrics.js, runtime/biometric-exports.js', problema: 'O cadastro biométrico nativo depende de material cifrado e de serviços de reconhecimento indisponíveis no navegador.', mudanca: 'Na versão incluída do VOTA, BiometriaEleitorCifrada é uma SEQUENCE com composicaoBiometria, conteudo e salt. O emulador grava um marcador exclusivo, reconhecido pelo adaptador da conversão (função 11419); outros conteúdos seguem para o conversor original. O marcador fornece uma coleção de dedos presente e vazia, sem foto ou modelos reais. O VOTA escolhe CPedeDigital. Dedo correto ou errado fornece uma resposta à rotina nativa 5397; tempo esgotado usa o temporizador nativo 10465. O emulador expõe quatro funções existentes em uma cópia do WASM verificada por hash, sem alterar seus corpos. Para que o escritor nativo registre a habilitação, fornece bytes identificados como VOTA-SIMULATED-CAPTURE-1;NOT-A-WSQ-IMAGE e um envelope wsq.pk1 com a identidade de teste. O serviço IFingerMatcher fornece apenas score zero; não realiza comparação. O método GetInt32 do gerador nativo (9500) recria seu estado a cada chamada e repete o mesmo número: no segundo arquivo biométrico isso trava a busca de um nome livre. O adaptador atende esse método com crypto.getRandomValues do navegador. Os callbacks do leitor e de assinatura encaminham chamadas de outros objetos diretamente em WASM, preservando a suspensão assíncrona durante o encerramento. Não há cifra biométrica de produção nem imagem WSQ real.', efeito: 'As telas, tentativas, liberação e contadores de comparecimento pertencem ao VOTA; o usuário escolhe o resultado simulado no leitor.', teste: 'tests/voter-biometrics.mjs, tests/unit/voter-biometrics.test.mjs', ativa: (app) => !!app?.voterBiometrics },
	{ id: 'criptografia', tipo: 'dispositivo', titulo: 'Assinaturas e chaves', onde: 'services/webcrypto-provider.js, services/native-test-key.js, load/identity-store.js', problema: 'A urna assina resultados com chaves de hardware; o navegador não tem esse hardware.', mudanca: 'As chamadas de assinatura do VOTA são atendidas por uma identidade de teste do emulador: uma chave ECDSA P-521 com certificado X.509 autoassinado, cujos campos (titular, número de série, validade) o usuário define em Mídia de carga › Identidade. A identidade fica no navegador, é escolhida explicitamente (nunca criada de forma implícita) e assina tanto a mídia oficial quanto os resultados da sessão, com o mesmo certificado. Não são credenciais da Justiça Eleitoral.', efeito: 'BU, RDV e logs são assinados pelo código original com a chave de teste, e as assinaturas são verificáveis.', teste: 'tests/identity.mjs, tests/async-runtime.mjs, tests/native-output.mjs', ativa: (app) => !!app?.pkcs11 },
	{ id: 'midias', tipo: 'dispositivo', titulo: 'Mídias de carga e de resultado', onde: 'load/*, services/native-full-session.js', problema: 'Mídias físicas não existem no navegador.', mudanca: 'A mídia de carga é montada no sistema de arquivos em memória a partir do cenário do simulador ou de uma mídia gerada/importada. A mídia oficial gerada tem cada arquivo assinado (.vsc) pela identidade de teste; o emulador recusa aplicar uma mídia oficial com assinatura inválida ou arquivo sem assinatura (exceto serialv.dat, que não tem catálogo na mídia do simulador). Referências do catálogo original a arquivos que o simulador não traz (outras seções da zona, arquivos .ver) são omitidas e listadas na exportação. A fase (treinamento ou oficial) e o local de votação (município, zona e seção) podem ser mudados em Mídia de carga › Eleição e seção. Os municípios do cenário podem ser renomeados e novas zonas podem ser criadas; a seção é livre. Não é possível criar números de município novos: o VOTA recusa, já na inicialização, municípios fora do conjunto do cenário (no simulador, 1, 2 e 3). O local é trocado em todos os lugares em que aparece: códigos da seção e da zona nos nomes dos arquivos e dos pacotes (.pid), cabeçalhos [[município, zona], local, seção], lista de seções da zona, registros de município e fuso horário do local de votação (-lo.dat, copiados de -mu.dat e -cm.dat), nas eleições municipais os pacotes de candidatos do município (nomes, cabeçalho e identificador do pacote), e os catálogos de assinatura; a mídia oficial é reassinada. Turno, processo e cargos vêm do cenário. A UF também pode ser trocada (experimental): o emulador reescreve a sigla da UF nos nomes dos arquivos e no conteúdo (-mu, -mz, -cm, -cp, -lo e os pacotes de candidatos), atualiza as referências nos .pid e nos catálogos de assinatura e reassina a mídia oficial; os eleitores mantêm o código de origem nos títulos (o VOTA os aceita) e, ao contrário dos municípios, o VOTA não valida a UF contra uma tabela interna. No eleitorado, cada eleitor tem título e, opcionalmente, CPF: o CPF é gravado como segundo identificador ([1]) do registro do eleitor, formato confirmado por experimento (o VOTA encontra o eleitor pelo CPF digitado no terminal). Cada eleitor pode ter biometria simulada: o editor grava um marcador próprio no elemento BiometriaEleitorCifrada da carga. O adaptador reconhece apenas esse marcador e fornece ao VOTA uma inscrição biométrica sintética. A opção também é preservada no CSV e na mídia exportada. A presença da mídia de resultado é simulada (inserir/ejetar), e os arquivos ficam no sistema de arquivos do emulador.', efeito: 'Os arquivos lidos e escritos pelo VOTA podem ser examinados no navegador de arquivos.', teste: 'tests/load-editor-browser.mjs, tests/official-load-browser.mjs, tests/official-signatures.mjs, tests/section-change.mjs, tests/cpf.mjs', ativa: () => true },
	{ id: 'candidatos', tipo: 'dispositivo', titulo: 'Candidatos e partidos da mídia de carga', onde: 'load/candidates.js, load/candidate-photo.js', problema: 'O simulador traz candidatos e partidos fixos, e não há documentação pública do formato desses arquivos.', mudanca: 'O formato foi decodificado a partir das mídias do simulador (igual em todos os cenários). Em <eleição>-ca.dat, cada cargo lista partidos e cada partido lista candidaturas: número, titular e, quando o cargo exige, vice ou suplentes. Cada pessoa tem um código de candidato, nome completo, nome na urna, nome fonético opcional (usado pela voz), nascimento, gênero (2 masculino, 4 feminino: decide "Prefeito" ou "Prefeita" na tela, confirmado por experimento) e situação (12, apta). Os partidos ficam em <eleição>-pa.dat (número, sigla, nome) e as fotos em <eleição>-fo.dat, ligadas pelo código do candidato (JPEG 161×225 para titulares, 111×155 para vice e suplentes). O editor lê e regrava os três arquivos de forma consistente: ao remover uma candidatura, a foto sai junto; uma nova pessoa recebe um código livre e uma foto (escolhida ou genérica); o número do candidato começa com o do partido e tem os dígitos do cargo (lidos de -ce.dat). Campos de significado desconhecido (um inteiro e um booleano de cada pessoa, um texto da candidatura, uma sequência vazia do partido, um inteiro do cargo) são mantidos como estão, e uma pessoa nova copia os valores de todas as pessoas do simulador. Ler e regravar sem alterações reproduz os arquivos byte a byte em todos os cenários. Coligações e federações (-co, -fe) estão vazias em todos os cenários e não são editáveis; a situação da candidatura não muda (só "apta" foi verificada). Na fase oficial, os arquivos são reassinados ao salvar.', efeito: 'O VOTA lista os candidatos e partidos editados, mostra nomes, gênero e fotos, e os votos para candidatos novos entram no BU, que é verificado.', teste: 'tests/unit/candidates.test.mjs, tests/candidates.mjs', ativa: () => true },
	{ id: 'automacao', tipo: 'dispositivo', titulo: 'Votação automática e tours guiados ("Fazer por mim")', onde: 'session/keypad-driver.js, session/procedures.js, simulator/voter-simulator.js, tours/index.js', problema: 'Para estudar o dia da eleição, é útil que alguns passos sejam feitos automaticamente.', mudanca: 'A votação automática e o botão "Fazer por mim" dos tours apertam as mesmas teclas que um mesário e um eleitor apertariam, só quando o VOTA está lendo aquele teclado, e respondem ao que o VOTA mostra no terminal e na urna (teste de teclado, impressão da zerésima, liberação, votos, inspeção da cabina, encerramento). Além das teclas, só usam o relógio simulado (8h para começar, 17h05 para encerrar), o leitor biométrico e a retirada da mídia de resultado, como um usuário faria pelos controles. Nunca alteram contadores, votos ou o estado interno do VOTA. Os tours são feitos para sessões de treinamento.', efeito: 'Votos e relatórios produzidos assim são os mesmos de uma votação feita à mão; o BU confere com o total esperado.', teste: 'tests/tours.mjs, tests/voter-simulator.mjs', ativa: (app) => !!app?.procedures },
	{ id: 'instantaneos', tipo: 'dispositivo', titulo: 'Instantâneos da sessão e reinício da votação', onde: 'snapshot.js, components/panels/SnapshotWindow.svelte', problema: 'Não é possível salvar a memória de um programa WebAssembly em execução (com chamadas nativas suspensas pelo JSPI) e restaurá-la depois.', mudanca: 'Um instantâneo guarda a configuração da sessão (cenário, opções, mídia de carga completa, relógio, certificado da identidade que assina, nunca a chave privada), todos os arquivos que o VOTA gravou em /dsk (dados dinâmicos, logs, resultados) e o papel impresso. Retomar reinicia o emulador com a mesma configuração e grava esses arquivos antes de o VOTA começar; o próprio VOTA decide retomar a seção, pelo mesmo caminho de uma urna real reiniciada no meio da votação: pergunta "Quer testar o teclado?", mostra "REINÍCIO DA VOTAÇÃO" e continua com os votos já registrados (verificado: depois de 2 votos, retomar e votar mais 1, o BU impresso registra comparecimento 3). A urna guarda os dados dinâmicos na memória interna (fi) e um espelho na externa (fe), e o VOTA lê os dois ao reiniciar; a versão web só grava o interno na primeira sessão, então o emulador restaura o espelho com os mesmos bytes (sem ele o VOTA para com "O arquivo [/dsk/fe/dinamico/eg.bin] não existe"). Começar de novo usa a mesma configuração sem os arquivos gravados. Um instantâneo também pode ser aberto só para leitura: arquivos (BU e RDV verificados, logs) e papel.', efeito: 'Uma sessão pode ser continuada depois, repetida com a mesma mídia ou examinada; o reinício mostrado é o do VOTA, não uma simulação.', teste: 'tests/snapshot.mjs', ativa: () => true },

	// ---- Diagnostics (no behaviour change) ----
	{ id: 'diagnostico', tipo: 'diagnostico', titulo: 'Diagnósticos', onde: 'controller.js', problema: 'Erros nativos chegam ao navegador sem a pilha de chamadas do WebAssembly.', mudanca: 'Cada exceção C++ (importação a.b, ___cxa_throw) registra a pilha de funções nativas no log do desenvolvedor, e cada som entregue ao navegador (importação a.da) é registrado. O comportamento não muda.', efeito: 'Falhas podem ser rastreadas até as funções do VOTA.', teste: '—', ativa: () => true }
];

const TIPOS = {
	correcao: 'Correção no binário (em memória)',
	reconstrucao: 'Reconstrução do que a versão web não tem',
	ponte: 'Ajuste da ponte do Simulador',
	dispositivo: 'Dispositivo ou serviço do emulador',
	diagnostico: 'Diagnóstico'
};
export { TIPOS };

export const SECOES = [
	{
		id: 'aviso',
		titulo: 'Antes de tudo',
		blocos: [
			{
				aviso:
					'O UrnaEmu é um emulador independente, sem vínculo com a Justiça Eleitoral. Uma falha durante o uso provavelmente vem da emulação (as partes que o emulador reconstrói ou substitui, descritas abaixo), e não indica, por si só, um defeito no VOTA. As exceções conhecidas estão marcadas nesta página como defeito no VOTA.'
			}
		]
	},
	{
		id: 'vota',
		titulo: 'O que é executado pelo VOTA',
		blocos: [
			{
				p: 'O VOTA é o aplicativo de votação da urna eletrônica. O TSE publica, no Simulador de Votação, uma versão do VOTA compilada para WebAssembly, com uma ponte para o navegador (vota_web_wasm.cpp: votaInit, votaTick, votaPressKey, votaGetStateJson, SetAudioEnabled). O UrnaEmu executa esse mesmo binário, sem recompilação.'
			},
			{
				lista: [
					'Versão suportada: ' + VERSAO_SUPORTADA.origem + '.',
					'Arquivo: ' + VERSAO_SUPORTADA.arquivo + ', SHA-256 ' + VERSAO_SUPORTADA.sha256 + '.',
					VERSAO_SUPORTADA.versao + '.',
					'Os arquivos do VOTA ficam byte a byte idênticos aos do Simulador (verificado pelos testes). As correções descritas abaixo são aplicadas a uma cópia em memória, e só quando o SHA-256 é o da versão suportada.'
				]
			},
			{ p: 'Ficam inteiramente a cargo do código original do VOTA:' },
			{
				lista: [
					'As telas da urna e do terminal e as máquinas de estado que as conduzem (abertura, teste de teclado, zerésima, registro de mesários, identificação, liberação, votação cargo a cargo, justificativa, suspensão, encerramento).',
					'As regras de votação: números válidos, votos nominais, de legenda, brancos e nulos, nulo por repetição, cargos e candidatos lidos da mídia de carga.',
					'A contagem, o Registro Digital do Voto (RDV), o Boletim de Urna (BU) e os relatórios impressos, inclusive os QR codes.',
					'O log da urna (logd.dat) e os arquivos de resultado, com os mesmos formatos da urna.',
					'A leitura da mídia de carga e a validação dos dados do eleitorado e dos mesários.',
					'A síntese de voz para eleitores com áudio (RHVoice).'
				]
			},
			{
				p: 'O emulador nunca altera contadores, votos ou arquivos de resultado do VOTA. Ele fornece entradas (teclas, relógio, energia, biometria, mídias), entrega mensagens e temporizadores que a versão web não entrega, e mostra as saídas (telas, terminal, papel, arquivos). As intervenções diretas incluem as três correções no binário, o ajuste da seção na correspondência do BU e os adaptadores de biometria simulada descritos abaixo.'
			}
		]
	},
	{
		id: 'fora',
		titulo: 'O que é feito fora do VOTA',
		blocos: [
			{
				p: 'O Simulador do TSE reproduz só a votação de um eleitor na urna. Uma seção eleitoral completa precisa do terminal do mesário, de relógio, impressora, energia, biometria, mídias e assinaturas. A seguir, cada parte que o emulador reconstrói, ajusta ou substitui.'
			},
			{ adaptacoes: ['reconstrucao', 'ponte', 'dispositivo'] }
		]
	},
	{
		id: 'correcoes',
		titulo: 'Correções aplicadas ao binário',
		blocos: [
			{
				p: 'Três problemas desta versão web (um deles, um defeito do próprio código do VOTA) não têm como ser contornados por fora, porque acontecem dentro de uma única função nativa. Para elas, o emulador altera alguns bytes de uma cópia em memória do VOTA antes de compilá-la. Cada correção indica a função, os bytes exatos esperados e os bytes de substituição, de mesmo tamanho. Ela só é aplicada se o binário for exatamente a versão suportada e se os bytes esperados aparecerem uma única vez na função; caso contrário, não é aplicada, e o motivo é registrado. Os arquivos em disco não mudam.'
			},
			{
				p: 'O UrnaEmu usa somente a versão do VOTA incluída na instalação, que é a versão suportada. Se o binário fosse outro, nenhuma correção seria aplicada (o motivo fica registrado no log), e os problemas que elas resolvem voltariam a acontecer.'
			},
			{ adaptacoes: ['correcao'] }
		]
	},
	{
		id: 'diagnosticos',
		titulo: 'Diagnósticos',
		blocos: [{ adaptacoes: ['diagnostico'] }]
	},
	{
		id: 'limites',
		titulo: 'Limitações conhecidas',
		blocos: [
			{
				lista: [
					'Linhas de execução: a versão web não executa threads. O substituto do TSE, simulador::CWasmThread, só registra as threads criadas pela API do VOTA, sem executá-las. Por isso o monitor da urna (vota::CThreadMonitor: alimentação, fone de ouvido, erros de memória e de teclado do terminal, registro de espaço em disco) não roda, e esses registros não aparecem no log.',
					'Detecção do fone de ouvido: não é emulada. O VOTA pede para conectar e retirar o fone, e o mesário confirma.',
					'Verificação de assinaturas: na urna, o sistema confere as assinaturas dos programas e dos dados antes do VOTA. Esta versão do VOTA não confere as assinaturas (.vsc) da mídia de carga: um arquivo alterado com assinatura antiga é aceito (verificado por experimento). Por isso o emulador confere ele mesmo, antes de aplicar a mídia: assinaturas de cada arquivo e da mídia, e, na fase oficial, que todos os arquivos estejam cobertos.',
					'Biometria: não há comparação de digitais; o resultado é escolhido pelo usuário.',
					'Velocidade da impressora: 100 mm/s é uma estimativa.',
					'Teclas não lidas: o emulador descarta teclas que o VOTA não leu. Não sabemos se a urna real as guarda para a próxima tela.',
					'Mídia de carga: dados fictícios do simulador e mídias geradas pelo emulador; não é uma carga autêntica do TSE nem inicializa uma urna física.',
					'Eleição e local: turno, processo eleitoral e cargos vêm do cenário escolhido. Os municípios do cenário podem ser renomeados e novas zonas podem ser criadas, mas não é possível criar números de município novos — o VOTA recusa municípios fora do conjunto do cenário (no simulador, 1, 2 e 3). A UF pode ser trocada (experimental); ao contrário dos municípios, o VOTA não a valida contra uma tabela interna. Os municípios do simulador têm o mesmo nome ("Minha Cidade") e os mesmos candidatos.',
					'Biometria de eleitores: a opção de biometria simulada usa o fluxo nativo de solicitação, reconhecimento e contagem. Não há derivação de chaves CEPESC, descriptografia de biometria real nem comparação de digitais. A captura arquivada é um marcador textual explícito, não uma imagem WSQ válida. As tentativas e a identificação alternativa continuam sob controle do VOTA.',
					'Coligações e federações: não editáveis (estão vazias em todos os cenários do simulador).'
				]
			}
		]
	},
	{
		id: 'verificacao',
		titulo: 'Como verificar',
		blocos: [
			{
				p: 'Cada adaptação acima indica o teste que a verifica. Os testes de navegador rodam em um Chrome visível (CDP); o teste de estresse (tools/qa-stress.mjs) percorre todos os cenários, com teclas aleatórias, até o encerramento, e lista qualquer estado nativo fora do catálogo verificado. Os decodificadores de BU e RDV em JavaScript são comparados, campo a campo, com a saída do leitor Python dos esquemas públicos do TSE (tools/tse_schema_reader.py), guardada como referência nos testes, e verificam também os resultados de uma urna real.'
			},
			{ codigo: 'pnpm test        # testes unitários, arquivos do VOTA idênticos ao Simulador, leitor de esquemas\nCDP_PORT=9224 node tests/<teste>.mjs\nCDP_PORT=9224 node tools/qa-stress.mjs --fuzz 40 --clock election' }
		]
	}
];
