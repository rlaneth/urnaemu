// Candidates and parties of the load media, as an editable model.
//
// Layout of the files (decoded from the bundled media, same in every scenario):
//  - <eleição>-ca.dat  [cabeçalho, [enum, [UF, int]], cargos]
//      cargo      = [[1] código do cargo, INT, partidos]
//      partido    = [INT número, candidaturas, SEQUENCE (vazia nos cenários)]
//      candidatura= [INT número, titular, UTF8String (vazio nos cenários), suplentes? (vice, suplentes de senador)]
//      pessoa     = [[1] código do candidato (IA5, dígitos), nome, nome na urna, [3] nome fonético (Latin-1)?,
//                    nascimento (AAAAMMDD), ENUM gênero (2 masculino, 4 feminino), ENUM situação (12 apto),
//                    INT, [5] ordem do suplente?, BOOLEAN]
//  - <eleição>-pa.dat  [cabeçalho, [enum, [UF, int]], partidos: [INT número, sigla, nome]]
//  - <eleição>-fo.dat  [cabeçalho, [enum, [UF, int]], fotos: [código do candidato (UTF8), [ENUM formato (1 JPEG), OCTET STRING]]]
//  - <eleição prefix><UF>-ce.dat  cargos: [[1] código, ENUM (1 majoritário, 2 proporcional), INT dígitos, …, [0] {…, nomes, …, suplentes}]
// The candidate code links a person to its photo; codes are unique across the load.
// Unknown fields (the INT and BOOLEAN of a person, the candidacy string, the party's trailing
// SEQUENCE and the cargo's INT) are kept as they are; new entries copy them from an existing one.
// Coalitions (-co), federations (-fe) and -le/-pi are empty in every bundled scenario and are not edited.
import { VotaLoadFormat as F } from './load-format.js';

const ascii = new TextDecoder('ascii'), latin1 = new TextDecoder('windows-1252');
const asciiHex = (s) => F.hex(new TextEncoder().encode(String(s)));
const intOf = (node) => parseInt(node.hex || '0', 16);
function intHex(n) {
	let h = n.toString(16);
	if (h.length % 2) h = '0' + h;
	if (parseInt(h.slice(0, 2), 16) & 0x80) h = '00' + h;
	return h;
}
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);
const sibling = (path, kind) => path.replace(/-ca\.dat$/, `-${kind}.dat`);

export const GENEROS = { 2: 'masculino', 4: 'feminino' };
export const SITUACAO_APTO = 12;

function readPerson(node) {
	const c = node.children;
	const byTag = (tag) => c.find((x) => x.tag === tag);
	const date = c.find((x) => x.tag === 18), enums = c.filter((x) => x.tag === 10);
	return {
		code: ascii.decode(F.unhex(byTag(129).hex)),
		nome: c[1].text,
		nomeUrna: c[2].text,
		fonetico: byTag(131) ? latin1.decode(F.unhex(byTag(131).hex)) : '',
		nascimento: date.text,
		genero: intOf(enums[0]),
		situacao: intOf(enums[1]),
		ordem: byTag(133) ? intOf(byTag(133)) : null,
		// Unknown fields, kept as they are.
		extra: { int: c.find((x) => x.tag === 2).hex, flag: c.find((x) => x.tag === 1).hex }
	};
}
function writePerson(p) {
	const out = [{ tag: 129, hex: asciiHex(p.code) }, { tag: 27, text: p.nome }, { tag: 27, text: p.nomeUrna }];
	if (p.fonetico) out.push({ tag: 131, hex: F.hex(F.textBytes(p.fonetico)) });
	out.push({ tag: 18, text: p.nascimento }, { tag: 10, hex: intHex(p.genero) }, { tag: 10, hex: intHex(p.situacao) }, { tag: 2, hex: p.extra?.int ?? '00' });
	if (p.ordem != null) out.push({ tag: 133, hex: intHex(p.ordem) });
	out.push({ tag: 1, hex: p.extra?.flag ?? '00' });
	return { tag: 48, children: out };
}

/** Offices declared in the -ce.dat of an election: code → {nome, digitos, majoritario, suplentes}. */
function readOffices(files, caPath) {
	const prefix = nameOf(caPath).slice(0, 6); // e.g. t02411
	const out = new Map();
	for (const [path, bytes] of files) {
		if (!new RegExp(`/${prefix}[a-z]{2}-ce\\.dat$`).test(path)) continue;
		for (const cargo of F.parse(bytes).children[7].children) {
			const c = cargo.children, detail = c.find((x) => x.tag === 160)?.children ?? [];
			const names = detail.find((x) => x.tag === 48)?.children ?? [];
			const suplentes = detail.find((x, i) => x.tag === 48 && i > 1)?.children ?? [];
			out.set(intOf(c[0]), { nome: names[0]?.text ?? `Cargo ${intOf(c[0])}`, nomeFeminino: names[2]?.text, digitos: intOf(c[2]), majoritario: intOf(c[1]) === 1, suplentes: suplentes.map((s) => s.children.find((x) => x.tag === 48)?.children[0]?.text ?? 'Suplente') });
		}
	}
	return out;
}

