// VOTA's own log (logd.dat), as written by the original binary into MEMFS.
// The real urna records "date time · level · urna id · component · message · authenticator"
// (the same format a real urna's logd.dat uses). The web build writes simplified "a|b|message" lines with
// no timestamp, id, component or authenticator; we keep the raw fields and add the VOTA
// clock time at which the host observed each line (marked as observed, not recorded).
export const LOGD_PATH = '/dsk/fi/dinamico/log/logd.dat';
const decoder = new TextDecoder('windows-1252');

// Severity is the second field, confirmed from the binary: VOTA logs through func 433
// (logger, level, message) and fixed-level wrappers func 233 (1), func 1398 (2) and
// func 2282 (3). Level 2 carries TSE's documented ALERTA example ("Identificador do eleitor
// digitado inválido"); level 3 carries the "Erro …" messages, including TSE's ERRO example
// "Erro ao decifrar a biometria do eleitor - Código ({})" (func 10478 → func 2282).
// Every call that goes through func 433 uses only 1–3: all constant-level sites, the three
// wrappers, func 5875 (select 2/1) and func 3902 (callers pass 1, 3, 3). Direct virtual calls
// to the logger implementation that bypass func 433 were not ruled out. EXTERNO/TRACE/WHAT
// appear in TSE's examples for other components (e.g. LOGD).
export const LEVELS = {
	1: { name: 'INFO', confirmed: true },
	2: { name: 'ALERTA', confirmed: true },
	3: { name: 'ERRO', confirmed: true }
};

export function parseLogdLine(line) {
	const parts = line.split('|');
	if (parts.length >= 3) {
		const fields = parts.slice(0, 2);
		return { fields, level: LEVELS[fields[1]] ?? { name: `nível ${fields[1]}`, confirmed: false }, message: parts.slice(2).join('|') };
	}
	return { fields: [], level: null, message: line };
}

export function createLogd({ app, notify }) {
	const entries = [];
	let offset = 0, pending = '', revision = 0;

	/** Read any bytes VOTA appended since the last poll. Cheap when nothing changed. */
	function poll() {
		const fs = globalThis.Module?.FS;
		if (!fs) return;
		let size;
		try {
			size = fs.stat(LOGD_PATH).size;
		} catch {
			return;
		}
		if (size < offset) {
			// Truncated or replaced: start over.
			offset = 0;
			pending = '';
			entries.length = 0;
		}
		if (size === offset) return;
		const bytes = fs.readFile(LOGD_PATH).subarray(offset, size);
		offset = size;
		const text = pending + decoder.decode(bytes);
		const lines = text.split('\n');
		pending = lines.pop();
		const observed = new Date(app.clock?.now() ?? Date.now()).toISOString();
		for (const line of lines) if (line) entries.push({ observed, ...parseLogdLine(line), raw: line });
		revision++;
		notify();
	}

	return {
		entries,
		poll,
		get revision() {
			return revision;
		}
	};
}
