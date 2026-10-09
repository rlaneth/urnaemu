// Small, fail-closed reader for the subset of ASN.1 used by the TSE's published schemas
// (bu.asn1, rdv.asn1, assinatura.asn1). Port of tools/tse_schema_reader.py: not a general
// ASN.1 implementation; rejects unsupported syntax, tags, constraints and trailing bytes.
const TAGS = { INTEGER: 2, ENUMERATED: 10, 'OCTET STRING': 4, GeneralString: 27, NumericString: 18, BOOLEAN: 1, SEQUENCE: 48, 'SEQUENCE OF': 48 };
const cp1252 = new TextDecoder('windows-1252');
const ascii = new TextDecoder('ascii');

export class Schema {
	constructor(text) {
		let source = text.replace(/--[^\n]*/g, '');
		if (!source.includes('DEFINITIONS IMPLICIT TAGS ::= BEGIN')) throw Error('Unsupported module tagging');
		source = source.split('EXPORTS ALL;')[1];
		source = source.slice(0, source.lastIndexOf('END'));
		this.tokens = source.match(/::=|\.\.|[A-Za-z][A-Za-z0-9-]*|\d+|[{}(),[\]]/g) ?? [];
		if (source.replace(/\s+/g, '') !== this.tokens.join('')) throw Error('Unsupported schema token');
		this.at = 0;
		this.types = {};
		while (this.at < this.tokens.length) {
			const name = this.pop();
			this.pop('::=');
			this.types[name] = this.type();
		}
	}
	pop(want) {
		const token = this.tokens[this.at++];
		if (want !== undefined && token !== want) throw Error(`Expected ${want}, got ${token}`);
		return token;
	}
	peek() {
		return this.at < this.tokens.length ? this.tokens[this.at] : null;
	}
	type() {
		let tag = null;
		if (this.peek() === '[') {
			this.pop();
			tag = Number(this.pop());
			this.pop(']');
		}
		const kind = this.pop();
		const t = { kind };
		if (kind === 'OCTET') {
			this.pop('STRING');
			t.kind = 'OCTET STRING';
		}
		if (kind === 'SEQUENCE' && this.peek() === 'OF') {
			this.pop();
			t.kind = 'SEQUENCE OF';
			t.element = this.type();
		} else if (['SEQUENCE', 'CHOICE', 'ENUMERATED'].includes(kind)) {
			this.pop('{');
			const fields = [];
			while (this.peek() !== '}') {
				const name = this.pop();
				let field, optional = false;
				if (kind === 'ENUMERATED') {
					this.pop('(');
					field = Number(this.pop());
					this.pop(')');
				} else {
					field = this.type();
					optional = this.peek() === 'OPTIONAL';
					if (optional) this.pop();
				}
				fields.push([name, field, optional]);
				if (this.peek() !== ',') break;
				this.pop();
			}
			this.pop('}');
			t.fields = fields;
		}
		if (this.peek() === '(') {
			this.pop();
			const size = this.peek() === 'SIZE';
			if (size) {
				this.pop();
				this.pop('(');
			}
			const low = Number(this.pop());
			let high = low;
			if (this.peek() === '..') {
				this.pop();
				high = Number(this.pop());
			}
			if (size) this.pop(')');
			this.pop(')');
			t.constraint = [size, low, high];
		}
		if (tag !== null) t.tag = tag;
		return t;
	}
	resolve(t) {
		if (t.kind in this.types) {
			const { kind, ...rest } = t;
			return { ...this.resolve(this.types[kind]), ...rest };
		}
		return t;
	}
	accepted(t) {
		t = this.resolve(t);
		const kind = t.kind;
		if ('tag' in t) {
			if (kind === 'CHOICE') return new Set([160 + t.tag]); // CHOICE gets an explicit wrapper.
			return new Set([(kind.startsWith('SEQUENCE') ? 160 : 128) + t.tag]);
		}
		if (kind === 'CHOICE') return new Set(t.fields.flatMap(([, f]) => [...this.accepted(f)]));
		if (!(kind in TAGS)) throw Error('Unsupported type ' + kind);
		return new Set([TAGS[kind]]);
	}
	decode(name, data, check = true) {
		if (!(name in this.types)) throw Error('Unknown type ' + name);
		return this.value(this.types[name], parseBer(data), name, check);
	}
	value(t, node, path, check) {
		t = this.resolve(t);
		const kind = t.kind;
		let [tag, payload] = node;
		if (!this.accepted(t).has(tag)) throw Error(`${path}: unexpected tag 0x${tag.toString(16)}`);
		if (kind === 'CHOICE') {
			if ('tag' in t) {
				if (payload.length !== 1) throw Error('Invalid explicit CHOICE');
				node = payload[0];
				tag = node[0];
			}
			const matches = t.fields.filter(([, f]) => this.accepted(f).has(tag));
			if (matches.length !== 1) throw Error(path + ': ambiguous CHOICE');
			const [n, f] = matches[0];
			return { [n]: this.value(f, node, path + '.' + n, check) };
		}
		if (kind === 'SEQUENCE') {
			const result = {};
			let i = 0;
			for (const [n, f, optional] of t.fields) {
				if (i >= payload.length || !this.accepted(f).has(payload[i][0])) {
					if (optional) continue;
					throw Error(path + '.' + n + ': missing or mistagged field');
				}
				result[n] = this.value(f, payload[i], path + '.' + n, check);
				i++;
			}
			if (i !== payload.length) throw Error(path + ': extra fields');
			return result;
		}
		if (kind === 'SEQUENCE OF') return payload.map((n, i) => this.value(t.element, n, `${path}[${i}]`, check));
		let value;
		if (kind === 'INTEGER' || kind === 'ENUMERATED') {
			if (!payload.length) throw Error('Empty integer');
			value = signedInteger(payload);
			if (kind === 'ENUMERATED' && !t.fields.some(([, v]) => v === value)) throw Error(path + ': unknown enumeration');
		} else if (kind === 'BOOLEAN') {
			if (payload.length !== 1) throw Error('Invalid boolean');
			value = payload[0] !== 0;
		} else if (kind === 'OCTET STRING') value = payload;
		else {
			value = (kind === 'GeneralString' ? cp1252 : ascii).decode(payload);
			if (kind === 'NumericString' && !/^[0-9 ]*$/.test(value)) throw Error(path + ': invalid NumericString');
		}
		if (check && t.constraint) {
			const [size, lo, hi] = t.constraint;
			const actual = size ? value.length : value;
			if (!(lo <= actual && actual <= hi)) throw Error(`${path}: constraint ${lo}..${hi}, got ${actual}`);
		}
		return value;
	}
}

