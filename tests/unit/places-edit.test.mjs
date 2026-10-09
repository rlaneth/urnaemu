import fs from 'node:fs';
import assert from 'node:assert/strict';
import { renameMunicipio, renumberMunicipio, createZona, changeUf } from '#lib/engine/load/places-edit.js';
import { places, relocate } from '#lib/engine/load/section-relocation.js';
import { VotaLoadFormat as F } from '#lib/engine/load/load-format.js';

const bases = new URL('../fixtures/bases/', import.meta.url);
function load(scenario) {
	const dir = new URL(`${scenario}/dsk/fi/estatico/`, bases), files = new Map();
	for (const name of fs.readdirSync(dir)) files.set('/dsk/fi/estatico/' + name, new Uint8Array(fs.readFileSync(new URL(name, dir))));
	return files;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const home = { municipio: 1, zona: 1, secao: 1 };

for (const scenario of ['municipal-t1', 'geral-t1']) {
	const files = load(scenario);

	// parse → encode is byte-identical for the files we edit (encode matches the TSE's BER
	// convention, so appending/editing a record never disturbs the others).
	for (const re of [/-mu\.dat$/, /-mz\.dat$/]) {
		const path = [...files.keys()].find((p) => re.test(p));
		assert.ok(same(F.encode(F.parse(files.get(path))), files.get(path)), `${scenario}: ${path} re-encodes identically`);
	}

	// Rename an existing município: -mu record and the current section's -lo record both update.
	const renamed = renameMunicipio(files, 1, 'Cidade Modelo').files;
	assert.equal(places(renamed).find((p) => p.municipio === 1).nome, 'Cidade Modelo');
	const loPath = [...renamed.keys()].find((p) => /-lo\.dat$/.test(p));
	assert.equal(F.parse(renamed.get(loPath)).children[3].children[1].text, 'Cidade Modelo', `${scenario}: -lo município name updated`);

	// Create a new zona in município 1.
	const built = createZona(files, 1, 5).files;
	const mun1 = places(built).find((p) => p.municipio === 1);
	assert.deepEqual(mun1.zonas.sort((a, b) => a - b), [1, 5], `${scenario}: new zona listed`);
	// The other municípios are untouched.
	assert.deepEqual(places(built).filter((p) => p.municipio !== 1).map((p) => [p.municipio, p.zonas]), [[2, [2]], [3, [3]]]);

	// The section can be relocated into the new zona.
	const moved = relocate(built, home, { municipio: 1, zona: 5, secao: 12 });
	assert.ok([...moved.files.keys()].some((n) => n.endsWith('0000100050012-lo.dat')), `${scenario}: section moved into new zona`);

	// UF change renames files and rewrites the UF text, and round-trips byte for byte.
	const toSp = changeUf(files, { uf: 'ac' }, 'sp');
	assert.equal(toSp.config.uf, 'sp');
	assert.ok([...toSp.files.keys()].some((n) => /[to]\d{5}sp/.test(n)), `${scenario}: files renamed to sp`);
	assert.ok(![...toSp.files.keys()].some((n) => /[to]\d{5}ac/.test(n)), `${scenario}: no ac file names left`);
	if (scenario.startsWith('geral')) assert.ok([...toSp.files.keys()].some((n) => /br00000/.test(n)), 'national br package kept');
	const back = changeUf(toSp.files, { uf: 'sp' }, 'ac');
	assert.deepEqual([...back.files.keys()].sort(), [...files.keys()].sort(), `${scenario}: names restored`);
	for (const [p, b] of files) assert.ok(same(back.files.get(p), b), `${scenario}: ${p} uf round trip`);
	assert.throws(() => changeUf(files, { uf: 'ac' }, 'xyz'), /UF inválida/);

	// Another código for a município: every list follows (sorted), and the section moves with it.
	const lists = (f) => Object.fromEntries([...f.keys()].filter((p) => /-(mu|mz|cm|cfm|ce)\.dat$/.test(p)).map((p) => {
		const r = F.parse(f.get(p)), v = (n) => parseInt(n.hex, 16);
		const l = /-ce\.dat$/.test(p) ? r.children[8].children.map(v) : /-cfm\.dat$/.test(p) ? r.children[1].children.map((e) => v(e.children[0])) : /-cm\.dat$/.test(p) ? r.children[1].children[0].children[2].children.map((e) => v(e.children[0])) : r.children[1].children[0].children[1].children.map((e) => v(e.children[0]));
		return [p.split('/').pop(), l];
	}));
	const renumbered = renumberMunicipio(files, home, 1, 71072);
	assert.equal(renumbered.config.municipio, 71072);
	for (const [name, l] of Object.entries(lists(renumbered.files))) assert.deepEqual(l, [2, 3, 71072], `${scenario}: ${name} renumbered and sorted`);
	assert.ok([...renumbered.files.keys()].some((n) => n.endsWith('7107200010001-lo.dat')), `${scenario}: section moved with its município`);
	assert.ok(![...renumbered.files.keys()].some((n) => /0000100010001/.test(n)), `${scenario}: no file left at the old código`);
	assert.equal(places(renumbered.files).find((p) => p.municipio === 71072).nome, places(files).find((p) => p.municipio === 1).nome);
	// Another município (not the section's): only the lists change.
	const other = renumberMunicipio(files, home, 3, 1392);
	assert.equal(other.config.municipio, 1);
	assert.deepEqual([...other.files.keys()].sort(), [...files.keys()].sort(), `${scenario}: no file renamed`);
	for (const [name, l] of Object.entries(lists(other.files))) assert.deepEqual(l, [1, 2, 1392], `${scenario}: ${name}`);
	assert.throws(() => renumberMunicipio(files, home, 1, 2), /já é de outro município/);
	assert.throws(() => renumberMunicipio(files, home, 9, 10), /não existe/);
	assert.throws(() => renumberMunicipio(files, home, 1, 100000), /de 1 a 99999/);

	// Guard rails.
	assert.throws(() => createZona(files, 1, 1), /já existe/);
	assert.throws(() => createZona(files, 9, 9), /não existe/);
	assert.throws(() => createZona(files, 1, 10000), /de 1 a 9999/);
	assert.throws(() => renameMunicipio(files, 9, 'X'), /não existe/);
	assert.throws(() => renameMunicipio(files, 1, ''), /em branco/);
}
console.log('PASS: município rename and renumbering, new-zona creation and UF change (round-trips byte for byte); new zonas are relocatable and keep the originals intact.');
