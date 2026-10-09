// The JS result reader must decode exactly what the Python reference reader decodes, and
// verify both the emulator's generated results and the real urna's results.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Schema } from '#lib/results/asn1-schema.js';
import { verifyResults } from '#lib/results/verify.js';
import { readZip } from '#lib/results/zip.js';

const read = (p) => new Uint8Array(fs.readFileSync(new URL(p, import.meta.url)));
const schemaText = (n) => fs.readFileSync(new URL(`../../src/lib/results/schemas/${n}.asn1`, import.meta.url), 'utf8');
const schemas = { bu: new Schema(schemaText('bu')), rdv: new Schema(schemaText('rdv')), assinatura: new Schema(schemaText('assinatura')) };

// Python json.dumps(indent=2, ensure_ascii=False, default=bytes→{hex}) text, big ints as digits.
function pythonJson(value) {
	const marks = [];
	const text = JSON.stringify(value, (_, v) => {
		if (v instanceof Uint8Array) return { hex: Buffer.from(v).toString('hex') };
		if (typeof v === 'bigint') return `\u0000${marks.push(String(v)) - 1}\u0000`;
		return v;
	}, 2);
	return text.replace(/"\\u0000(\d+)\\u0000"/g, (_, i) => marks[i]) + '\n';
}

// Generated (emulator) results: identical decoding and all checks, including the P-521 signature.
const dir = '../fixtures/native-results/';
const prefix = 't02410ac0000100010001';
const generated = {};
for (const suffix of ['bu.dat', 'rdv.dat', 'vota.vsc']) generated[`${prefix}-${suffix}`] = read(dir + `${prefix}-${suffix}`);
const report = await verifyResults(generated, schemas);
const expected = fs.readFileSync(new URL(dir + 'decoded-results.json', import.meta.url), 'utf8');
const actual = pythonJson({ envelope: { ...report.envelope, conteudo: 'decoded below' }, bu: report.bu, rdv: report.rdv });
assert.equal(actual, expected, 'JS decoding differs from the Python reference decoding');
for (const c of report.checks) assert.ok(c.ok, `generated check failed: ${c.id}`);
assert.ok(report.checks.some((c) => c.id.startsWith('signature:')), 'generated signature was not checked');

// Real urna results (immutable reference, read in place): structure, hash chain and totals.
const zipPath = new URL('../fixtures/real/', import.meta.url);
const zipName = fs.readdirSync(zipPath).find((n) => n.startsWith('DadosDeUrna_') && n.endsWith('.zip'));
const real = {};
for (const entry of await readZip(new Uint8Array(fs.readFileSync(new URL(zipName, zipPath))))) real[entry.name] = await entry.read();
const realReport = await verifyResults(real, schemas);
for (const c of realReport.checks.filter((c) => !c.id.startsWith('signature:') && c.id !== 'certificate')) assert.ok(c.ok, `real check failed: ${c.id}`);
const blocks = realReport.elections.reduce((n, e) => n + e.blocks, 0);

// The log archive of a real urna is a ZIP of logd.dat.
const log = await readZip(real[Object.keys(real).find((n) => n.endsWith('-log.jez'))]);
const logd = new TextDecoder('windows-1252').decode(await log.find((e) => e.name === 'logd.dat').read());
assert.match(logd.split('\n')[0], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\t\w+\t\d{8}\t\w+\t/);

const realSignatures = realReport.checks.filter((c) => c.id.startsWith('signature:'));
console.log(`PASS: JS decoding matches Python exactly; ${report.checks.length} generated checks; real BU: ${realReport.elections.length} elections, ${blocks} hash-chained vote blocks, totals match RDV; real signatures ${realSignatures.length ? realSignatures.map((c) => (c.ok ? 'valid' : 'not verified')).join(', ') : 'not checked'}; real log.jez read (${logd.split('\n').length} lines).`);
