// Fictitious eleitorado: adds synthetic voters to the load's -el.dat, cloning the bundled
// voter's record layout. Titles get valid check digits (TSE módulo-11 rule); names and birth
// dates are invented, seeded and reproducible.
import { simulatedBiometricElement, isSimulatedBiometricElement } from './simulated-biometrics.js';
import { VotaLoadFormat as F } from './load-format.js';

const FIRST = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago', 'Valentina', 'Wesley', 'Yasmin', 'Lucas', 'Beatriz', 'Pedro', 'Mariana', 'Gustavo', 'Camila', 'Rodrigo', 'Letícia', 'Vinícius'];
const LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira'];

/** Título eleitoral check digits for an 8-digit sequence and a 2-digit state code. */
export function titleCheckDigits(sequence, uf) {
	const special = uf === '01' || uf === '02'; // SP and MG: remainder 0 becomes 1
	const digit = (sum) => {
		const r = sum % 11;
		return r === 10 ? 0 : r === 0 && special ? 1 : r;
	};
	const d1 = digit([...sequence].reduce((n, c, i) => n + Number(c) * (i + 2), 0));
	const d2 = digit(Number(uf[0]) * 7 + Number(uf[1]) * 8 + d1 * 9);
	return `${d1}${d2}`;
}
/** CPF check digits (módulo 11) for 9 digits. */
export function cpfCheckDigits(nine) {
	const digit = (digits, weight) => {
		const r = (digits.reduce((n, d, i) => n + d * (weight - i), 0) * 10) % 11;
		return r === 10 ? 0 : r;
	};
	const d = [...nine].map(Number), d1 = digit(d, 10), d2 = digit([...d, d1], 11);
	return `${d1}${d2}`;
}
export function validCpf(cpf) {
	return /^\d{11}$/.test(cpf) && !/^(\d)\1{10}$/.test(cpf) && cpfCheckDigits(cpf.slice(0, 9)) === cpf.slice(9);
}
export function validTitle(title) {
	return /^\d{12}$/.test(title) && titleCheckDigits(title.slice(0, 8), title.slice(8, 10)) === title.slice(10);
}

function rng(seed) {
	let x = seed >>> 0 || 1;
	return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Seeded fictitious voters with valid, unused titles in the given state code. */
export function fictitiousVoters({ count, seed = 1, uf, existing = [], electionYear = 2026 }) {
	const taken = new Set(existing);
	const random = rng(seed);
	const voters = [];
	let next = 1;
	while (voters.length < count) {
		const sequence = String(70000000 + seed * 1000 + next++).slice(-8);
		const title = sequence + uf + titleCheckDigits(sequence, uf);
		if (taken.has(title)) continue;
		taken.add(title);
		const name = `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]} ${LAST[Math.floor(random() * LAST.length)]}`.toUpperCase();
		// Ages 18–80 on election day.
		const year = electionYear - 18 - Math.floor(random() * 62);
		const birth = `${year}${String(1 + Math.floor(random() * 12)).padStart(2, '0')}${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`;
		// About half of the fictitious voters also have a CPF (identifier [1] in the -el.dat).
		const cpfBase = String(Math.floor(random() * 1e9)).padStart(9, '0');
		const cpf = random() < 0.5 && !/^(\d)\1{8}$/.test(cpfBase) ? cpfBase + cpfCheckDigits(cpfBase) : '';
		voters.push({ title, name, birth, cpf });
	}
	return voters;
}

/** Problems with a voter list (pt-BR messages), empty when it can be written. */
export function validateVoters(voters) {
	const problems = [], seen = new Set();
	if (!voters.length) problems.push('O eleitorado precisa de pelo menos um eleitor.');
	voters.forEach((v, i) => {
		const row = `Linha ${i + 1}`;
		if (v.simulatedBiometrics !== undefined && typeof v.simulatedBiometrics !== 'boolean') problems.push(`${row}: biometria simulada deve ser sim ou não.`);
		if (!validTitle(v.title)) problems.push(`${row}: título inválido (12 dígitos com dígitos verificadores corretos).`);
		if (seen.has(v.title)) problems.push(`${row}: título repetido.`);
		seen.add(v.title);
		if (v.cpf && !validCpf(v.cpf)) problems.push(`${row}: CPF inválido (11 dígitos com dígitos verificadores corretos).`);
		if (v.cpf && seen.has('cpf:' + v.cpf)) problems.push(`${row}: CPF repetido.`);
		if (v.cpf) seen.add('cpf:' + v.cpf);
		if (!v.name?.trim()) problems.push(`${row}: nome vazio.`);
		if (!/^\d{8}$/.test(v.birth) || Number.isNaN(Date.parse(`${v.birth.slice(0, 4)}-${v.birth.slice(4, 6)}-${v.birth.slice(6, 8)}`))) problems.push(`${row}: data de nascimento inválida (DD/MM/AAAA).`);
	});
	return problems;
}

/**
 * Rewrite the eleitorado of an -el.dat with the given voters, cloning the layout of its
 * first (bundled) record for every voter.
 * @param {Uint8Array} bytes original -el.dat
 * @param {{title: string, name: string, birth: string}[]} voters
 */
export function setVoters(bytes, voters) {
	const problems = validateVoters(voters);
	if (problems.length) throw Error(problems.join(' '));
	const root = F.parse(bytes);
	const list = root.children[2];
	const template = list.children[0];
	if (!template) throw Error('O eleitorado da carga não tem um registro de exemplo');
	list.children = voters.map((voter, i) => {
		const entry = structuredClone(template);
		entry.children[0] = { ...entry.children[0], hex: F.hex(numberBytes(i + 1)) };
		const record = entry.children[1].children = entry.children[1].children.filter(n => !isSimulatedBiometricElement(n));
		// identificacaoEleitor: [0] título, and [1] CPF when the voter has one (verified against VOTA:
		// typing the CPF at "Digite o Título ou o CPF" finds the voter).
		record[0].children = [{ tag: 128, hex: F.hex(new TextEncoder().encode(voter.title)) }];
		if (voter.cpf) record[0].children.push({ tag: 129, hex: F.hex(new TextEncoder().encode(voter.cpf)) });
		F.textBytes(voter.name.trim());
		record[1].text = voter.name.trim().toUpperCase();
		record[3].text = voter.birth;
		if (voter.simulatedBiometrics) record.push(simulatedBiometricElement());
		return entry;
	});
	return F.encode(root);
}

/** Minimal two's-complement INTEGER content for a positive number. */
function numberBytes(n) {
	const out = [];
	do {
		out.unshift(n & 255);
		n >>= 8;
	} while (n);
	if (out[0] & 128) out.unshift(0);
	return Uint8Array.from(out);
}

/** Append seeded fictitious voters to an -el.dat (keeps the existing ones). */
export function addFictitiousVoters(bytes, { count, seed = 1, electionYear = 2026 }) {
	const current = readVoters(bytes);
	const uf = current[0].title.slice(8, 10);
	const voters = fictitiousVoters({ count, seed, uf, existing: current.map((v) => v.title), electionYear });
	return { bytes: setVoters(bytes, [...current, ...voters]), voters };
}

function readVoters(bytes) {
	const ascii = new TextDecoder('ascii');
	return F.parse(bytes).children[2].children.map((e) => {
		const r = e.children[1].children;
		const id = (tag) => r[0].children.find((c) => c.tag === tag);
		return { title: ascii.decode(F.unhex(id(128).hex)), cpf: id(129) ? ascii.decode(F.unhex(id(129).hex)) : '', name: r[1].text, birth: r[3].text, ...(r.some(isSimulatedBiometricElement) ? { simulatedBiometrics: true } : {}) };
	});
}

// ---- CSV ----
const HEADERS = { title: /^(t[ií]tulo|titulo eleitoral|title)$/i, name: /^(nome|name)$/i, birth: /^(nascimento|data de nascimento|birth|birthdate)$/i, cpf: /^cpf$/i, simulatedBiometrics: /^(biometria|biometria simulada|simulatedBiometrics)$/i };

function splitCsvLine(line, separator) {
	const out = [];
	let cell = '', quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			if (c === '"' && line[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === separator) {
			out.push(cell);
			cell = '';
		} else cell += c;
	}
	out.push(cell);
	return out.map((s) => s.trim());
}
function normalizeBirth(text) {
	const s = text.trim();
	let m;
	if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) return `${m[3]}${m[2]}${m[1]}`;
	if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return `${m[1]}${m[2]}${m[3]}`;
	return s.replace(/\D/g, '');
}

