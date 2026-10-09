# Mídia de carga

A mídia de carga é o conjunto de arquivos que a urna recebe antes da eleição: processo
eleitoral, cargos, eleitorado, seções, candidatos, partidos, fotos, parâmetros e as
assinaturas desses arquivos. No UrnaEmu ela é editada em **Mídia › Editor da mídia de carga**.
O editor parte dos arquivos de entrada do cenário, lidos do sistema de arquivos em memória
antes de o VOTA iniciar (`/dsk/fi/estatico` e `/dsk/fi/serialv.dat`), e não dos dados
mutáveis de uma eleição em andamento. Aplicar reinicia o emulador com a nova mídia; nada é
gravado em `reference/` nem em `static/vendor/`.

Isto não é uma imagem de mídia física inicializável: a mídia real também leva o sistema
operacional e os programas da urna. O que o emulador monta são os dados de entrada que a
versão web do VOTA lê.

## Fontes

- [Resolução TSE nº 23.751/2026, arts. 92–94 e 101–102](https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-751-de-26-de-fevereiro-de-2026):
  relatórios de preparação; partidos, federações e coligações; eleitorado; seções e
  agregações; candidatos aptos com números, nomes e fotos. São categorias, não um formato
  binário.
- [TRE-PE, preparação das urnas, setembro de 2026](https://www.tre-pe.jus.br/comunicacao/noticias/2026/Setembro/tre-inicia-geracao-de-midias-e-preparacao-das-urnas-para-as-eleicoes-2026):
  distingue mídias de carga, de votação, de resultado e de ativação.
- [Perguntas técnicas sobre a divulgação de resultados 2024, questão 11](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados-2024):
  carga de dados de candidatos, eleitores e eleição.
- Evidência binária: os pacotes de cenário do simulador (`static/vendor/wasm/bases/`) e os
  arquivos extraídos deles (vendorizados em `tests/fixtures/bases/`). Os esquemas ASN.1 públicos (BU, RDV,
  assinatura) descrevem arquivos de **saída** e não são usados como esquema de entrada; os
  formatos de entrada descritos aqui foram decodificados dos próprios arquivos e confirmados
  por experimentos com o VOTA.

## Seções do editor

| Seção | O que faz |
|---|---|
| Resumo | Fase, seção, eleitorado e assinatura da mídia; preparar uma sessão oficial em três passos. |
| Identidade | Identidades de teste que assinam a mídia oficial e os resultados. |
| Eleitorado | Eleitores da seção: título, CPF, nome, nascimento; gerar fictícios; CSV. |
| Candidatos e partidos | Partidos e candidaturas de cada cargo, com vice ou suplentes e fotos. |
| Eleição e seção | Fase (treinamento ou oficial) e local de votação: município, zona e seção. |
| Assinatura digital | Assinar os arquivos (.vsc) e a mídia; fixar uma identidade pública confiável. |
| Avançado | Qualquer arquivo: campos de texto, árvore BER completa, substituir ou baixar o arquivo. |

Alterações valem depois de **Aplicar e reiniciar**. Antes de preparar uma sessão oficial,
edições não salvas no eleitorado ou nos candidatos precisam ser salvas ou descartadas.

## Arquivo da mídia (`vota-emulator-load/1`)

Exportar gera um JSON com o formato, o cenário, a configuração de inicialização (`fase`, `pe`,
`turno`, `uf`, `municipio`, `zona`, `secao`), todos os arquivos (caminho e bytes em base64), o
relógio, os metadados da geração oficial e as assinaturas. Não é o formato de imagem de mídia
do TSE. Na importação: só são aceitos caminhos de entrada (`/dsk/fi/estatico/…` e
`/dsk/fi/serialv.dat`), sem repetições nem `..`, até 2000 arquivos e 24 MiB; uma mídia
assinada com assinatura inválida é recusada. A chave privada nunca vai no arquivo.

No editor avançado, nós BER não alterados mantêm a codificação original, e texto editado usa
Windows-1252 (caracteres fora dele são recusados). Primitivos desconhecidos aparecem em
hexadecimal. Algumas tags de contexto guardam texto ASCII, não inteiros.

## Identidades de teste

Uma identidade é uma chave ECDSA P-521 (SHA-512) com um certificado X.509 v3 autoassinado
(uso da chave: assinatura digital; não é autoridade certificadora). Em **Identidade** é
possível definir o titular (CN, O, OU, cidade, estado, país, e-mail), o número de série e a
validade; o editor avisa quando a validade não cobre o dia da eleição. As identidades ficam no
IndexedDB do navegador e podem ser importadas e exportadas em PEM: só o certificado, ou o
certificado com a chave privada (PKCS#8), necessário para usar a mesma identidade em outro
computador.

Uma identidade nunca é criada de forma implícita: gerar a mídia oficial sem uma identidade
escolhida é recusado. A identidade padrão do formulário de criação tem C=BR, ST=RJ,
L=Rio de Janeiro, O=UrnaEmu, OU=UrnaEmu, CN=UrnaEmu e e-mail contato@rlaneth.com. A sessão
assina os resultados com a mesma chave e o mesmo certificado que assinaram a mídia. Não são
credenciais da Justiça Eleitoral, e nenhuma cadeia de certificação é verificada.

## Assinaturas

Há duas camadas:

1. **Arquivos (.vsc).** Cada catálogo `.vsc` é um envelope `EntidadeAssinatura` (estrutura
   observada nos arquivos do simulador e descrita no esquema público de assinatura) com o
   resumo SHA-512 e o tamanho de cada arquivo que lista, assinado com a identidade de teste;
   o catálogo pai assina os filhos. O certificado vai em `InfoChave [1]`. Entradas do catálogo
   original que o simulador não traz (outras seções da zona, arquivos `.ver`) são omitidas e
   listadas em `inputSignatures.omitted`; nada é inventado.
2. **Mídia.** Uma assinatura sobre o JSON canônico da mídia (formato, cenário, configuração,
   arquivos ordenados, geração, relógio, assinaturas dos arquivos e a identidade). Ela é do
   emulador e não existe na urna.

**O VOTA desta versão não verifica as assinaturas dos arquivos de entrada:** um arquivo de
dados alterado depois de assinado inicializa normalmente, e o VOTA não faz nenhuma chamada de
verificação (verificado por experimento). Por isso, na fase oficial, a verificação do emulador
é a única e é estrita: antes de aplicar, todo arquivo precisa estar coberto por um catálogo
com resumo e assinatura válidos, exceto `serialv.dat`, que não tem catálogo na mídia do
simulador. Na mídia do simulador, `t00000br-pu.vsc` é uma cópia de `t02400ac-pu.vsc`, o que
deixava o pacote nacional sem assinatura; ao reassinar, cada catálogo também passa a cobrir os
próprios `.dat` e `.pid`. Uma mídia oficial com arquivo alterado ou sem assinatura é recusada.

Mudar a seção, o eleitorado, os candidatos ou partidos de uma mídia oficial reassina os arquivos com a
identidade em uso. Ao aplicar, a chave e a mídia ficam no `sessionStorage` desta aba para
sobreviver ao reinício; descartar a mídia remove as duas.

## Eleitorado

Cada eleitor da seção (`…-el.dat`) é um registro
`[identificadores, nome, nome social, nascimento, ENUM, ENUM]`. Os identificadores são
`[0]` título e, opcionalmente, `[1]` CPF; com o CPF gravado assim, o VOTA encontra o eleitor
quando o CPF é digitado no terminal (verificado de ponta a ponta, com BU oficial verificado).

- **Título:** 12 dígitos, com dígitos verificadores (módulo 11; em SP e MG, resto 0 vira 1).
  Na tabela, o botão DV corrige os dígitos verificadores; no CSV, um título de 10 dígitos
  recebe os dígitos verificadores automaticamente.
- **CPF:** opcional, 11 dígitos com dígitos verificadores; repetido é recusado.
- **Nascimento:** digitado como DD/MM/AAAA no editor e gravado como AAAAMMDD, o formato
  do arquivo (o mesmo vale para os candidatos).
- **Eleitores fictícios:** nomes e datas inventados, reproduzíveis (semente), títulos válidos
  e não usados; cerca de metade recebe um CPF válido.
- **CSV:** separado por vírgula ou ponto e vírgula, com ou sem cabeçalho (`titulo`, `nome`,
  `nascimento`, `cpf`; o CPF é opcional). Datas em `AAAAMMDD`, `DD/MM/AAAA` ou `AAAA-MM-DD`.

Novos registros copiam o formato do primeiro eleitor do simulador. **Eleitores com biometria
obrigatória não são suportados:** os dois campos enumerados do registro não controlam isso; o
VOTA pede a digital quando o registro tem modelos de digitais, num elemento cujo formato não
foi decodificado.

## Candidatos e partidos

Formato decodificado das mídias do simulador (o mesmo em todos os cenários):

- **`<eleição>-ca.dat`:** `[cabeçalho, [ENUM, [UF, INT]], cargos]`
  - cargo: `[[1] código do cargo, INT, partidos]`
  - partido: `[INT número, candidaturas, SEQUENCE]` (sequência vazia nos cenários)
  - candidatura: `[INT número, titular, UTF8String, suplentes?]`; os suplentes existem
    quando o cargo tem vice ou suplentes
  - pessoa: `[[1] código do candidato, nome, nome na urna, [3] nome fonético?, nascimento,
    ENUM gênero, ENUM situação, INT, [5] ordem do suplente?, BOOLEAN]`
- **`<eleição>-pa.dat`:** partidos `[INT número, sigla, nome]`.
- **`<eleição>-fo.dat`:** fotos `[código do candidato, [ENUM formato (1 = JPEG), OCTET STRING]]`.
- **`<prefixo da eleição><UF>-ce.dat`:** cargos, com o número de dígitos de cada um, os nomes
  masculino e feminino e os suplentes exigidos.

Confirmado com o VOTA: o gênero 4 é feminino e 2 é masculino (decide "Prefeito" ou
"Prefeita", "1º Suplente" ou "2ª Suplente"); a situação 12 é apta; o nome fonético é o que a
voz pronuncia. O código do candidato liga a pessoa à foto e é único na mídia.

O editor regrava os três arquivos de forma consistente. O número do candidato começa com o
número do partido e tem os dígitos do cargo; cargos com vice ou suplentes exigem todos. Ao
remover uma candidatura, a foto sai junto; uma pessoa nova recebe um código livre e uma foto
(escolhida, recortada para 161×225 no titular e 111×155 no vice ou suplente, ou uma foto
genérica). Campos de significado desconhecido são mantidos, e uma pessoa nova copia os valores
de todas as pessoas do simulador. Ler e regravar sem alterações reproduz os arquivos byte a
byte em todos os cenários. Coligações e federações (`-co`, `-fe`) estão vazias em todos os
cenários e não são editáveis; a situação da candidatura não muda.

## Fase e local de votação

**Fase.** Converter para a fase oficial gera a mídia oficial (abaixo); voltar ao treinamento
restaura a mídia de treinamento do cenário. A ponte da versão web aceita `oficial` ou `o`
como fase oficial, e não `of`: o valor `of` do editor é convertido para `oficial` antes de
chegar ao VOTA (literais de comparação nos endereços 157370 e 142797 da função `votaInit`).

**Local.** Município, zona e seção podem ser mudados juntos; a seção é livre e é possível criar
novas zonas. O simulador traz três municípios (1, 2 e 3 — "Minha Cidade" —, cada um com uma zona
de mesmo número), e cada um pode receber outro nome e outro código (1 a 99999, como o código do
TSE de uma cidade real). O VOTA não tem uma tabela de códigos: ao iniciar
(`CConfiguracaoEleicao`), procura o município da seção na configuração por município
(`-cfm.dat`; se faltar: "Configuração do município N não encontrada") e na lista de municípios de
cada eleição (`-ce.dat`, campo 8; se faltar, o VOTA calcula o resumo de um conjunto vazio e falha
com "hash de dados vazios"). Por isso o novo código substitui o antigo nas cinco listas que
declaram os municípios — `-mu`, `-mz`, `-cm`, `-cfm` e cada `-ce` —, mantidas em ordem crescente;
se a seção está no município, ela o acompanha (como em "Mudar o local"). Verificado por
experimento: a mídia renumerada inicia, e a sessão oficial grava um BU que confere. Não foi
testado se o VOTA aceita um quarto município. O local aparece:

- no código de 13 dígitos município(5) zona(4) seção(4) dos arquivos da seção e do local de
  votação, e no código de 9 dígitos município(5) zona(4) dos arquivos da zona e dos `.pid`;
- nos cabeçalhos `[[município, zona], local, seção]` de `-el`, `-imp`, `-tte` e `-lo`;
- na lista de seções da zona (`-se.dat`): `[município, zona]` e cada seção `[seção, ENUM, …]`;
- no local de votação (`-lo.dat`): o registro do município (código, nome) e o do fuso horário,
  copiados de `-mu.dat` e `-cm.dat`;
- nas eleições municipais, nos pacotes de candidatos do município (`<eleição><UF>00001-ca`,
  `-pa`, `-fo`…): nome dos arquivos, cabeçalho `[ENUM, [UF, município]]` e identificador do
  pacote no `.pid` (os pacotes estaduais e nacionais, `00000`, não mudam);
- nos nomes dentro dos catálogos de assinatura.

Mudar o local atualiza todos esses lugares e reassina a mídia oficial. A versão web também
grava uma correspondência fixa (município 1, zona 1, seção 1) nos dados da urna que vão para
o BU; o emulador a ajusta para o local configurado, senão o BU e o RDV discordariam (veja
**Ajuda › Fidelidade e limitações** no emulador). Turno, processo e cargos vêm do cenário, que
pode ser trocado em **Eleição e seção › Eleição** (a mídia é recarregada do começo).

A UF também pode ser trocada (experimental): o editor reescreve a sigla da UF nos nomes dos
arquivos e no conteúdo (`-mu`, `-mz`, `-cm`, `-cp`, `-lo` e os pacotes de candidatos), atualiza
as referências nos `.pid` e nos catálogos de assinatura e reassina a mídia oficial; os eleitores
mantêm o código de origem nos títulos (o VOTA os aceita). Como no caso dos municípios, o VOTA não
valida a UF contra uma tabela interna, então uma UF que o cenário não traz também é aceita.

## Mídia oficial

Pela tela de inicialização, **Sessão oficial** já abre a janela Mídia de carga com a mídia
oficial gerada e assinada: com a identidade em uso, ou com uma identidade salva cujo certificado
cubra o dia da eleição, ou com uma nova, criada automaticamente. Edite eleitorado, candidatos e
local, se quiser, e use **Resumo › Iniciar sessão oficial**.

A partir de uma mídia de treinamento:

1. Escolha ou crie uma identidade em **Identidade**.
2. Edite eleitorado e candidatos, se quiser, e salve.
3. Em **Resumo**, **Preparar e iniciar sessão oficial**: gera, assina e aplica.

A geração:

- converte os caminhos `tNNNNN…` e os nomes de pacotes e catálogos para `oNNNNN…`;
- converte os enumerados de fase nos PID, nos identificadores de pacote SCUE e nos metadados
  `infomidia`;
- alinha o ano da eleição com a data do turno e identifica o processo como "- EMULADOR" (com
  hífen: a fonte da urna não tem o travessão);
- mantém o `serialv.dat`, as fotos e o arquivo de decisões judiciais (`-rdj`);
- regenera os catálogos `.vsc` com a identidade escolhida e assina a mídia, incluindo
  metadados da geração e o relógio (dia da eleição, 08:00);
- registra os resumos SHA-256 de origem, as mudanças e as entradas de catálogo
  indisponíveis.

Não há correção para forçar as verificações de data do VOTA: um relógio depois do horário de
votação leva ao estado original `vota::CHorarioVotacaoTerminou`. A sessão oficial passa pelo
teste de teclado, zerésima, registro de mesários (com leitor biométrico simulado),
identificação por título ou CPF e ano de nascimento, votação, encerramento, BU, retirada da
mídia de resultado e `vota::CAplicacaoEncerrada`. Os arquivos de resultado têm fase 2; totais,
cadeias de resumos e assinaturas são verificados no navegador de arquivos.

## Relógio da sessão

O painel **Relógio da urna** oferece o relógio do computador, um instante fixo ou um relógio
correndo a partir de um instante escolhido, no fuso horário do navegador. O atalho do dia da
eleição lê a data do turno no arquivo do processo (`-cp.dat`); as sessões de treinamento
começam às 07:59, um minuto antes da abertura.

O emulador intercepta três importações do VOTA, sem alterar o binário: `a.aa` (hora local em
segundos, com o fuso), `a.R` (`emscripten_date_now`, milissegundos) e `a.ia` para o relógio 0
(`CLOCK_REALTIME`, nanossegundos). Outros relógios, `performance.now`, o agendamento e as
pausas nativas continuam no tempo real. A hora do terminal segue o mesmo relógio simulado.

O relógio vai na mídia exportada e é aplicado antes de `votaInit`; mudá-lo invalida a
assinatura da mídia (os `.vsc` continuam válidos, porque os arquivos não mudaram). Datas
inconsistentes podem levar o VOTA a recusar a sessão, como na urna. Carimbos de data dos
arquivos em memória e a emissão de certificados usam a hora real do computador.

## Testes

Unitários (`pnpm test:unit`): `tests/unit/load-media.test.mjs` (BER byte a byte,
Windows-1252, chaves, recusa de adulteração e de caminhos inválidos),
`official-load.test.mjs`, `eleitorado.test.mjs`, `candidates.test.mjs`,
`webcrypto-provider.test.mjs`, `native-clock.test.mjs`.

No navegador (Chrome visível): `tests/load-editor-browser.mjs`, `official-load-browser.mjs`,
`official-signatures.mjs`, `official-eleitorado.mjs`, `identity.mjs`, `section-change.mjs`,
`cpf.mjs`, `candidates.mjs`.

## Biometria simulada por eleitor

Em **Eleitorado**, marque **Biometria simulada** para que o VOTA solicite a digital
daquele eleitor na sessão oficial. A opção acompanha o rascunho e a mídia
exportada; no CSV, use a coluna opcional `biometria` com `sim` ou `nao`. No leitor,
escolha **Dedo correto**, **Dedo errado** ou **Tempo esgotado**. O VOTA controla as
tentativas e registra a identificação nos seus próprios contadores e resultados.

A carga contém um marcador exclusivo do emulador, sem digitais reais. O adaptador
substitui a conversão desse marcador e fornece o resultado simulado ao fluxo
nativo. Não implementa derivação CEPESC, descriptografia de cadastros reais ou
comparação biométrica. A captura arquivada é um marcador explícito de teste,
não uma imagem WSQ válida. Veja **Fidelidade e limitações** para os detalhes.