/**
 * The editable model: one entry per election file (-ca.dat), with its offices and parties.
 * @param {Map<string, Uint8Array>} files
 */
export function readCandidates(files) {
	const elections = [];
	for (const path of [...files.keys()].filter((p) => p.endsWith('-ca.dat')).sort()) {
		const root = F.parse(files.get(path));
		const offices = readOffices(files, path);
		const paPath = sibling(path, 'pa');
		const parties = files.has(paPath) ? F.parse(files.get(paPath)).children[2].children.map((p) => ({ number: intOf(p.children[0]), sigla: p.children[1].text, nome: p.children[2].text })) : [];
		elections.push({
			path,
			parties,
			offices: root.children[2].children.map((cargo) => {
				const [codeNode, countNode, groups] = cargo.children, code = intOf(codeNode), info = offices.get(code) ?? {};
				return {
					code,
					nome: info.nome ?? `Cargo ${code}`,
					digitos: info.digitos ?? null,
					majoritario: info.majoritario ?? false,
					suplentes: info.suplentes ?? [],
					extra: countNode.hex,
					candidacies: groups.children.flatMap((group) =>
						group.children[1].children.map((c) => ({
							party: intOf(group.children[0]),
							number: intOf(c.children[0]),
							titular: readPerson(c.children[1]),
							label: c.children[2].text,
							suplentes: c.children[3] ? c.children[3].children.map(readPerson) : null,
							groupTail: F.hex(F.encode(group.children[2]))
						}))
					)
				};
			})
		});
	}
	return elections;
}

/** All candidate codes in use (titulares and suplentes, every election). */
function codesIn(elections) {
	return elections.flatMap((e) => e.offices.flatMap((o) => o.candidacies.flatMap((c) => [c.titular.code, ...(c.suplentes ?? []).map((s) => s.code)])));
}
/** Next free candidate code. */
export function nextCode(elections, taken = []) {
	return String(Math.max(0, ...[...codesIn(elections), ...taken].map(Number).filter(Number.isFinite)) + 1);
}

/** Problems with the model (pt-BR), empty when it can be written. */
export function validateCandidates(elections) {
	const problems = [], codes = new Set();
	const text = (value, where, max = 60) => {
		if (!String(value ?? '').trim()) problems.push(`${where}: vazio.`);
		else if (value.length > max) problems.push(`${where}: no máximo ${max} caracteres.`);
		try {
			F.textBytes(value ?? '');
		} catch {
			problems.push(`${where}: caractere não suportado (Windows-1252).`);
		}
	};
	for (const e of elections) {
		const numbers = new Set();
		for (const p of e.parties) {
			const where = `Partido ${p.number}`;
			if (!Number.isInteger(p.number) || p.number < 10 || p.number > 99) problems.push(`${where}: o número do partido tem 2 dígitos (10 a 99).`);
			if (numbers.has(p.number)) problems.push(`${where}: número repetido.`);
			numbers.add(p.number);
			text(p.sigla, `${where}, sigla`, 20);
			text(p.nome, `${where}, nome`, 80);
		}
		for (const o of e.offices) {
			const seen = new Set();
			if (!o.candidacies.length) problems.push(`${o.nome}: o cargo precisa de pelo menos uma candidatura.`);
			for (const c of o.candidacies) {
				const where = `${o.nome} ${c.number}`;
				if (!numbers.has(c.party)) problems.push(`${where}: o partido ${c.party} não existe.`);
				if (o.digitos && String(c.number).length !== o.digitos) problems.push(`${where}: o número tem ${o.digitos} dígitos para este cargo.`);
				if (!String(c.number).startsWith(String(c.party))) problems.push(`${where}: o número começa com o número do partido (${c.party}).`);
				if (seen.has(c.number)) problems.push(`${where}: número repetido no cargo.`);
				seen.add(c.number);
				if (o.suplentes.length && (c.suplentes?.length ?? 0) !== o.suplentes.length) problems.push(`${where}: o cargo exige ${o.suplentes.length} ${o.suplentes.length > 1 ? 'suplentes' : o.suplentes[0]}.`);
				for (const [person, role] of [[c.titular, 'titular'], ...(c.suplentes ?? []).map((s, i) => [s, o.suplentes[i] ?? `suplente ${i + 1}`])]) {
					const who = `${where}, ${role}`;
					text(person.nome, `${who}, nome`, 80);
					text(person.nomeUrna, `${who}, nome na urna`, 30);
					if (person.fonetico) text(person.fonetico, `${who}, nome fonético`, 80);
					if (!/^\d{8}$/.test(person.nascimento)) problems.push(`${who}: nascimento inválido (DD/MM/AAAA).`);
					if (!GENEROS[person.genero]) problems.push(`${who}: gênero inválido.`);
					if (!/^\d+$/.test(person.code)) problems.push(`${who}: código do candidato inválido.`);
					if (codes.has(person.code)) problems.push(`${who}: código do candidato ${person.code} repetido.`);
					codes.add(person.code);
				}
			}
		}
	}
	return problems;
}

