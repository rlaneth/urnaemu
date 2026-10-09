// Minimal ZIP reader (central directory; stored and deflate entries) for the urna's .jez
// log archives and result packages. Deflate uses the platform's DecompressionStream.
export async function readZip(bytes) {
	bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let eocd = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
		if (view.getUint32(i, true) === 0x06054b50) {
			eocd = i;
			break;
		}
	if (eocd < 0) throw Error('Not a ZIP archive');
	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);
	const entries = [];
	for (let n = 0; n < count; n++) {
		if (view.getUint32(at, true) !== 0x02014b50) throw Error('Invalid ZIP central directory');
		const method = view.getUint16(at + 10, true);
		const compressed = view.getUint32(at + 20, true);
		const size = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
		const local = view.getUint32(at + 42, true);
		const name = new TextDecoder('windows-1252').decode(bytes.subarray(at + 46, at + 46 + nameLength));
		at += 46 + nameLength + extra + comment;
		if (view.getUint32(local, true) !== 0x04034b50) throw Error('Invalid ZIP local header');
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const data = bytes.subarray(start, start + compressed);
		entries.push({ name, method, size, compressed, read: () => inflate(method, data, size) });
	}
	return entries;
}

async function inflate(method, data, size) {
	if (method === 0) return data.slice();
	if (method !== 8) throw Error(`Unsupported ZIP compression method ${method}`);
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	const out = new Uint8Array(await new Response(stream).arrayBuffer());
	if (out.length !== size) throw Error('ZIP entry size mismatch');
	return out;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();
function crc32(bytes) {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function dosTime(date) {
	const d = date ?? new Date();
	return {
		time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
		date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
	};
}
async function deflate(bytes) {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Build a ZIP (deflate when smaller, otherwise stored) from {name, bytes, mtime} entries. */
export async function writeZip(entries) {
	const encoder = new TextEncoder();
	const chunks = [], central = [];
	let offset = 0;
	for (const entry of entries) {
		const name = encoder.encode(entry.name);
		const compressed = await deflate(entry.bytes);
		const stored = compressed.length >= entry.bytes.length;
		const data = stored ? entry.bytes : compressed;
		const crc = crc32(entry.bytes), { time, date } = dosTime(entry.mtime);
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		local.setUint16(4, 20, true);
		local.setUint16(6, 0x0800, true); // UTF-8 names
		local.setUint16(8, stored ? 0 : 8, true);
		local.setUint16(10, time, true);
		local.setUint16(12, date, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, data.length, true);
		local.setUint32(22, entry.bytes.length, true);
		local.setUint16(26, name.length, true);
		chunks.push(new Uint8Array(local.buffer), name, data);
		const head = new DataView(new ArrayBuffer(46));
		head.setUint32(0, 0x02014b50, true);
		head.setUint16(4, 20, true);
		head.setUint16(6, 20, true);
		head.setUint16(8, 0x0800, true);
		head.setUint16(10, stored ? 0 : 8, true);
		head.setUint16(12, time, true);
		head.setUint16(14, date, true);
		head.setUint32(16, crc, true);
		head.setUint32(20, data.length, true);
		head.setUint32(24, entry.bytes.length, true);
		head.setUint16(28, name.length, true);
		head.setUint32(42, offset, true);
		central.push(new Uint8Array(head.buffer), name);
		offset += 30 + name.length + data.length;
	}
	const centralSize = central.reduce((n, c) => n + c.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, entries.length, true);
	end.setUint16(10, entries.length, true);
	end.setUint32(12, centralSize, true);
	end.setUint32(16, offset, true);
	const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}
