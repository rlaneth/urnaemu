// Replace an indirect-call table slot with a JavaScript wrapper. The wrapper is a tiny
// generated wasm function with the slot's signature (i32 params; no result, or one i32 result
// with `{ result: true }`), so native call_indirect sites keep working;
// `callback(original, ...args)` decides what runs.
export function hookTableSlot(table, slot, arity, callback, { result = false } = {}) {
	const leb = (n) => {
		const a = [];
		do {
			let b = n & 127;
			n >>>= 7;
			if (n) b |= 128;
			a.push(b);
		} while (n);
		return a;
	};
	const section = (id, a) => [id, ...leb(a.length), ...a];
	const original = table.get(slot);
	const body = [0, ...Array.from({ length: arity }, (_, i) => [32, i]).flat(), 16, 0, 11];
	const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, ...section(1, [1, 96, arity, ...Array(arity).fill(127), ...(result ? [1, 127] : [0])]), ...section(2, [1, 1, 104, 1, 102, 0, 0]), ...section(3, [1, 0]), ...section(7, [1, 1, 102, 0, 1]), ...section(10, [1, ...leb(body.length), ...body])]);
	table.set(slot, new WebAssembly.Instance(new WebAssembly.Module(bytes), { h: { f: (...args) => callback(original, ...args) } }).exports.f);
	return original;
}
