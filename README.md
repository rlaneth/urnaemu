# UrnaEmu

> ## ⚠️ Aviso sobre os componentes do TSE
>
> Este repositório inclui e redistribui, **sem alterações**, componentes do Simulador de Votação
> do TSE (o aplicativo **VOTA** compilado para WebAssembly, a voz sintetizada, as fontes e os
> dados dos cenários). Esses componentes pertencem ao TSE. O UrnaEmu **não tem vínculo com o TSE
> nem endosso oficial**, e a inclusão desses arquivos aqui **não implica qualquer autorização**.
> Estes componentes poderão ser retirados do ar mediante solicitação do TSE ou de outra
> autoridade competente — para solicitar, basta entrar em contato pelas
> [issues do GitHub](https://github.com/rlaneth/urnaemu/issues).
>
> ## ⚠️ Notice about TSE components
>
> This repository includes and redistributes, **unmodified**, components of the TSE's Voting
> Simulator (the **VOTA** application compiled to WebAssembly, the synthesized voice, the fonts,
> and the scenario data). These components belong to the TSE. UrnaEmu is **not affiliated with or
> endorsed by the TSE**, and their inclusion here **does not imply any authorization**. These
> components may be taken down upon request by the TSE or another competent authority — to request
> this, simply get in touch via [GitHub issues](https://github.com/rlaneth/urnaemu/issues).

UrnaEmu runs the Brazilian electronic voting machine's voting application — **VOTA**, in the
WebAssembly build the TSE publishes in its Voting Simulator (Simulador de Votação) — in the
browser, and reconstructs around it everything the web build lacks: the poll worker's terminal,
the printer, the clock, power, the biometric reader, the load and result media, and the
signatures. The result is a full election day: opening with the keyboard self-test and the
zerésima, poll-worker registration, voter identification, voting, closing, the vote-tally report
(Boletim de Urna, BU), the Digital Vote Record (Registro Digital do Voto, RDV), and signed,
verifiable result files.

> **Disclaimer.** UrnaEmu sets out to show, in a neutral and verifiable way, how the voting
> machine works on the inside — out of technical curiosity. Nothing here constitutes an allegation
> of electoral fraud: any discrepancy you observe should first be investigated as a possible fault
> of the emulator itself or of how it is used — it is an emulator, and a failure during use most
> likely comes from it, not from VOTA, except where documented otherwise (such as the
> justification defect). It is an independent project, with no link to the TSE or the Electoral
> Justice (Justiça Eleitoral); the files it generates are not authentic election results, and the
> test identities are not Electoral Justice credentials.

An open-source project by **Rodrigo Laneth** (<https://eleicoes.rlaneth.com>). Repository:
<https://github.com/rlaneth/urnaemu>. UrnaEmu's own code is in the public domain (The Unlicense);
third-party components keep their own licenses — see [License](#license) and **Ajuda › Licenças**
(Help › Licenses) in the emulator.

What VOTA does versus what the emulator does, the fixes applied to the binary, and the known
limitations are described in detail in **Ajuda › Fidelidade e limitações** in the emulator (its
source is `src/lib/fidelidade.js`). The load media is documented in [LOAD-MEDIA.md](LOAD-MEDIA.md).

## Requirements

- A recent Chromium-based browser (Chrome, Edge) with **JSPI** (WebAssembly JavaScript Promise
  Integration): VOTA awaits the paper, the clock, and the signatures without freezing the page.
  Without JSPI, full sessions do not work (the signature adapter, for instance, stops with the
  error "Native crypto adapter requires JSPI").
- For development: Node.js 22 or newer, pnpm, and Python 3 (for the checks).
- A physical thermal printer (optional): ESC/POS over a serial port, via Web Serial.

## Running it

```sh
pnpm install
pnpm build
python3 -m http.server 8766 --bind 127.0.0.1 --directory build
```

Open http://127.0.0.1:8766/urnaemu/. The app is served under the `/urnaemu/` base path (it is
deployed at <https://eleicoes.rlaneth.com/urnaemu/>), so the build is nested under `build/urnaemu/`
— serve `build/` and the app is at `/urnaemu/`. It must be served over HTTP; opening the file
directly does not work. During development, `pnpm dev` serves at http://127.0.0.1:8766/urnaemu/
with hot reload.

## Deployment

The app is a static site deployed as a dedicated Cloudflare Worker (Static Assets) routed at
`eleicoes.rlaneth.com/urnaemu/*` (see `wrangler.jsonc`). With a Cloudflare account and
[Wrangler](https://developers.cloudflare.com/workers/wrangler/) authenticated:

```sh
pnpm deploy        # vite build && wrangler deploy
```

The base path is set in `vite.config.js` (`paths.base`), and the build is emitted to
`build/urnaemu/` so the files sit at the same paths the `/urnaemu/` URLs use.

On the start screen, choose how to begin:

- **Sessão de treinamento** (training session): the machine and the poll worker's terminal, with
  the scenario's training media (anyone can vote). The clock starts at 07:59 on election day.
- **Sessão oficial** (official session): opens the scenario in the Mídia de carga (load media)
  window, where you pick the test identity, edit the electorate and the candidates, and prepare
  the session: signed official-phase media, poll-worker registration, voter identification, and
  signed results.
- **Só a votação** (voting only): just the voter's screen, as in the TSE's Voting Simulator.
- **Abrir mídia de carga** (open load media): start from media exported earlier by UrnaEmu.

The scenarios are those of the TSE's Voting Simulator: general elections (1st and 2nd rounds,
with the DF and overseas variants) and municipal elections (1st and 2nd rounds).

### VOTA files

UrnaEmu bundles a copy of the Voting Simulator files (`static/vendor/`), verified byte for byte
against the reference snapshot by `tests/verify_vendor.py`, and uses only that copy: VOTA
10.23.0.1, SHA-256 `8579ef8d1a93819152cecdbf52906d2e4dd0f57999cb2e1e8c0d1161cd1007e2`, the version
the in-memory fixes were written for. The fixes are applied only if the binary is exactly that
one.

## What you can do

- **Voting machine and poll worker's terminal** with independent keyboards: each device's keys
  reach only it, and the emulator blocks no key — VOTA decides what to accept. The computer
  keyboard works too (0–9, Enter = CONFIRMA, Esc = CORRIGE, Space = BRANCO).
- **Explanation** of each step of election day, following along with the session.
- **Guided tours** (Ajuda): opening the section, a voter casting a ballot, closing and the BU,
  each with a "Fazer por mim" (do it for me) option on every step.
- **Load media**: test identity, electorate (voter ID, CPF, date of birth), candidates and
  parties (with photos), phase and polling place (município, zona, seção), signatures. See
  [LOAD-MEDIA.md](LOAD-MEDIA.md).
- **Printer**: a simulated paper roll with adjustable speed, or a real ESC/POS printer.
- **Clock, power, and biometric reader**, simulated.
- **Automatic voting**: many voters casting ballots automatically, with the expected tally to
  compare against the BU.
- **File browser**: the files VOTA reads and writes; in the official phase, the BU and RDV decoded
  and verified (hash chain, totals, signatures); logs opened.
- **Session snapshots** (Sessão): save, resume (via VOTA's own restart of the vote), start over
  with the same configuration, or examine read-only.
- **Windows** (Painéis): Explicação, Dados da votação, Votação automática, printer, clock, and
  files, each in its own window.
- **Developer** (Ferramentas, Ctrl+Shift+D): host logs and native diagnostics, state, memory, and
  the terminal text.

## Project layout

```
src/lib/engine/          engine (no UI)
  controller.js          startup, bridge to VOTA, window.urnaEmu API
  runtime/               native execution (JSPI), in-memory fixes, key router
  session/               full session: operator thread, timers, phases,
                         procedures ("Fazer por mim"), keyboard driver
  devices/               terminal, clock, power, printer, ESC/POS, serial port
  services/              native adapters (signature, biometrics, power, RDV, paper…)
  load/                  load media: BER format, signatures, official media,
                         identities, electorate, candidates, section
  simulator/             automatic voting
  snapshot.js            session snapshots
src/lib/results/         decoding and verification of BU, RDV and signatures (public ASN.1)
src/lib/components/      UI (Svelte 5)
src/lib/tours/           guided tours
src/lib/fidelidade.js    what is VOTA and what is the emulator (Fidelidade e limitações)
static/vendor/           Voting Simulator files (verified copy, never edited)
tests/unit/              Node tests
tests/*.mjs              browser tests (visible Chrome, via CDP)
tools/                   browser QA, ASN.1 reader, OG image
tests/fixtures/          vendored scenario bases and a real-urna capture (test data)
```

`window.urnaEmu` exposes the API used by the tests and by the Developer window (`readState`,
`submitKey`, `tick`, `loadEditor`, `procedures`, `simulator`, `createSnapshot`, `verifyResults`,
and so on).

## Tests

```sh
pnpm check          # svelte-check
pnpm test           # Node tests, VOTA file verification, and the schema reader
```

The browser tests use an **already-open, visible** Chrome with remote debugging and a UrnaEmu
tab; they never launch a browser:

```sh
google-chrome --user-data-dir=/tmp/urnaemu-chrome --remote-debugging-port=9224 http://127.0.0.1:8766/urnaemu/
node tests/smoke.mjs
node tests/candidates.mjs
node tests/snapshot.mjs
CDP_PORT=9224 node tools/qa-stress.mjs --scenarios municipal-t1,geral-t1
```

`CDP_PORT` (default 9224) and `EMULATOR_URL` (default http://127.0.0.1:8766/urnaemu/) change the
addresses. Each `tests/*.mjs` file starts with a comment stating what it verifies. Evidence
(screenshots, result files) goes to the system temp directory (`urnaemu-evidence`), never into
the project. The scenario files the unit tests decode are vendored in `tests/fixtures/`.

## License

UrnaEmu's own code is in the **public domain**, under [The Unlicense](LICENSE).

That dedication covers only UrnaEmu's own code. Third-party components keep their own licenses:

- **VOTA and Voting Simulator data** (in `static/vendor/`: the VOTA WebAssembly application, the
  synthesized voice, the fonts, and the scenario data) come from the **TSE** and are redistributed
  unmodified. They belong to the TSE; their inclusion here does not imply any authorization, and
  they may be taken down upon request by the TSE or another competent authority — to request this,
  get in touch via [GitHub issues](https://github.com/rlaneth/urnaemu/issues). See the notice at
  the top of this file.
- **Fonts** Inter, Manrope, Source Serif 4, and Atkinson Hyperlegible: SIL Open Font License 1.1.
- **"Vote" icon** (logo and favicon): [Lucide](https://lucide.dev), ISC License.
- **Build libraries** (Svelte, SvelteKit, Vite, bits-ui): MIT License.

Details are in [LICENSE](LICENSE) and in **Ajuda › Licenças** in the emulator.
