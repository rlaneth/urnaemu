// Diagnostic timeline with two sources, kept apart:
//  - 'vota': native diagnostics emitted by the original binary (diagnostic imports, stdout/stderr);
//  - 'bridge': events from the TSE web wrapper compiled into the same binary (vota:* events);
// VOTA's own log (logd.dat) is tailed separately, see devices/logd.js.
//  - 'host': UrnaEmu's own messages (en-US, for developers), including console output.
const LIMIT = 1200;

export function formatValue(value) {
	return typeof value === 'string'
		? value
		: JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? `${v}n` : v), 2);
}

export function createLog({ onChange } = {}) {
	const entries = [];
	let revision = 0;

	function push(source, kind, ...args) {
		entries.push({
			time: new Date().toISOString(),
			source,
			kind,
			text: args.map(formatValue).join(' ')
		});
		if (entries.length > LIMIT) entries.shift();
		revision++;
		onChange?.();
	}

	/** Clear one source ('vota' | 'host'), or everything. */
	function clear(source) {
		const kept = source ? entries.filter((e) => e.source !== source) : [];
		entries.length = 0;
		entries.push(...kept);
		revision++;
		onChange?.();
	}

	function lines() {
		return entries.map((e) => `${e.time} ${e.source} [${e.kind}] ${e.text}`);
	}

	function captureConsole() {
		for (const kind of ['log', 'warn', 'error', 'debug']) {
			const original = console[kind].bind(console);
			console[kind] = (...args) => {
				original(...args);
				push('host', kind, ...args);
			};
		}
	}

	return {
		entries,
		push,
		clear,
		lines,
		captureConsole,
		get revision() {
			return revision;
		}
	};
}