/** Big-endian two's complement; BigInt beyond the safe integer range (e.g. load codes). */
function signedInteger(bytes) {
	let v = 0n;
	for (const b of bytes) v = (v << 8n) | BigInt(b);
	if (bytes[0] & 0x80) v -= 1n << BigInt(bytes.length * 8);
	return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
}

/** Definite-length BER into [tag, bytes | children] nodes; rejects trailing bytes. */
export function parseBer(data) {
	data = data instanceof Uint8Array ? data : new Uint8Array(data);
	function one(at, end, depth = 0) {
		if (depth > 100 || at + 2 > end) throw Error('Truncated/deep BER');
		const tag = data[at++];
		if ((tag & 31) === 31) throw Error('High BER tags unsupported');
		let n = data[at++];
		if (n & 128) {
			const count = n & 127;
			if (!count || count > 4 || at + count > end) throw Error('Unsupported BER length');
			n = 0;
			for (let i = 0; i < count; i++) n = n * 256 + data[at + i];
			at += count;
		}
		const stop = at + n;
		if (stop > end) throw Error('Truncated BER value');
		let value = data.subarray(at, stop);
		if (tag & 32) {
			value = [];
			while (at < stop) {
				const [child, next] = one(at, stop, depth + 1);
				value.push(child);
				at = next;
			}
		}
		return [[tag, value], stop];
	}
	const [result, end] = one(0, data.length);
	if (end !== data.length) throw Error('Trailing BER bytes');
	return result;
}