/** Placeholder photo dimensions (titular, suplente), as in the bundled photos. */
export const PHOTO_SIZE = { titular: [161, 225], suplente: [111, 155] };

/**
 * Write the model back into the files (-ca, -pa and -fo of each election).
 * @param {Map<string, Uint8Array>} files
 * @param {object[]} elections model from readCandidates, edited
 * @param {Map<string, Uint8Array>} [photos] JPEG bytes for new or replaced candidate codes
 * @returns {Map<string, Uint8Array>} new files (others unchanged)
 */
export function writeCandidates(files, elections, photos = new Map()) {
	const problems = validateCandidates(elections);
	if (problems.length) throw Error(problems.join(' '));
	const out = new Map(files);
	for (const e of elections) {
		const root = F.parse(files.get(e.path));
		const byNumber = (a, b) => a.number - b.number;
		root.children[2].children = e.offices.map((o) => {
			const groups = new Map();
			for (const c of [...o.candidacies].sort(byNumber)) {
				if (!groups.has(c.party)) groups.set(c.party, { tail: c.groupTail, list: [] });
				const children = [{ tag: 2, hex: intHex(c.number) }, writePerson(c.titular), { tag: 27, text: c.label ?? '' }];
				if (c.suplentes) children.push({ tag: 48, children: c.suplentes.map(writePerson) });
				groups.get(c.party).list.push({ tag: 48, children });
			}
			return {
				tag: 48,
				children: [
					{ tag: 129, hex: intHex(o.code) },
					{ tag: 2, hex: o.extra },
					{ tag: 48, children: [...groups].sort(([a], [b]) => a - b).map(([party, g]) => ({ tag: 48, children: [{ tag: 2, hex: intHex(party) }, { tag: 48, children: g.list }, F.parse(F.unhex(g.tail ?? '3000'))] })) }
				]
			};
		});
		out.set(e.path, F.encode(root));

		const paPath = sibling(e.path, 'pa');
		if (files.has(paPath)) {
			const pa = F.parse(files.get(paPath));
			pa.children[2].children = [...e.parties].sort(byNumber).map((p) => ({ tag: 48, children: [{ tag: 2, hex: intHex(p.number) }, { tag: 27, text: p.sigla.trim() }, { tag: 27, text: p.nome.trim() }] }));
			out.set(paPath, F.encode(pa));
		}

		const foPath = sibling(e.path, 'fo');
		if (files.has(foPath)) {
			const fo = F.parse(files.get(foPath));
			const existing = new Map(fo.children[2].children.map((x) => [x.children[0].text, x]));
			const wanted = e.offices.flatMap((o) => o.candidacies.flatMap((c) => [c.titular.code, ...(c.suplentes ?? []).map((s) => s.code)]));
			fo.children[2].children = [...new Set(wanted)]
				.sort((a, b) => Number(a) - Number(b))
				.map((code) => {
					if (photos.has(code)) return { tag: 48, children: [{ tag: 27, text: code }, { tag: 48, children: [{ tag: 10, hex: '01' }, { tag: 4, hex: F.hex(photos.get(code)) }] }] };
					if (existing.has(code)) return existing.get(code);
					throw Error(`Falta a foto do candidato de código ${code}.`);
				});
			out.set(foPath, F.encode(fo));
		}
	}
	return out;
}

/** Photo bytes (JPEG) of a candidate code, or null. */
export function candidatePhoto(files, caPath, code) {
	const foPath = sibling(caPath, 'fo');
	if (!files.has(foPath)) return null;
	const entry = F.parse(files.get(foPath)).children[2].children.find((x) => x.children[0].text === code);
	return entry ? F.unhex(entry.children[1].children[1].hex) : null;
}

/** People of the model without a photo in the files: [{code, nome, role: 'titular'|'suplente'}]. */
export function missingPhotos(files, elections, photos = new Map()) {
	const out = [];
	for (const e of elections) {
		const foPath = sibling(e.path, 'fo');
		if (!files.has(foPath)) continue;
		const existing = new Set(F.parse(files.get(foPath)).children[2].children.map((x) => x.children[0].text));
		for (const o of e.offices)
			for (const c of o.candidacies)
				for (const [p, role] of [[c.titular, 'titular'], ...(c.suplentes ?? []).map((s) => [s, 'suplente'])])
					if (!existing.has(p.code) && !photos.has(p.code)) out.push({ code: p.code, nome: p.nomeUrna || p.nome, role });
	}
	return out;
}
