// Move the load media to another município, zona and/or seção of the same UF.
//
// Where the place appears (decoded from the bundled media):
//  - file names: the 13-digit section code município(5) zona(4) seção(4), e.g.
//    t02400ac0000100010001-el.dat and 0000100010001-lo.dat; the 9-digit zone code
//    município(5) zona(4), e.g. t02400ac000010001-se.dat and the section files' .pid;
//    and, in municipal elections, the 5-digit município of the candidate packages,
//    e.g. t02411ac00001-ca.dat (state-wide packages use 00000 and are not moved);
//  - the header [[município, zona], local, seção] of the -el, -imp, -tte and -lo files;
//  - the zone's list of polling places (-se.dat): [[município, zona], places…], each place
//    listing its sections as [seção, ENUM, …];
//  - the polling-place file (-lo.dat): the municipality record [código, nome, BOOLEAN, [2]]
//    and the timezone record [código, minutos, BOOLEAN], copied from the UF's municipality
//    list (-mu.dat) and timezone list (-cm.dat);
//  - municipal candidate packages: the header [ENUM, [UF, município]] and the package id in
//    the .pid ([2] município, and the .jez name);
//  - the names inside the signature catalogs (.vsc).
// Only places the media declares are accepted: the município must be in -mu.dat and the
// (município, zona) pair in -mz.dat. Signatures of changed files become stale: official media
// must be re-signed afterwards (load-editor.js does it).
import { VotaLoadFormat as F } from './load-format.js';

const pad = (n, w) => String(n).padStart(w, '0');
function intHex(n) {
	let h = n.toString(16);
	if (h.length % 2) h = '0' + h;
	if (parseInt(h.slice(0, 2), 16) & 0x80) h = '00' + h;
	return h;
}
const intValue = (node) => (node?.tag === 2 || node?.tag === 130 ? parseInt(node.hex || '0', 16) : null);
const isPair = (node, a, b) => node?.tag === 48 && node.children?.length === 2 && intValue(node.children[0]) === a && intValue(node.children[1]) === b;
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);

/** Municipalities and zones the media declares: [{municipio, nome, zonas: [..]}]. */
export function places(files) {
	const find = (re) => [...files.keys()].find((p) => re.test(p));
	const mu = find(/-mu\.dat$/), mz = find(/-mz\.dat$/);
	if (!mu || !mz) return [];
	const list = F.parse(files.get(mu)).children[1].children[0].children[1].children.map((m) => ({ municipio: intValue(m.children[0]), nome: m.children[1].text, zonas: [] }));
	for (const pair of F.parse(files.get(mz)).children[1].children[0].children[1].children) {
		const entry = list.find((m) => m.municipio === intValue(pair.children[0]));
		entry?.zonas.push(intValue(pair.children[1]));
	}
	return list;
}

/**
 * @param {Map<string, Uint8Array>} files load media files
 * @param {{municipio:number, zona:number, secao:number}} config current place
 * @param {{municipio?:number, zona?:number, secao?:number}} target new place (missing parts unchanged)
 * @returns {{files: Map<string, Uint8Array>, changes: object[]}}
 */
