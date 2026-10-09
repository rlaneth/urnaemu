import assert from 'node:assert/strict';
import { writeZip, readZip } from '#lib/results/zip.js';

const text = new TextEncoder().encode('Iniciando aplicação - 1º turno\n'.repeat(50));
const random = crypto.getRandomValues(new Uint8Array(2048));
const zip = await writeZip([
	{ name: 'log/logd.dat', bytes: text, mtime: new Date(2026, 9, 4, 8, 0, 0) },
	{ name: 'aleatorio.bin', bytes: random }
]);
const entries = await readZip(zip);
assert.deepEqual(entries.map((e) => e.name), ['log/logd.dat', 'aleatorio.bin']);
assert.equal(entries[0].method, 8, 'compressible data is deflated');
assert.equal(entries[1].method, 0, 'incompressible data is stored');
assert.deepEqual(await entries[0].read(), text);
assert.deepEqual(await entries[1].read(), random);
console.log('PASS: ZIP round-trip (deflate and stored entries).');