/**
 * Parse voters from CSV (comma or semicolon; optional header; title, name, birth columns).
 * Titles may omit their two check digits (10 digits): they are computed.
 * @returns {{voters: {title: string, name: string, birth: string}[], problems: string[]}}
 */
export function parseVotersCsv(text) {
	const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
	if (!lines.length) return { voters: [], problems: ['O arquivo está vazio.'] };
	const separator = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ';' : ',';
	let columns = { title: 0, name: 1, birth: 2, cpf: 3, simulatedBiometrics: 4 }, first = 0;
	const head = splitCsvLine(lines[0], separator);
	if (head.some((h) => Object.values(HEADERS).some((re) => re.test(h)))) {
		columns = Object.fromEntries(Object.entries(HEADERS).map(([key, re]) => [key, head.findIndex((h) => re.test(h))]));
		const missing = Object.entries(columns).filter(([k, i]) => i < 0 && !['cpf', 'simulatedBiometrics'].includes(k)).map(([k]) => ({ title: 'título', name: 'nome', birth: 'nascimento' })[k]);
		if (missing.length) return { voters: [], problems: [`Colunas ausentes no cabeçalho: ${missing.join(', ')}.`] };
		first = 1;
	}
	const voters = lines.slice(first).map((line) => {
		const cells = splitCsvLine(line, separator);
		let title = (cells[columns.title] ?? '').replace(/\D/g, '');
		if (title.length === 10) title += titleCheckDigits(title.slice(0, 8), title.slice(8, 10));
		const cpf = columns.cpf >= 0 ? (cells[columns.cpf] ?? '').replace(/\D/g, '') : '';
		const bio = columns.simulatedBiometrics >= 0 ? (cells[columns.simulatedBiometrics] ?? '').trim().toLowerCase() : '';
		const simulatedBiometrics = /^(sim|true|1)$/.test(bio) ? true : /^(|não|nao|false|0)$/.test(bio) ? undefined : bio;
		return { ...(simulatedBiometrics !== undefined ? { simulatedBiometrics } : {}), title, name: (cells[columns.name] ?? '').trim(), birth: normalizeBirth(cells[columns.birth] ?? ''), cpf };
	});
	return { voters, problems: validateVoters(voters).map((p) => p.replace(/^Linha (\d+)/, (_, n) => `Linha ${Number(n) + first} do CSV`)) };
}

export function votersToCsv(voters) {
	const quote = (s) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
	return ['titulo,nome,nascimento,cpf,biometria', ...voters.map((v) => [v.title, quote(v.name), v.birth, v.cpf ?? '', v.simulatedBiometrics ? 'sim' : 'nao'].join(','))].join('\n') + '\n';
}
