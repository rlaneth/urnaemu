import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readCandidates, writeCandidates, validateCandidates, nextCode, candidatePhoto } from '#lib/engine/load/candidates.js';

const bases = new URL('../fixtures/bases/', import.meta.url);
function load(scenario) {
	const dir = new URL(`${scenario}/dsk/fi/estatico/`, bases), files = new Map();
	for (const name of fs.readdirSync(dir)) files.set('/dsk/fi/estatico/' + name, new Uint8Array(fs.readFileSync(new URL(name, dir))));
	return files;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Round trip: reading and writing without changes gives the same bytes, in every scenario.
for (const scenario of fs.readdirSync(bases).filter((n) => /^(geral|municipal)/.test(n))) {
	const files = load(scenario), model = readCandidates(files);
	assert.ok(model.length, `${scenario}: candidate files`);
	assert.deepEqual(validateCandidates(model), [], `${scenario}: bundled media is valid`);
	const out = writeCandidates(files, model);
	for (const [path, bytes] of out) assert.ok(same(bytes, files.get(path)), `${scenario}: ${path} unchanged`);
}
console.log('PASS: candidates, parties and photos round-trip byte for byte in every scenario.');

// Municipal: Prefeito (vice) and Vereador.
const files = load('municipal-t1'), model = readCandidates(files), [e] = model;
const prefeito = e.offices.find((o) => o.code === 11), vereador = e.offices.find((o) => o.code === 13);
assert.equal(prefeito.nome, 'Prefeito');
assert.equal(prefeito.digitos, 2);
assert.deepEqual(prefeito.suplentes, ['Vice-Prefeito']);
assert.equal(vereador.digitos, 5);
const natacao = prefeito.candidacies.find((c) => c.number === 91);
assert.equal(natacao.titular.nomeUrna, 'Natação');
assert.equal(natacao.suplentes[0].nomeUrna, 'Judô');
assert.equal(natacao.suplentes[0].ordem, 1);
assert.deepEqual(e.parties[0], { number: 91, sigla: 'PEsp', nome: 'Partido dos Esportes' });

// Edit, remove, add (new party with a Vereador candidate and a Prefeito ticket).
const code = nextCode(model);
natacao.titular.nomeUrna = 'Nado Livre';
vereador.candidacies = vereador.candidacies.filter((c) => c.number !== 91001);
e.parties.push({ number: 77, sigla: 'PTst', nome: 'Partido de Teste' });
const person = (c, nome) => ({ code: c, nome, nomeUrna: nome, fonetico: '', nascimento: '19800101', genero: 4, situacao: 12, ordem: null, extra: { int: '00', flag: '00' } });
vereador.candidacies.push({ party: 77, number: 77123, titular: person(code, 'Nova Vereadora'), label: '', suplentes: null, groupTail: '3000' });
prefeito.candidacies.push({ party: 77, number: 77, titular: person(String(+code + 1), 'Nova Prefeita'), label: '', suplentes: [{ ...person(String(+code + 2), 'Novo Vice'), genero: 2, ordem: 1 }], groupTail: '3000' });
assert.throws(() => writeCandidates(files, model), /Falta a foto/);
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
const out = writeCandidates(files, model, new Map([[code, jpeg], [String(+code + 1), jpeg], [String(+code + 2), jpeg]]));
const back = readCandidates(out)[0];
assert.equal(back.offices.find((o) => o.code === 11).candidacies.find((c) => c.number === 91).titular.nomeUrna, 'Nado Livre');
assert.ok(!back.offices.find((o) => o.code === 13).candidacies.some((c) => c.number === 91001));
assert.equal(back.offices.find((o) => o.code === 13).candidacies.find((c) => c.number === 77123).titular.nome, 'Nova Vereadora');
assert.equal(back.offices.find((o) => o.code === 11).candidacies.find((c) => c.number === 77).suplentes[0].nome, 'Novo Vice');
assert.ok(back.parties.some((p) => p.number === 77));
assert.ok(same(candidatePhoto(out, e.path, code), jpeg));
assert.equal(candidatePhoto(out, e.path, '11'), null, 'photo of the removed candidate dropped');

// Validation.
const bad = readCandidates(files);
bad[0].offices[1].candidacies[0].number = 12345;
bad[0].offices[0].candidacies[0].suplentes = [];
assert.ok(validateCandidates(bad).some((p) => /começa com o número do partido/.test(p)));
assert.ok(validateCandidates(bad).some((p) => /exige 1 Vice-Prefeito/.test(p)));
console.log('PASS: edit, remove and add candidates and parties; validation.');
