// Read the tallies back from the Boletim de Urna as printed on the paper roll (VOTA's own
// report text). Training sessions print the BU without writing result files, so this is how
// a training tally can be checked.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** @param {string[]} texts paper text operations, in order @returns {{name: string, key: string, candidates: Record<number, number>, legenda: Record<number, number>, brancos: number, nulos: number, apurado: number}[]} */
export function parsePrintedBu(texts) {
	const lines = texts.join('\n').split('\n');
	const start = lines.findIndex((l) => /^Boletim de Urna$/i.test(l.trim()));
	if (start < 0) return [];
	const offices = [];
	let office = null, party = null;
	for (const raw of lines.slice(start + 1)) {
		const line = raw.trimEnd();
		if (/BU DIGITAL|Boletim de Justificativa/i.test(line)) break;
		const header = /^-{2,}([^-].*?[^-])-{2,}$/.exec(line.trim());
		if (header && !/\d+\s*\/\s*\d+/.test(header[1])) {
			office = { name: header[1].trim(), key: norm(header[1]), candidates: {}, legenda: {}, brancos: 0, nulos: 0, apurado: 0 };
			offices.push(office);
			party = null;
			continue;
		}
		if (!office) continue;
		let m;
		if ((m = /^Partido:\s*(\d+)/.exec(line))) party = Number(m[1]);
		else if ((m = /^\s*Votos de legenda\s+(\d+)$/.exec(line)) && party !== null) office.legenda[party] = Number(m[1]);
		else if ((m = /^Brancos\s+(\d+)$/.exec(line))) office.brancos = Number(m[1]);
		else if ((m = /^Nulos\s+(\d+)$/.exec(line))) office.nulos = Number(m[1]);
		else if ((m = /^Total Apurado\s+(\d+)$/.exec(line))) office.apurado = Number(m[1]);
		else if ((m = /^\s+.*?\s(\d{2,5})\s+(\d{4})$/.exec(line))) office.candidates[Number(m[1])] = Number(m[2]);
	}
	return offices;
}

export { norm as normalizeOfficeName };
