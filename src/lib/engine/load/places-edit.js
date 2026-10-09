// Rename the municípios a load media declares, and create new zonas within them, so the section
// can then be relocated (section-relocation.js) into a zona the bundled scenario did not ship.
// Pure transforms: (files, …) → { files, changes }, never mutating the input map.
//
// NOTE: creating or renumbering MUNICÍPIOS is intentionally not offered. VOTA rejects município
// numbers outside the set the scenario ships (1, 2, 3), failing at boot inside
// CConfiguracaoEleicao with "hash de dados vazios" — verified for both a freshly synthesized
// município and an existing one renumbered to a new code. New ZONA numbers, by contrast, boot and
// produce a valid BU. So we expose renaming (name) + new zonas, and the UI keeps município numbers
// from the scenario.
//
// Structure (decoded from the bundled media, same path places() uses):
//  - -mu.dat  children[1].children[0].children[1].children = município records [2 code, 27 nome, …]
//  - -mz.dat  children[1].children[0].children[1].children = pairs [2 município, 2 zona]
//  - -lo.dat  children[3] = the current section's município record [2 código, 27 nome, …]
import { VotaLoadFormat as F } from './load-format.js';

function intHex(n) {
	let h = n.toString(16);
	if (h.length % 2) h = '0' + h;
	if (parseInt(h.slice(0, 2), 16) & 0x80) h = '00' + h;
	return h;
}
const intValue = (node) => (node?.tag === 2 || node?.tag === 130 ? parseInt(node.hex || '0', 16) : null);
const find = (files, re) => [...files.keys()].find((p) => re.test(p));

const muRecords = (root) => root.children[1].children[0].children[1];
const mzPairs = (root) => root.children[1].children[0].children[1];

function requireFile(files, re, label) {
	const path = find(files, re);
	if (!path) throw Error(`Falta o arquivo ${label} nesta mídia`);
	return path;
}
function checkName(nome) {
	const value = String(nome ?? '').trim();
	if (!value) throw Error('O nome do município não pode ficar em branco');
	if (value.length > 60) throw Error('O nome do município é longo demais (máximo 60 caracteres)');
	F.textBytes(value); // throws on a character the urna encoding (Windows-1252) cannot represent
	return value;
}
function checkZona(n) {
	if (!Number.isInteger(n) || n < 1 || n > 9999) throw Error('O número da zona deve ser de 1 a 9999');
	return n;
}

/** Rename a declared município (and the current section's -lo record if it is that município). */
export function renameMunicipio(files, municipio, nome) {
	municipio = Number(municipio);
	const name = checkName(nome);
	const out = new Map(files);
	const changes = [];

	const muPath = requireFile(files, /-mu\.dat$/, '-mu.dat');
	const muRoot = F.parse(files.get(muPath));
	const rec = muRecords(muRoot).children.find((m) => intValue(m.children[0]) === municipio);
	if (!rec) throw Error(`O município ${municipio} não existe nesta mídia`);
	if (rec.children[1].text === name) return { files: out, changes };
	rec.children[1].text = name;
	out.set(muPath, F.encode(muRoot));
	changes.push({ path: muPath, edits: 1 });

	// The polling-place file carries a copy of the current section's município record.
	const loPath = find(files, /-lo\.dat$/);
	if (loPath) {
		const loRoot = F.parse(files.get(loPath));
		const loRec = loRoot.children[3];
		if (loRec?.children && intValue(loRec.children[0]) === municipio && loRec.children[1]?.text !== undefined && loRec.children[1].text !== name) {
			loRec.children[1].text = name;
			out.set(loPath, F.encode(loRoot));
			changes.push({ path: loPath, edits: 1 });
		}
	}
	return { files: out, changes };
}

