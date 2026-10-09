// Decode and verify a section's result files (BU, RDV and, when present, the vota.vsc
// signature catalog). Port of the former tools/verify-vote-results.py (in git history),
// reporting each check instead of stopping at the first failure so the interface can show
// everything that passed or failed.
import { VotaLoadFormat as F } from '../engine/load/load-format.js';

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const equalBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const choice = (v) => Object.values(v)[0];
const pad = (v, n, c = '0') => String(v).padStart(n, c);
const sha512 = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(text)));
// RDV and BU use different vote-type enums; suspended/repeated nulls aggregate.
const RDV_TO_BU = { 1: 4, 2: 1, 3: 2, 4: 3, 5: 2, 6: 3, 7: 3, 8: 5, 9: 5 };

/** DER ECDSA-Sig-Value → raw r||s of the given component size (WebCrypto format). */
function derToRaw(der, size) {
	const node = F.parse(der);
	if (node.tag !== 48 || node.children?.length !== 2) throw Error('Invalid ECDSA signature');
	return Uint8Array.from(
		node.children.flatMap((c) => {
			let b = Array.from(F.unhex(c.hex));
			while (b.length > size && b[0] === 0) b.shift();
			return [...Array(size - b.length).fill(0), ...b];
		})
	);
}
/** SubjectPublicKeyInfo of an X.509 certificate (DER). */
function certificateSpki(der) {
	const tbs = F.parse(der).children[0].children;
	return F.encode(tbs[tbs[0].tag === 160 ? 6 : 5]);
}

export function findResultFiles(names) {
	const pick = (suffix) => names.find((n) => n.endsWith(suffix)) ?? null;
	return { bu: pick('-bu.dat'), rdv: pick('-rdv.dat'), vsc: pick('-vota.vsc'), log: pick('-log.jez') };
}

/**
 * @param {Record<string, Uint8Array>} files result files by name
 * @param {{bu: import('./asn1-schema.js').Schema, rdv: import('./asn1-schema.js').Schema, assinatura: import('./asn1-schema.js').Schema}} schemas
 */