export function relocate(files, config, target) {
	const from = { municipio: config.municipio, zona: config.zona, secao: config.secao };
	const to = { ...from, ...Object.fromEntries(Object.entries(target).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Number(v)])) };
	if (!Number.isInteger(to.secao) || to.secao < 1 || to.secao > 9999) throw Error('A seção deve ser um número de 1 a 9999');
	if (to.municipio !== from.municipio || to.zona !== from.zona) {
		const known = places(files);
		const m = known.find((p) => p.municipio === to.municipio);
		if (!m) throw Error(`O município ${to.municipio} não está na lista de municípios desta mídia`);
		if (!m.zonas.includes(to.zona)) throw Error(`A zona ${to.zona} não pertence ao município ${to.municipio} nesta mídia (zonas: ${m.zonas.join(', ')})`);
	}
	if (to.municipio === from.municipio && to.zona === from.zona && to.secao === from.secao) return { files: new Map(files), changes: [] };

	const sec = (p) => pad(p.municipio, 5) + pad(p.zona, 4) + pad(p.secao, 4);
	const zone = (p) => pad(p.municipio, 5) + pad(p.zona, 4);
	const moveMunicipio = to.municipio !== from.municipio;
	const packageRe = /^([to]\d{5}[a-z]{2})(\d{5})(-[a-z]+\.(?:dat|pid|vsc|jez))$/;
	// File and catalog names: section code, then zone code, then municipal candidate packages.
	function rename(name) {
		let out = name.split(sec(from)).join(sec(to)).split(zone(from)).join(zone(to));
		const m = packageRe.exec(out);
		if (moveMunicipio && m && m[2] === pad(from.municipio, 5)) out = m[1] + pad(to.municipio, 5) + m[3];
		return out;
	}
	const isMunicipalPackage = (name) => {
		const m = packageRe.exec(name);
		return !!m && m[2] === pad(from.municipio, 5) && m[2] !== '00000';
	};

	// Municipality and timezone records of the new município, for the -lo.dat.
	const muRecord = (() => {
		const mu = [...files.keys()].find((p) => p.endsWith('-mu.dat'));
		return mu && F.parse(files.get(mu)).children[1].children[0].children[1].children.find((m) => intValue(m.children[0]) === to.municipio);
	})();
	const cmRecord = (() => {
		const cm = [...files.keys()].find((p) => p.endsWith('-cm.dat'));
		return cm && F.parse(files.get(cm)).children[1].children[0].children[2].children.find((m) => intValue(m.children[0]) === to.municipio);
	})();

	const out = new Map(), changes = [];
	for (const [path, bytes] of files) {
		const name = nameOf(path);
		const target_ = path.slice(0, path.lastIndexOf('/') + 1) + rename(name);
		let output = bytes, edits = 0;
		const sectionFile = /(-el|-imp|-tte|-lo)\.dat$/.test(name) && name.includes(sec(from));
		const zoneList = /-se\.dat$/.test(name) && name.includes(zone(from) + '-se');
		const catalog = name.endsWith('.vsc') && bytes.length;
		const packageFile = moveMunicipio && isMunicipalPackage(name) && /\.(dat|pid)$/.test(name);
		const pidFile = name.endsWith('.pid');
		if ((sectionFile || zoneList || catalog || packageFile || pidFile) && !name.endsWith('-rdj.dat')) {
			const root = F.parse(bytes);
			(function walk(node) {
				const c = node.children;
				if (!c) return;
				// [[município, zona], local, seção] headers.
				if (sectionFile && c.length >= 3 && isPair(c[0], from.municipio, from.zona) && c[1].tag === 2 && intValue(c[2]) === from.secao) {
					c[0].children[0].hex = intHex(to.municipio);
					c[0].children[1].hex = intHex(to.zona);
					c[2].hex = intHex(to.secao);
					edits++;
				}
				// -se.dat: [município, zona] of the zone, and each section [seção, ENUM, …].
				if (zoneList && isPair(node, from.municipio, from.zona)) {
					c[0].hex = intHex(to.municipio);
					c[1].hex = intHex(to.zona);
					edits++;
				}
				if (zoneList && c.length >= 2 && c[0].tag === 2 && intValue(c[0]) === from.secao && c[1].tag === 10) {
					c[0].hex = intHex(to.secao);
					edits++;
				}
				c.forEach(walk);
			})(root);
			// -lo.dat: municipality record (/3) and timezone record (/4) of the new município.
			if (sectionFile && name.endsWith('-lo.dat') && moveMunicipio) {
				if (!muRecord || !cmRecord) throw Error('Faltam os registros do município (-mu.dat, -cm.dat) para o local de votação');
				root.children[3] = structuredClone(muRecord);
				root.children[4] = structuredClone(cmRecord);
				edits++;
			}
			// Municipal candidate packages: header [ENUM, [UF, município]] and the .pid id.
			if (packageFile && name.endsWith('.dat')) {
				const place = root.children[1]?.children?.[1];
				if (place?.children?.length === 2 && intValue(place.children[1]) === from.municipio) {
					place.children[1].hex = intHex(to.municipio);
					edits++;
				}
			}
			if (packageFile && name.endsWith('.pid')) {
				const mun = root.children[1]?.children?.find((x) => x.tag === 130);
				if (mun && intValue(mun) === from.municipio) {
					mun.hex = intHex(to.municipio);
					edits++;
				}
			}
			// Every .pid names its package file (.jez), which carries the same codes.
			if (pidFile) {
				const jez = root.children[2];
				if (jez?.text !== undefined && rename(jez.text) !== jez.text) {
					jez.text = rename(jez.text);
					edits++;
				}
			}
			// Names inside the signed catalog (OCTET STRING holding the catalog).
			if (catalog) {
				const content = root.children?.[3];
				if (content?.tag === 4) {
					const list = F.parse(F.unhex(content.hex));
					(function walk(node) {
						if (node.text !== undefined && rename(node.text) !== node.text) {
							node.text = rename(node.text);
							edits++;
						}
						node.children?.forEach(walk);
					})(list);
					content.hex = F.hex(F.encode(list));
				}
			}
			if (sectionFile && !edits) throw Error(`Cabeçalho da seção não encontrado em ${path}`);
			if (zoneList && !edits) throw Error(`A seção ${from.secao} não está na lista da zona (${path})`);
			if (edits) {
				output = F.encode(root);
				changes.push({ path, edits });
			}
		}
		if (target_ !== path) changes.push({ from: path, to: target_ });
		if (out.has(target_)) throw Error(`Dois arquivos teriam o mesmo nome: ${target_}`);
		out.set(target_, output);
	}
	return { files: out, changes };
}

/** Only the seção (kept for callers that move within the zone). */
export function relocateSection(files, config, secao) {
	if (!Number.isInteger(secao) || secao < 1 || secao > 9999) throw Error('A seção deve ser um número de 1 a 9999');
	return relocate(files, config, { secao });
}
