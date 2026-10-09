// Two keypads, one native input function. The TSE web build has a single keyboard: VOTA
// reads every key through wasm_input_get_key / its has-key check, which take from
// Module.uenuxKeys with no device argument. The real urna has two devices, the urna keypad
// and the poll-worker terminal keypad. The router stands in for Module.uenuxKeys with one
// queue per keypad: a native read gets a key only from the keypad of the side of VOTA that
// is running at that moment (declared by the harness around each native entry). Outside a
// declared reader VOTA sees no keys at all, so a terminal key can never reach the voter
// executor, nor an urna key the operator's terminal screens, whatever the timing.
//
// VOTA also calls wasm_input_clear, which assigns a fresh array to Module.uenuxKeys; install()
// makes that property an accessor so the router cannot be replaced, and a clear empties only
// the keypad of the side that asked for it.
export const KEYPADS = ['voter', 'mesario'];

export function createKeyRouter({ log } = {}) {
	const queues = { voter: [], mesario: [] };
	let reader = null; // keypad the running native code may read
	let target = null; // keypad receiving keys pushed by native code (votaPressKey → js_push_key)

	const check = (keypad) => {
		if (!KEYPADS.includes(keypad)) throw Error('Unknown keypad ' + keypad);
		return keypad;
	};
	// The object the vendor runtime uses as Module.uenuxKeys: push / shift / length.
	const native = {
		get length() {
			return reader ? queues[reader].length : 0;
		},
		set length(n) {
			// The vendor only ever empties the queue.
			if (n === 0) for (const k of KEYPADS) queues[k].length = 0;
		},
		shift() {
			return reader ? queues[reader].shift() : undefined;
		},
		push(key) {
			// Keys pushed by the vendor's own document keyboard handler (not installed by
			// UrnaEmu) would come from the urna keyboard of the TSE simulator.
			queues[target ?? 'voter'].push(key);
			return queues[target ?? 'voter'].length;
		},
		*[Symbol.iterator]() {
			yield* queues.voter;
			yield* queues.mesario;
		}
	};

	/** Run native code that may read keys, as the side of VOTA attached to `keypad`. */
	async function as(keypad, run) {
		const previous = reader;
		reader = check(keypad);
		try {
			return await run();
		} finally {
			reader = previous;
		}
	}
	/** Like `as`, unless an outer caller already declared the reader. */
	function asDefault(keypad, run) {
		return reader ? run() : as(keypad, run);
	}
	/** Run native code that pushes a key (votaPressKey), queuing it on `keypad`. */
	async function input(keypad, run) {
		const previous = target;
		target = check(keypad);
		try {
			return await run();
		} finally {
			target = previous;
		}
	}
	/** Make `module.uenuxKeys` always resolve to the router (VOTA's input clear assigns to it). */
	function install(module) {
		Object.defineProperty(module, 'uenuxKeys', {
			configurable: false,
			enumerable: true,
			get: () => native,
			set(value) {
				if (value === native) return;
				// wasm_input_clear: Module.uenuxKeys = [] — empty the reading side's keypad.
				const keys = reader ? queues[reader].splice(0) : [...queues.voter.splice(0), ...queues.mesario.splice(0)];
				if (keys.length) log?.('native-input-clear', { keypad: reader ?? 'all', keys });
				for (const key of Array.isArray(value) ? value : []) native.push(key);
			}
		});
	}
	/** Queue a key on a keypad without entering native code (suspended native menu). */
	function queue(keypad, key) {
		queues[check(keypad)].push(key);
	}
	/** Keys still queued on a keypad. */
	function pending(keypad) {
		return keypad ? queues[check(keypad)].length : queues.voter.length + queues.mesario.length;
	}
	/** Discard what the native side did not read; returns the dropped keys. */
	function drop(keypad, reason) {
		const keys = keypad ? queues[check(keypad)].splice(0) : [...queues.voter.splice(0), ...queues.mesario.splice(0)];
		if (keys.length) log?.('unconsumed-device-key', { keypad: keypad ?? 'all', keys, reason });
		return keys;
	}
	function snapshot() {
		return { reader, voter: [...queues.voter], mesario: [...queues.mesario] };
	}

	return { native, install, as, asDefault, input, queue, pending, drop, snapshot, get reader() { return reader; } };
}
