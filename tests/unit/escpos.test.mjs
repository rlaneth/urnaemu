import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeText, encodeOperation, initialize, rasterQr } from '../../src/lib/engine/devices/escpos.js';

test('Portuguese text maps to each character table', () => {
	assert.deepEqual(encodeText('ção', 'cp850'), [0x87, 0xc6, 0x6f]);
	assert.deepEqual(encodeText('ção', 'cp860'), [0x87, 0x84, 0x6f]);
	assert.deepEqual(encodeText('ção', 'wpc1252'), [0xe7, 0xe3, 0x6f]);
	// Missing characters: typographic ASCII fallback, accent dropped, otherwise '?'.
	assert.deepEqual(encodeText('a — b', 'cp850'), [0x61, 0x20, 0x2d, 0x20, 0x62]);
	assert.deepEqual(encodeText('—“…”', 'wpc1252'), [0x97, 0x93, 0x85, 0x94]);
	assert.deepEqual(encodeText('ŝ✓', 'cp850'), [0x73, 0x3f]);
});

test('setup selects the table; centered text and cut', () => {
	assert.deepEqual([...initialize('cp860')], [0x1b, 0x40, 0x1b, 0x74, 3, 0x1b, 0x61, 0]);
	const centered = encodeOperation({ kind: 'text', text: 'BU', textAttribute: 2, style: 0 });
	assert.deepEqual([...centered], [0x1b, 0x61, 1, 0x42, 0x55, 0x0a, 0x1b, 0x61, 0]);
	assert.deepEqual([...encodeOperation({ kind: 'cut' })], [0x1d, 0x56, 66, 3]);
	assert.equal(encodeOperation({ kind: 'begin' }).length, 0);
});

test('QR bitmap becomes a scaled GS v 0 raster, MSB first', () => {
	// 2×2 bitmap: top-left and bottom-right black (row-major, LSB first).
	const op = { kind: 'qr', encoding: 'row-major-lsb-first-1-black', width: 2, height: 2, bytes: Uint8Array.of(0b1001) };
	const out = rasterQr(op, 16); // about half the paper width: scale 4 → 8×8 dots, 1 byte per row
	const header = [0x1b, 0x61, 1, 0x1d, 0x76, 0x30, 0, 1, 0, 8, 0];
	assert.deepEqual([...out.slice(0, header.length)], header);
	const rows = [...out.slice(header.length, header.length + 8)];
	assert.deepEqual(rows, [0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f]);
});
