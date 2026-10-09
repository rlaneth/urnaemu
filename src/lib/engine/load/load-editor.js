// Mídia de carga editor model: the actual VOTA input files of the selected scenario,
// editable as BER, signable with an emulator identity and applied by reloading.
import { VotaLoadFormat as F } from './load-format.js';
import { VotaLoadSignatures } from './load-signature.js';
import { generateOfficialLoad } from './official-load.js';
import { createWebCryptoProvider } from '../services/webcrypto-provider.js';
import { getIdentity, providerFor, activeIdentityId, setActiveIdentity } from './identity-store.js';
import { relocate, places } from './section-relocation.js';
import { renameMunicipio as renameMunicipioFiles, renumberMunicipio as renumberMunicipioFiles, createZona as createZonaFiles, changeUf as changeUfFiles } from './places-edit.js';
import { readEleitorado } from './eleitorado.js';
import { readCandidates, writeCandidates, validateCandidates, nextCode, candidatePhoto, missingPhotos } from './candidates.js';
import { setVoters as writeVoters, fictitiousVoters, parseVotersCsv, votersToCsv, validateVoters } from './eleitorado-generator.js';

export const DRAFT_STORAGE_KEY = 'vota-load-draft-v1';
export const KEY_STORAGE_KEY = 'vota-load-key-v1';
const FIELD_LIMIT = 180;

const CATEGORIES = {
	cp: 'Processo eleitoral',
	ce: 'Cargos / eleição',
	ca: 'Candidatos',
	pa: 'Partidos',
	co: 'Coligações',
	fe: 'Federações',
	fo: 'Fotos de candidatos',
	el: 'Eleitorado',
	se: 'Seções / locais',
	pu: 'Parâmetros / textos de relatório',
	lo: 'Local de votação',
	tte: 'Transferências temporárias de eleitores',
	imp: 'Impedimentos de eleitores'
};

export function category(path) {
	const m = path.match(/-([a-z]+)\.(dat|pid|vsc)$/);
	return CATEGORIES[m?.[1]] || 'Metadados / outros';
}

function fieldLabel(path, berPath, node) {
	const q = berPath.join('/');
	let label = 'Texto';
	if (path.endsWith('-cp.dat'))
		label = { 1: 'Nome do processo', '2/1': 'Rótulo do 1º turno', '2/2': 'Data do 1º turno (AAAAMMDD)', '3/1': 'Rótulo do 2º turno', '3/2': 'Data do 2º turno (AAAAMMDD)' }[q] || label;
	else if (path.endsWith('-ce.dat') && q === '3') label = 'Nome da eleição';
	else if (path.endsWith('-el.dat')) label = node.tag === 18 ? 'Data de nascimento (AAAAMMDD)' : 'Texto do registro do eleitor';
	else if (path.endsWith('-ca.dat')) label = node.tag === 18 ? 'Data de nascimento do candidato' : 'Texto do registro do candidato';
	else if (path.endsWith('-pa.dat')) label = 'Nome / sigla do partido';
	return label;
}

function capture(fs) {
	const out = new Map();
	for (const name of fs.readdir('/dsk/fi/estatico')) {
		if (name === '.' || name === '..') continue;
		const path = '/dsk/fi/estatico/' + name;
		if (fs.isFile(fs.stat(path).mode)) out.set(path, fs.readFile(path).slice());
	}
	out.set('/dsk/fi/serialv.dat', fs.readFile('/dsk/fi/serialv.dat').slice());
	return out;
}

