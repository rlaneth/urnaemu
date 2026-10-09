// In-memory compatibility patches for the TSE web build of VOTA. The files stay byte-identical
// to the TSE simulator (the vendor hash check still applies); each patch is applied to a copy
// of the bytes before compilation, only to the exact binary it was written for (SHA-256), and
// only where the expected original bytes are found once inside the named function. Every patch
// is documented in src/lib/adaptacoes.js (shown in the emulator under Ajuda › Adaptações).
//
// Patches keep the byte length (instructions are replaced by equivalents of the same size), so
// no section sizes or offsets change.

/** Unsigned LEB128 reader. */
function leb(bytes, at) {
	let value = 0, shift = 0, byte;
	do {
		byte = bytes[at++];
		value += (byte & 0x7f) * 2 ** shift;
		shift += 7;
	} while (byte & 0x80);
	return [value, at];
}

/** Body ranges of every defined function, keyed by function index (imports come first). */
export function functionBodies(bytes) {
	if (bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) throw Error('Not a WebAssembly binary');
	let at = 8, imported = 0;
	const bodies = new Map();
	while (at < bytes.length) {
		const id = bytes[at];
		let size;
		[size, at] = leb(bytes, at + 1);
		const end = at + size;
		if (id === 2) {
			// Import section: count function imports (kind 0).
			let count, p;
			[count, p] = leb(bytes, at);
			for (let i = 0; i < count; i++) {
				let n;
				[n, p] = leb(bytes, p);
				p += n;
				[n, p] = leb(bytes, p);
				p += n;
				const kind = bytes[p++];
				if (kind === 0) {
					[, p] = leb(bytes, p);
					imported++;
				} else if (kind === 1) {
					p++; // reftype
					const flags = bytes[p++];
					[, p] = leb(bytes, p);
					if (flags & 1) [, p] = leb(bytes, p);
				} else if (kind === 2) {
					const flags = bytes[p++];
					[, p] = leb(bytes, p);
					if (flags & 1) [, p] = leb(bytes, p);
				} else if (kind === 3) p += 2;
				else if (kind === 4) p += 2;
				else throw Error('Unknown import kind ' + kind);
			}
		} else if (id === 10) {
			let count, p;
			[count, p] = leb(bytes, at);
			for (let i = 0; i < count; i++) {
				let len;
				[len, p] = leb(bytes, p);
				bodies.set(imported + i, { start: p, end: p + len });
				p += len;
			}
		}
		at = end;
	}
	return bodies;
}

function findAll(bytes, pattern, start, end) {
	const found = [];
	outer: for (let i = start; i <= end - pattern.length; i++) {
		for (let j = 0; j < pattern.length; j++) if (bytes[i + j] !== pattern[j]) continue outer;
		found.push(i);
	}
	return found;
}

/**
 * The patches. `find` must occur exactly once in the function body; `replace` has the same
 * length. Bytes are WebAssembly opcodes (comments give the text form).
 */
export const PATCHES = [
	{
		id: 'thread-alarme-eleitor-demorando',
		func: 5392, // std::thread start for CSuspensaoAutomaticaEleitor::DisparaSinalizacaoSonora()'s lambda
		// global.get 0 (23 00) → return (0f) + unreachable (00): the function returns at once
		// instead of reaching the compiled-in "thread constructor failed" throw.
		find: [0x23, 0x00, 0x41, 0x10, 0x6b],
		replace: [0x0f, 0x00, 0x41, 0x10, 0x6b]
	},
	{
		id: 'justificativa-uso-apos-liberacao',
		func: 10590, // CPedeAnoNascimento input → comum::CJustificador::Justifica / SaveCurrentInternal
		// After `call 1535` (GetIdentidadeEleitor into a temporary), the temporary's título buffer
		// is freed (local.get 6; i32.load; call 136) and then read by CNumeroInscricaoEleitoral.
		// The free (10 88 01) becomes drop + nop + nop (1a 01 01): the buffer is kept.
		find: [0x10, 0xff, 0x0b, 0x20, 0x06, 0x2c, 0x00, 0x0b, 0x41, 0x00, 0x48, 0x04, 0x40, 0x20, 0x06, 0x28, 0x02, 0x08, 0x1a, 0x20, 0x06, 0x28, 0x02, 0x00, 0x10, 0x88, 0x01, 0x0b],
		replace: [0x10, 0xff, 0x0b, 0x20, 0x06, 0x2c, 0x00, 0x0b, 0x41, 0x00, 0x48, 0x04, 0x40, 0x20, 0x06, 0x28, 0x02, 0x08, 0x1a, 0x20, 0x06, 0x28, 0x02, 0x00, 0x1a, 0x01, 0x01, 0x0b]
	},
	{
		id: 'fone-espera-thread-eleitor',
		func: 10435, // vota::CDesabilitaAudioEleitor input ("Retire o fone de ouvido da urna")
		// After CONFIRMA the operator posts message 10 (audio off) to the voter thread and then
		// busy-waits (usleep(300) loop) until the voter side reports status 2. The voter side cannot
		// run during a native call in the single-threaded web build, so the tab froze. The wait's
		// condition `i32.const 2; i32.ne` (41 02 47) becomes `drop; i32.const 0` (1a 41 00): no wait;
		// the voter side handles message 10 on its next run.
		find: [0x10, 0xfd, 0x03, 0x28, 0x02, 0x04, 0x41, 0x02, 0x47, 0x04, 0x40, 0x03, 0x40, 0x41, 0xac, 0x02, 0x10, 0xfe, 0x1e],
		replace: [0x10, 0xfd, 0x03, 0x28, 0x02, 0x04, 0x1a, 0x41, 0x00, 0x04, 0x40, 0x03, 0x40, 0x41, 0xac, 0x02, 0x10, 0xfe, 0x1e]
	}
];

/**
 * Apply PATCHES to a copy of `original`. Returns { bytes, applied: [{id, func, offset}], skipped:
 * [{id, reason}] }. Nothing is changed unless the binary's SHA-256 equals `expectedSha256`.
 */
export async function applyPatches(original, expectedSha256) {
	const input = new Uint8Array(original);
	const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input)), (b) => b.toString(16).padStart(2, '0')).join('');
	if (digest !== expectedSha256) return { bytes: input, applied: [], skipped: PATCHES.map((p) => ({ id: p.id, reason: 'binário diferente do analisado' })), sha256: digest };
	const bytes = input.slice();
	const bodies = functionBodies(bytes);
	const applied = [], skipped = [];
	for (const patch of PATCHES) {
		const body = bodies.get(patch.func);
		if (!body || patch.find.length !== patch.replace.length) {
			skipped.push({ id: patch.id, reason: 'função não encontrada' });
			continue;
		}
		const hits = findAll(bytes, patch.find, body.start, body.end);
		if (hits.length !== 1) {
			skipped.push({ id: patch.id, reason: `${hits.length} ocorrências dos bytes esperados` });
			continue;
		}
		bytes.set(patch.replace, hits[0]);
		applied.push({ id: patch.id, func: patch.func, offset: hits[0] });
	}
	return { bytes, applied, skipped, sha256: digest };
}