export async function verifyResults(files, schemas) {
	const names = findResultFiles(Object.keys(files));
	const checks = [];
	const check = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
	if (!names.bu || !names.rdv) throw Error('BU and RDV files are required');

	const envelope = schemas.bu.decode('EntidadeEnvelopeGenerico', files[names.bu]);
	const bu = schemas.bu.decode('EntidadeBoletimUrna', envelope.conteudo);
	const rdvEntity = schemas.rdv.decode('EntidadeResultadoRDV', files[names.rdv]);
	const rdv = rdvEntity.rdv;
	check('schema', true, 'BU, RDV e envelope conferem com os esquemas publicados (campos, tipos e restrições).');
	check('phase', envelope.fase === bu.fase && bu.fase === rdv.fase, `fase ${bu.fase}`);
	check('pleito', bu.cabecalho.idEleitoral?.idPleito === rdv.pleito && rdvEntity.cabecalho.idEleitoral?.idPleito === rdv.pleito, `pleito ${rdv.pleito}`);
	check('section', JSON.stringify(bu.identificacaoSecao) === JSON.stringify(rdv.identificacao) && JSON.stringify(rdv.identificacao) === JSON.stringify(choice(envelope.identificacao)));
	const plain = (x) => JSON.stringify(x, (_, v) => (v instanceof Uint8Array ? hex(v) : typeof v === 'bigint' ? String(v) : v));
	const buUrna = plain(bu.urna), rdvUrna = plain(rdvEntity.urna);
	check('urna', buUrna === rdvUrna, buUrna === rdvUrna ? undefined : `BU ${buUrna} · RDV ${rdvUrna}`);

	let publicKey = null, signature = null;
	if (names.vsc) {
		try {
			signature = schemas.assinatura.decode('EntidadeAssinaturaEcourna', files[names.vsc]);
			const spki = certificateSpki(signature.assinaturaHW.informacaoChave.certificadoDigital);
			publicKey = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-521' }, false, ['verify']);
		} catch (error) {
			check('certificate', false, String(error.message ?? error));
		}
	}

	const rdvElections = new Map(rdv.eleicoes.eleicoesVota.map((e) => [e.idEleicao, e]));
	const elections = [];
	for (const election of bu.resultadosVotacaoPorEleicao) {
		const id = election.idEleicao;
		const section = choice(bu.urna.correspondenciaResultado.identificacao), mz = section.municipioZona;
		const load = bu.urna.correspondenciaResultado.carga.codigoCarga;
		let digest = await sha512(`${pad(rdv.pleito, 5)}|${pad(id, 5)}|${pad(mz.municipio, 5)}|${pad(mz.zona, 4)}|${pad(section.secao, 4)}|${pad(load, 24, ' ')}`);
		const totals = new Map(), offices = [];
		let blocks = 0, chainOk = true;
		for (const group of election.resultadosVotacao)
			for (const office of group.totaisVotosCargo) {
				const code = choice(office.codigoCargo), counts = {}, votes = [];
				for (const [i, vote] of office.votosVotaveis.entries()) {
					if (vote.ordemGeracaoHash !== i + 1) chainOk = false;
					const parts = [hex(digest).toUpperCase(), i + 1, code, vote.tipoVoto, vote.quantidadeVotos];
					if (vote.identificacaoVotavel) parts.push(vote.identificacaoVotavel.codigo, vote.identificacaoVotavel.partido);
					digest = await sha512(parts.join('|'));
					if (!equalBytes(digest, vote.hash)) chainOk = false;
					blocks++;
					counts[vote.tipoVoto] = (counts[vote.tipoVoto] ?? 0) + vote.quantidadeVotos;
					votes.push({ tipo: vote.tipoVoto, quantidade: vote.quantidadeVotos, codigo: vote.identificacaoVotavel?.codigo ?? null, partido: vote.identificacaoVotavel?.partido ?? null });
				}
				totals.set(code, counts);
				offices.push({ code, cargo: office.codigoCargo, votes, apurados: office.qtdComparecimentoCargoSemCandidatos ?? null });
			}
		const finalOk = equalBytes(digest, election.ultimoHashVotosVotavel);
		let signatureOk = null;
		if (publicKey && election.assinaturaUltimoHashVotosVotavel) {
			try {
				signatureOk = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-512' }, publicKey, derToRaw(election.assinaturaUltimoHashVotosVotavel, 66), digest);
			} catch {
				signatureOk = false;
			}
		}
		check(`chain:${id}`, chainOk, `${blocks} blocos de votos`);
		check(`final:${id}`, finalOk);
		if (signatureOk !== null) check(`signature:${id}`, signatureOk);

		const rdvOffices = [];
		for (const office of rdvElections.get(id)?.votosCargos ?? []) {
			const code = choice(office.idCargo), votes = office.votos;
			const keys = votes.map((v) => [v.tipoVoto, v.digitacao ?? '']);
			const sorted = keys.every((k, i) => i === 0 || keys[i - 1][0] < k[0] || (keys[i - 1][0] === k[0] && String(keys[i - 1][1]) <= String(k[1])));
			const counts = {};
			for (const v of votes) counts[RDV_TO_BU[v.tipoVoto]] = (counts[RDV_TO_BU[v.tipoVoto]] ?? 0) + 1;
			const buCounts = totals.get(code) ?? {};
			const matches = JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(buCounts).sort());
			check(`totals:${id}:${code}`, matches);
			check(`sorted:${id}:${code}`, sorted);
			rdvOffices.push({ code, cargo: office.idCargo, votes: votes.map((v) => ({ tipo: v.tipoVoto, digitacao: v.digitacao ?? null })), matchesBU: matches, sorted });
		}
		elections.push({ id, offices, rdvOffices, chainOk, finalOk, signatureOk, blocks });
	}
	return { names, envelope, bu, rdv: rdvEntity, signature, elections, checks, ok: checks.every((c) => c.ok) };
}
