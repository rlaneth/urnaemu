import fs from 'node:fs';
import assert from 'node:assert/strict';
import { relocate, places } from '#lib/engine/load/section-relocation.js';

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
	assert.deepEqual(places(files).map((p) => [p.municipio, p.zonas]), [[1, [1]], [2, [2]], [3, [3]]]);
	const away = relocate(files, home, { municipio: 2, zona: 2, secao: 7 });
	const names = [...away.files.keys()];
	assert.ok(names.some((n) => n.endsWith('0000200020007-lo.dat')), 'section code renamed');
	assert.ok(names.some((n) => /000020002-se\.dat$/.test(n)), 'zone code renamed');
	if (scenario === 'municipal-t1') assert.ok(names.some((n) => n.endsWith('ac00002-ca.dat')), 'municipal candidate package moved');
	else assert.ok(names.some((n) => n.endsWith('ac00000-ca.dat')), 'state-wide candidate package kept');
	// And back: every file is byte-identical to the original.
	const back = relocate(away.files, { municipio: 2, zona: 2, secao: 7 }, home);
	assert.deepEqual([...back.files.keys()].sort(), [...files.keys()].sort());
	for (const [path, bytes] of files) assert.ok(same(back.files.get(path), bytes), `${scenario}: ${path} round trip`);
	assert.throws(() => relocate(files, home, { municipio: 2, zona: 1 }), /não pertence ao município/);
	assert.throws(() => relocate(files, home, { municipio: 9, zona: 9 }), /não está na lista/);
}
console.log('PASS: município/zona/seção relocation (municipal and state-wide) round-trips byte for byte; undeclared places refused.');
