import fs from 'node:fs';
import assert from 'node:assert/strict';
import { titleCheckDigits, validTitle, addFictitiousVoters } from '#lib/engine/load/eleitorado-generator.js';
import { readEleitorado } from '#lib/engine/load/eleitorado.js';

// Real titles from the bundled loads.
assert.ok(validTitle('010309782003'));
assert.ok(validTitle('010320642046'));
assert.equal(titleCheckDigits('01030978', '20'), '03');
assert.ok(!validTitle('010309782004'));

const dir = new URL('../fixtures/bases/geral-t1/dsk/fi/estatico/', import.meta.url);
const name = fs.readdirSync(dir).find((n) => n.endsWith('-el.dat'));
const original = new Uint8Array(fs.readFileSync(new URL(name, dir)));
const { bytes, voters } = addFictitiousVoters(original, { count: 25, seed: 3 });
const all = readEleitorado([[name, bytes]]);
assert.equal(all.length, 26);
assert.equal(all[0].title, '010309782003', 'the bundled voter is kept first');
assert.deepEqual(all.slice(1).map((v) => v.title), voters.map((v) => v.title));
assert.ok(all.every((v) => validTitle(v.title)));
assert.equal(new Set(all.map((v) => v.title)).size, 26);
assert.deepEqual(addFictitiousVoters(original, { count: 25, seed: 3 }).voters, voters, 'seeded and reproducible');
console.log(`PASS: valid titles; 25 fictitious voters added (e.g. ${voters[0].title} ${voters[0].name}).`);

import { parseVotersCsv, votersToCsv, setVoters } from '#lib/engine/load/eleitorado-generator.js';
{
	const csv = 'Título;Nome;Data de nascimento\n0103 0978 2003;"Abadia dos Anjos";20/07/1960\n7000300120;Maria Teste;1990-05-17\n';
	const { voters, problems } = parseVotersCsv(csv);
	assert.deepEqual(problems, []);
	assert.deepEqual(voters, [
		{ title: '010309782003', name: 'Abadia dos Anjos', birth: '19600720', cpf: '' },
		{ title: '700030012089', name: 'Maria Teste', birth: '19900517', cpf: '' }
	]);
	assert.deepEqual(parseVotersCsv(votersToCsv(voters)).voters, voters, 'CSV round trip');
	const bad = parseVotersCsv('010309782004,Fulano,1990\n');
	assert.equal(bad.problems.length, 2);
	assert.match(bad.problems[0], /^Linha 1 do CSV: título inválido/);
	const written = readEleitorado([[name, setVoters(original, voters)]]);
	assert.deepEqual(written.map((v) => v.title), voters.map((v) => v.title));
	assert.equal(written[1].name, 'MARIA TESTE');
	assert.throws(() => setVoters(original, []), /pelo menos um eleitor/);
	console.log('PASS: CSV import/export, validation messages and manual eleitorado.');
}

// CPF: identifier [1] in the -el.dat (verified against VOTA), check digits, CSV column.
{
	const { cpfCheckDigits, validCpf } = await import('#lib/engine/load/eleitorado-generator.js');
	assert.equal(cpfCheckDigits('529982247'), '25');
	assert.ok(validCpf('52998224725') && !validCpf('52998224724') && !validCpf('11111111111'));
	const { voters, problems } = parseVotersCsv('titulo,nome,nascimento,cpf\n010309782003,Abadia,19600720,529.982.247-25\n');
	assert.deepEqual(problems, []);
	assert.equal(voters[0].cpf, '52998224725');
	assert.match(parseVotersCsv('titulo,nome,nascimento,cpf\n010309782003,Abadia,19600720,52998224724\n').problems[0], /CPF inválido/);
	const bytes = setVoters(original, voters);
	const { readEleitorado } = await import('#lib/engine/load/eleitorado.js');
	assert.equal(readEleitorado(new Map([['/dsk/fi/estatico/x-el.dat', bytes]]))[0].cpf, '52998224725');
	console.log('PASS: CPF check digits, CSV column and [1] identifier round trip.');
}