export function createLoadEditor({ app, log, notify }) {
	let files = new Map(), originals = new Map(), scenario, config, dirty = false, signature = null, provider = null, trustedSpki = null, identity = null;
	let inputSignatures = null, draftClock = null, generation = null, revision = 0;
	let status = { code: 'waiting', text: 'Aguardando os arquivos originais do cenário…' };

	function setStatus(code, text) {
		status = { code, text };
		log('load-editor', code);
		revision++;
		notify();
	}
	function changed() {
		dirty = true;
		signature = null;
		revision++;
		setStatus('changed', 'Rascunho alterado. Aplique para reiniciar o emulador com a nova mídia.');
	}
	const allPaths = () => [...files.keys()].sort();

	function fileInfo(path) {
		const bytes = files.get(path);
		if (!bytes) return null;
		const original = originals.get(path);
		return { path, category: category(path), size: bytes.length, unchanged: !!original && F.hex(original) === F.hex(bytes) };
	}
	function list() {
		return allPaths().map((path) => ({ path, name: path.split('/').pop(), category: category(path) }));
	}
	/** Parsed BER tree, or null for opaque binaries. */
	function tree(path) {
		try {
			return F.parse(files.get(path));
		} catch {
			return null;
		}
	}
	/** Editable text fields of a BER file (first 180), addressed by BER child path. */
	function fields(path) {
		const root = tree(path), out = [];
		if (!root) return out;
		(function walk(node, berPath = []) {
			if (node.text !== undefined && out.length < FIELD_LIMIT)
				out.push({ berPath: berPath.join('/'), label: fieldLabel(path, berPath, node), tag: node.tag, text: node.text });
			node.children?.forEach((child, i) => walk(child, [...berPath, i]));
		})(root);
		return out;
	}
	function setField(path, berPath, value) {
		F.textBytes(value);
		const root = F.parse(files.get(path));
		let node = root;
		for (const i of String(berPath).split('/').filter(Boolean)) node = node.children[Number(i)];
		if (node?.text === undefined) throw Error(`Campo BER ${berPath} não é texto`);
		node.text = value;
		files.set(path, F.encode(root));
		changed();
	}
	function treeText(path) {
		const root = tree(path);
		return root ? JSON.stringify(root, null, 2) : null;
	}
	function saveTree(path, text) {
		files.set(path, F.encode(JSON.parse(text)));
		changed();
		setStatus('saved', 'Alterações salvas no rascunho. Aplique para usá-las.');
	}
	function replaceFile(path, bytes) {
		files.set(path, new Uint8Array(bytes));
		changed();
	}
	function readConfig() {
		return { ...config };
	}
	function setConfig(value) {
		config = F.validateConfig(typeof value === 'string' ? JSON.parse(value) : value);
		changed();
	}

	async function packageDraft() {
		const p = {
			format: 'vota-emulator-load/1',
			scenario,
			config,
			description: 'Host load-media archive containing actual VOTA input bytes; not a physical bootable MC image.',
			files: allPaths().map((path) => ({ path, data: F.base64(files.get(path)) }))
		};
		p.clock = draftClock || app.clock.settings;
		if (generation) p.generation = generation;
		if (signature) p.signature = signature;
		if (inputSignatures) p.inputSignatures = inputSignatures;
		return F.validatePackage(p);
	}
	async function importPackage(p) {
		F.validatePackage(p);
		if (p.clock) app.clock.validate(p.clock);
		if (!app.scenarios.some((s) => s.id === p.scenario)) throw Error('Cenário desconhecido nesta mídia');
		const verified = await F.verifyPackage(p, trustedSpki || provider?.spki);
		await VotaLoadSignatures.verifyAll(p);
		if (verified.signed && !verified.valid) throw Error('Assinatura da mídia inválida: importação recusada');
		scenario = p.scenario;
		config = p.config;
		files = new Map(p.files.map((f) => [f.path, F.unbase64(f.data)]));
		signature = p.signature || null;
		inputSignatures = p.inputSignatures || null;
		draftClock = p.clock || null;
		generation = p.generation || null;
		dirty = true;
		setStatus(
			'imported',
			`${files.size} arquivos importados. ${verified.signed ? (verified.trusted ? 'Assinatura válida, da identidade em uso.' : `Assinatura válida, mas de outra identidade (SHA-256 da chave: ${verified.fingerprint.slice(0, 16)}…).`) : 'Mídia sem assinatura.'} Aplique para usá-la.`
		);
		return verified;
	}
	/** Low-level: use a raw key (JWK) with a certificate (stored DER, or built with default fields). */
	async function useKey(jwk, certificate = null) {
		provider = await createWebCryptoProvider({ profile: jwk?.crv === 'Ed25519' ? 'Ed25519' : 'P-521', privateJwk: jwk || null, certificate });
		await provider.selfTest();
		app.loadSigningProvider = provider;
		identity = null;
		setStatus('key-selected', `Chave de teste ${provider.algorithm} em uso.`);
		return provider;
	}
	/** Use a stored test identity (identity-store.js): its key and its stored certificate. */
	async function useIdentity(record) {
		if (typeof record === 'string') record = await getIdentity(record);
		if (!record) throw Error('Identidade não encontrada');
		provider = await providerFor(record);
		await provider.selfTest();
		app.loadSigningProvider = provider;
		identity = { id: record.id, name: record.name };
		setActiveIdentity(record.id);
		setStatus('key-selected', `Identidade "${record.name}" em uso.`);
		return provider;
	}
	/** Stop using the current identity/key (e.g. after it is deleted). */
	function clearIdentity() {
		provider = null;
		identity = null;
		app.loadSigningProvider = null;
		setActiveIdentity(null);
		setStatus('key-cleared', 'Nenhuma identidade em uso.');
	}
	// Why "apply" cannot run yet, as a reason to show the user, or null when it can. Cheap and
	// synchronous (for disabling the button); stage() still re-checks and throws on apply.
	function applyBlock() {
		if (!config) return 'Nenhuma mídia carregada.';
		if (config.fase === 'of') {
			if (!provider) return 'Escolha uma identidade para assinar a mídia oficial antes de aplicá-la.';
			const sentinel = `/dsk/fi/estatico/o${String(config.pe).padStart(5, '0')}${config.uf.toLowerCase()}-pu.dat`;
			if (!files.has(sentinel)) return 'A mídia oficial ainda não foi gerada. Use "Converter para a fase oficial" ou "Preparar sessão oficial".';
			if (![...files.keys()].some((k) => k.endsWith('.vsc'))) return 'A mídia oficial ainda não foi assinada. Assine os arquivos em Assinatura digital ou use "Preparar sessão oficial".';
		}
		return null;
	}
	async function stage() {
		const p = await packageDraft();
		const v = await F.verifyPackage(p, trustedSpki || provider?.spki);
		await VotaLoadSignatures.verifyAll(p);
		if (v.signed && !v.valid) throw Error('A assinatura da mídia não confere: a mídia não pode ser aplicada');
		// This VOTA build does not check input signatures itself (verified by experiment): for
		// official media the emulator's check is the only one, so it must be complete.
		if (p.config.fase === 'of') {
			if (!p.inputSignatures) throw Error('Mídia oficial sem assinaturas dos arquivos (.vsc): gere-a com "Preparar sessão oficial" ou assine os arquivos em Assinatura digital.');
			const missing = VotaLoadSignatures.uncovered(p);
			if (missing.length) throw Error(`Mídia oficial com ${missing.length} arquivo(s) sem assinatura (.vsc): ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}. Assine os arquivos em Assinatura digital.`);
		}
		const sentinel = `/dsk/fi/estatico/${config.fase === 'of' ? 'o' : 't'}${String(config.pe).padStart(5, '0')}${config.uf.toLowerCase()}-pu.dat`;
		if (!files.has(sentinel))
			throw Error('Falta o pacote da fase e do processo: ' + sentinel + '. Mudar só a fase não gera os arquivos da outra fase; use Eleição e seção › Converter para a fase oficial.');
		if (provider && new URLSearchParams(location.search).get('fullSession') === '1' && provider.algorithm !== 'P-521') throw Error('A sessão completa assina com ECDSA P-521: use uma identidade de teste');
		if (p.clock) app.clock.configure(p.clock);
		sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(p));
		// The session signs with the same key and the same certificate.
		if (provider) sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify({ jwk: await provider.exportPrivateJwk(), certificate: F.base64(provider.certificate), identity }));
		else sessionStorage.removeItem(KEY_STORAGE_KEY);
		const q = new URLSearchParams(location.search);
		q.set('scenario', scenario);
		q.set('loadDraft', '1');
		// Start-screen follow-ups already happened: do not repeat them after the restart.
		for (const k of ['start', 'voters', 'clock']) q.delete(k);
		if (generation?.profile === 'vota-official-emulator/1') for (const k of ['fullSession', 'testgap', 'testkey', 'persist', 'crypto']) q.set(k, '1');
		if (provider) q.set('crypto', '1');
		q.delete('session');
		location.search = q;
	}
	async function generateOfficial() {
		// Never create an identity silently: the media is signed by the identity the user chose.
		if (!provider) throw Error('Escolha ou crie uma identidade de teste antes de gerar a mídia oficial (Mídia de carga › Identidade).');
		const p = await generateOfficialLoad(await packageDraft(), provider);
		await importPackage(p);
		setStatus(
			'official-generated',
			`Mídia oficial gerada e assinada (${p.files.length} arquivos), com o relógio no dia da eleição às 08:00. ${p.inputSignatures.omitted.length} referências do catálogo original a arquivos que o simulador não traz foram omitidas (a lista vai na exportação). Aplique para iniciar a sessão.`
		);
		return p;
	}
	async function exportKey() {
		if (!provider) throw Error('Escolha ou crie uma identidade de teste primeiro');
		const jwk = await provider.exportPrivateJwk();
		setStatus('key-exported', 'Chave privada exportada (ela nunca vai junto com a mídia).');
		return jwk;
	}
	function certificate() {
		if (!provider) throw Error('Escolha ou crie uma identidade de teste primeiro');
		return provider.certificate;
	}
	/** Pin a public identity (JWK, SPKI or X.509, DER or PEM) as trusted for verification. */
	async function trustPublicKey(bytes) {
		bytes = new Uint8Array(bytes);
		let spki;
		const text = new TextDecoder().decode(bytes);
		if (text.trim().startsWith('{')) {
			const jwk = JSON.parse(text);
			if (jwk.d) throw Error('Para confiar em alguém, escolha a chave pública ou o certificado, não a chave privada');
			const alg = jwk.crv === 'P-521' ? { name: 'ECDSA', namedCurve: 'P-521' } : { name: 'Ed25519' };
			const key = await crypto.subtle.importKey('jwk', jwk, alg, true, ['verify']);
			spki = new Uint8Array(await crypto.subtle.exportKey('spki', key));
		} else {
			let der = bytes;
			if (text.includes('-----BEGIN')) der = F.unbase64(text.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
			const n = F.parse(der);
			if (n.tag !== 48) throw Error('Esperado um certificado X.509 ou uma chave pública (SPKI)');
			if (n.children.length === 3 && n.children[0].tag === 48) {
				const tbs = n.children[0].children;
				spki = F.encode(tbs[tbs[0].tag === 160 ? 6 : 5]);
			} else spki = der;
		}
		trustedSpki = spki;
		setStatus('trust-pinned', `Chave pública marcada como confiável (SHA-256 ${(await F.digest(spki)).slice(0, 16)}…). Nenhuma cadeia de certificados é verificada.`);
		return spki;
	}
	/** Official media: re-sign the input files (.vsc) after a change, with the identity in use. */
	async function resignIfOfficial() {
		if (config.fase !== 'of') return false;
		if (!provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		const signed = await VotaLoadSignatures.resign(files, provider);
		files = signed.files;
		inputSignatures = { profile: 'emulator-p521-entity/1', paths: signed.paths, omitted: signed.omitted };
		return true;
	}
	/**
	 * Move the media to another município, zona and/or seção of the same UF
	 * (section-relocation.js). Official media is re-signed.
	 */
	async function changeLocation(target) {
		const result = relocate(files, config, target);
		if (!result.changes.length) return result;
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		files = result.files;
		const next = { ...config, ...Object.fromEntries(Object.entries(target).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Number(v)])) };
		config = next;
		signature = null;
		await resignIfOfficial();
		changed();
		const name = places(files).find((p) => p.municipio === config.municipio)?.nome;
		setStatus('section-changed', `Mídia movida para o município ${config.municipio}${name ? ` (${name})` : ''}, zona ${config.zona}, seção ${config.secao}: ${result.changes.length} alterações em nomes e conteúdos${config.fase === 'of' ? ', arquivos reassinados' : ''}. Aplique para reiniciar no novo local.`);
		return result;
	}
	/** Only the seção (same município and zona). */
	const changeSection = (secao) => changeLocation({ secao: Number(secao) });
	// Editing the places the media declares (places-edit.js). The current section's place does not
	// change here — use changeLocation to move into a newly created município/zona. Official media
	// is re-signed (no files are added, so the catalogs stay complete).
	async function editPlaces(apply, done) {
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		const result = apply(files);
		if (!result.changes.length) return result;
		files = result.files;
		signature = null;
		await resignIfOfficial();
		changed();
		setStatus('places-changed', done(result) + (config.fase === 'of' ? ' Arquivos reassinados.' : '') + ' Aplique para usar o novo local.');
		return result;
	}
	const renameMunicipio = (municipio, nome) =>
		editPlaces((f) => renameMunicipioFiles(f, Number(municipio), nome), () => `Município ${Number(municipio)} renomeado para "${String(nome).trim()}".`);
	// Another código for a declared município (places-edit.js); the section moves with it.
	async function renumberMunicipio(municipio, codigo) {
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		const result = renumberMunicipioFiles(files, config, municipio, codigo);
		if (!result.changes.length) return result;
		files = result.files;
		config = result.config;
		signature = null;
		await resignIfOfficial();
		changed();
		setStatus('places-changed', `O município ${Number(municipio)} agora tem o código ${Number(codigo)}.${config.fase === 'of' ? ' Arquivos reassinados.' : ''} Aplique para usar o novo local.`);
		return result;
	}
	const createZona = (municipio, zona) =>
		editPlaces((f) => createZonaFiles(f, Number(municipio), Number(zona)), () => `Zona ${Number(zona)} adicionada ao município ${Number(municipio)}.`);
	// Change the media's UF (places-edit.js). Experimental; official media is re-signed.
	async function changeUf(newUf) {
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		const result = changeUfFiles(files, config, newUf);
		if (!result.changes.length) return result;
		files = result.files;
		config = result.config;
		signature = null;
		await resignIfOfficial();
		changed();
		setStatus('uf-changed', `UF alterada para ${String(newUf).toUpperCase()}.`);
		return result;
	}
	async function signInputs() {
		if (!provider) throw Error('Escolha ou crie uma identidade de teste primeiro');
		const result = await VotaLoadSignatures.resign(files, provider);
		files = result.files;
		inputSignatures = { profile: 'emulator-p521-entity/1', paths: result.paths, omitted: result.omitted };
		changed();
		setStatus(
			'inputs-signed',
			`${result.paths.length} assinaturas de arquivos (.vsc) geradas com a identidade em uso. ${result.omitted.length} referências a arquivos que o simulador não traz foram omitidas.`
		);
		return result;
	}
	async function sign() {
		if (!provider) throw Error('Escolha ou crie uma identidade de teste primeiro');
		await VotaLoadSignatures.verifyAll(await packageDraft());
		const p = await F.signPackage(await packageDraft(), provider);
		signature = p.signature;
		const verified = await F.verifyPackage(p, provider.spki);
		setStatus('signed', verified.valid ? 'Mídia assinada com a identidade em uso: arquivos, configuração e relógio estão cobertos.' : 'A assinatura recém-criada não conferiu.');
		return verified;
	}
	async function verify() {
		const result = await F.verifyPackage(await packageDraft(), trustedSpki || provider?.spki);
		setStatus('verified', !result.signed ? 'A mídia não está assinada.' : !result.valid ? 'A assinatura da mídia NÃO confere: algum dado mudou depois de assinado.' : result.trusted ? 'Assinatura válida, da identidade em uso ou marcada como confiável.' : `Assinatura válida, mas de uma identidade que não está em uso nem marcada como confiável (SHA-256 da chave: ${result.fingerprint.slice(0, 16)}…).`);
		return result;
	}
	async function exportPackage() {
		const p = await packageDraft();
		setStatus('exported', `${p.files.length} arquivos de entrada, configuração e ${p.signature ? 'assinatura da mídia' : 'nenhuma assinatura de mídia'} exportados. Nenhuma chave privada incluída.`);
		return p;
	}
	/** Discard the staged media and key, then reload with the bundled scenario. */
	function reset() {
		sessionStorage.removeItem(DRAFT_STORAGE_KEY);
		sessionStorage.removeItem(KEY_STORAGE_KEY);
		const q = new URLSearchParams(location.search);
		q.delete('loadDraft');
		q.delete('session');
		location.search = q;
	}
	/** Discard this media and reload with another bundled scenario (official setup stays open). */
	function switchScenario(id, { official = false } = {}) {
		if (!app.scenarios.some((s) => s.id === id)) throw Error('Cenário desconhecido');
		sessionStorage.removeItem(DRAFT_STORAGE_KEY);
		sessionStorage.removeItem(KEY_STORAGE_KEY);
		const q = new URLSearchParams(location.search);
		q.set('scenario', id);
		q.delete('loadDraft');
		q.delete('session');
		if (official) q.set('start', 'official');
		location.search = q;
	}
	function paramsDraft() {
		return new URLSearchParams(location.search).get('loadDraft') === '1' ? sessionStorage.getItem(DRAFT_STORAGE_KEY) : null;
	}

	// ---- Eleitorado (-el.dat) ----
	const eleitoradoPath = () => allPaths().find((p) => p.endsWith('-el.dat'));
	function voters() {
		return readEleitorado(files);
	}
	async function setVoters(list) {
		const path = eleitoradoPath();
		if (!path) throw Error('Esta mídia não tem arquivo de eleitorado');
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		files.set(path, writeVoters(files.get(path), list));
		const resigned = await resignIfOfficial();
		changed();
		setStatus('voters-saved', `Eleitorado salvo no rascunho: ${list.length} eleitor(es)${resigned ? ', arquivos oficiais reassinados' : ''}. Aplique para usá-lo; na fase oficial, só esses eleitores votam.`);
	}
	function generateVoters(count, seed = Date.now() % 100000) {
		const current = voters();
		const electionYear = new Date(app.clock.now()).getFullYear();
		return fictitiousVoters({ count, seed, uf: current[0]?.title.slice(8, 10) ?? '00', existing: current.map((v) => v.title), electionYear });
	}

	// ---- Candidatos e partidos (-ca, -pa, -fo; candidates.js) ----
	function candidates() {
		return readCandidates(files);
	}
	/** Write the edited model; `photos` maps candidate codes to JPEG bytes (new or replaced photos). */
	async function setCandidates(model, photos = new Map()) {
		photos = new Map(photos);
		// New people without a chosen photo get a neutral placeholder (candidate-photo.js).
		const missing = missingPhotos(files, model, photos);
		if (missing.length) {
			const { placeholderPhoto } = await import('./candidate-photo.js');
			for (const m of missing) photos.set(m.code, await placeholderPhoto(m.nome, m.role));
		}
		const next = writeCandidates(files, model, photos);
		if (config.fase === 'of' && !provider) throw Error('Escolha uma identidade para reassinar a mídia oficial.');
		files = next;
		const resigned = await resignIfOfficial();
		changed();
		setStatus('candidates-saved', `Candidatos e partidos salvos no rascunho${resigned ? ', arquivos oficiais reassinados' : ''}. Aplique para usá-los.`);
	}

	return {
		category,
		list,
		candidates,
		setCandidates,
		validateCandidates,
		nextCandidateCode: (model, taken) => nextCode(model, taken),
		candidatePhoto: (caPath, code) => candidatePhoto(files, caPath, code),
		voters,
		setVoters,
		generateVoters,
		validateVoters,
		parseVotersCsv,
		votersCsv: (list) => votersToCsv(list ?? voters()),
		fileInfo,
		tree,
		fields,
		setField,
		treeText,
		saveTree,
		replaceFile,
		readConfig,
		setConfig,
		packageDraft,
		importPackage,
		useKey,
		useIdentity,
		clearIdentity,
		applyBlock,
		changeSection,
		changeLocation,
		renameMunicipio,
		renumberMunicipio,
		createZona,
		changeUf,
		places: () => places(files),
		get identity() {
			return identity;
		},
		stage,
		apply: stage,
		generateOfficial,
		exportKey,
		certificate,
		trustPublicKey,
		signInputs,
		sign,
		verify,
		exportPackage,
		reset,
		switchScenario,
		clockChanged() {
			draftClock = null;
			changed();
		},
		get files() {
			return files;
		},
		get provider() {
			return provider;
		},
		get status() {
			return status;
		},
		get dirty() {
			return dirty;
		},
		get signed() {
			return !!signature;
		},
		get trusted() {
			return !!trustedSpki;
		},
		get revision() {
			return revision;
		},
		async bootstrap(s, c) {
			scenario = s.id;
			config = c;
			originals = capture(Module.FS);
			files = new Map(originals);
			const saved = paramsDraft();
			if (saved) {
				const p = F.validatePackage(JSON.parse(saved));
				if (p.scenario !== s.id) throw Error('A mídia aplicada é de outro cenário');
				const check = await F.verifyPackage(p);
				await VotaLoadSignatures.verifyAll(p);
				if (check.signed && !check.valid) throw Error('A assinatura da mídia aplicada não confere');
				files = new Map(p.files.map((f) => [f.path, F.unbase64(f.data)]));
				config = p.config;
				signature = p.signature || null;
				inputSignatures = p.inputSignatures || null;
				draftClock = p.clock || null;
				generation = p.generation || null;
				app.loadGeneration = generation;
				if (p.clock) app.clock.configure(p.clock);
				const fs = Module.FS;
				for (const path of originals.keys()) if (!files.has(path)) fs.unlink(path);
				for (const [path, bytes] of files) fs.writeFile(path, bytes);
				const key = JSON.parse(sessionStorage.getItem(KEY_STORAGE_KEY) || 'null');
				if (key?.jwk) {
					await useKey(key.jwk, F.unbase64(key.certificate));
					identity = key.identity ?? null;
				} else if (key) await useKey(key);
				setStatus('staged', `${files.size} arquivos da mídia gravados no sistema de arquivos do emulador. ${check.signed ? 'Assinatura da mídia conferida.' : 'Mídia sem assinatura.'} Aguardando o VOTA iniciar.`);
			}
			// The identity chosen last stays selected across visits (never created implicitly).
			if (!provider && activeIdentityId()) await useIdentity(activeIdentityId()).catch(() => setActiveIdentity(null));
			revision++;
			notify();
			return config;
		},
		nativeResult(ok, error) {
			if (ok) setStatus('accepted', `O VOTA iniciou com os ${files.size} arquivos desta mídia.${dirty ? ' Há alterações no rascunho ainda não aplicadas.' : ''}`);
			else setStatus('rejected', 'O VOTA recusou a mídia de carga ao iniciar: ' + error);
		}
	};
}