// Change the media's UF. Experimental but verified end to end: VOTA (unlike new município numbers)
// does not validate the UF against a baked table, so a transformed media — even to a UF the bundle
// never shipped — boots, lets a voter vote, and writes a BU that verifies. This rewrites the
// 2-letter UF token in every file name (the national "br00000" packages have no state token and
// are left alone) and the UF text ("AC"/"Acre") inside the structural files; turno, processo and
// the office/cargo structure stay from the scenario. Existing voters keep their título códigos,
// which VOTA still accepts.
const UF_NAME = { ac: 'Acre', al: 'Alagoas', ap: 'Amapá', am: 'Amazonas', ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo', go: 'Goiás', ma: 'Maranhão', mt: 'Mato Grosso', ms: 'Mato Grosso do Sul', mg: 'Minas Gerais', pa: 'Pará', pb: 'Paraíba', pr: 'Paraná', pe: 'Pernambuco', pi: 'Piauí', rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte', rs: 'Rio Grande do Sul', ro: 'Rondônia', rr: 'Roraima', sc: 'Santa Catarina', sp: 'São Paulo', se: 'Sergipe', to: 'Tocantins', zz: 'Exterior' };
/** UFs the UI offers, as { sigla, nome }. */
export const UFS = Object.entries(UF_NAME).map(([sigla, nome]) => ({ sigla, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export function changeUf(files, config, newUf) {
	const from = String(config.uf).toLowerCase(), to = String(newUf).toLowerCase();
	if (!/^[a-z]{2}$/.test(to)) throw Error('UF inválida');
	if (to === from) return { files: new Map(files), config: { ...config }, changes: [] };
	const fromUp = from.toUpperCase(), toUp = to.toUpperCase();
	const fromName = UF_NAME[from], toName = UF_NAME[to] ?? toUp;
	const rename = (name) => name.replace(new RegExp('^([to]\\d{5})' + from + '(?=\\d|-|\\.|$)'), '$1' + to);
	const out = new Map(), changes = [];
	for (const [path, bytes] of files) {
		const name = path.slice(path.lastIndexOf('/') + 1);
		const dir = path.slice(0, path.lastIndexOf('/') + 1);
		const nn = rename(name);
		let output = bytes, edits = 0;
		const structural = /-(mu|mz|cm|cp|lo)\.dat$/.test(name) || /-ca\.dat$/.test(name);
		const pidFile = name.endsWith('.pid');
		const catalog = name.endsWith('.vsc') && bytes.length;
		if (structural || pidFile || catalog) {
			const root = F.parse(bytes);
			if (structural) {
				(function walk(n) {
					if (n.text === fromUp) { n.text = toUp; edits++; }
					else if (fromName && n.text === fromName) { n.text = toName; edits++; }
					n.children?.forEach(walk);
				})(root);
			}
			// Every .pid names its package file (.jez), which carries the UF token.
			if (pidFile) {
				const jez = root.children?.[2];
				if (jez?.text !== undefined && rename(jez.text) !== jez.text) { jez.text = rename(jez.text); edits++; }
			}
			// Filenames inside the signed catalog (an OCTET STRING holding the catalog tree).
			if (catalog) {
				const content = root.children?.[3];
				if (content?.tag === 4) {
					const list = F.parse(F.unhex(content.hex));
					(function walk(n) {
						if (n.text !== undefined && rename(n.text) !== n.text) { n.text = rename(n.text); edits++; }
						n.children?.forEach(walk);
					})(list);
					if (edits) content.hex = F.hex(F.encode(list));
				}
			}
			if (edits) { output = F.encode(root); changes.push({ path, edits }); }
		}
		if (nn !== name) changes.push({ from: path, to: dir + nn });
		out.set(dir + nn, output);
	}
	return { files: out, config: { ...config, uf: to }, changes };
}

/** Add a new zona to a município already declared in -mu.dat. */
export function createZona(files, municipio, zona) {
	municipio = Number(municipio);
	zona = checkZona(Number(zona));
	const out = new Map(files);

	const muPath = requireFile(files, /-mu\.dat$/, '-mu.dat');
	if (!muRecords(F.parse(files.get(muPath))).children.some((m) => intValue(m.children[0]) === municipio)) {
		throw Error(`O município ${municipio} não existe nesta mídia`);
	}
	const mzPath = requireFile(files, /-mz\.dat$/, '-mz.dat');
	const mzRoot = F.parse(files.get(mzPath));
	const mzList = mzPairs(mzRoot);
	if (mzList.children.some((p) => intValue(p.children[0]) === municipio && intValue(p.children[1]) === zona)) {
		throw Error(`A zona ${zona} já existe no município ${municipio}`);
	}
	const pair = structuredClone(mzList.children[0]);
	pair.children[0].hex = intHex(municipio);
	pair.children[1].hex = intHex(zona);
	mzList.children.push(pair);
	out.set(mzPath, F.encode(mzRoot));
	return { files: out, changes: [{ path: mzPath, edits: 1 }] };
}
