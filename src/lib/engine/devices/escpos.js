// ESC/POS encoding of the urna's captured paper operations, for a physical thermal printer.
// Pure functions (no DOM, no I/O): see serial-printer.js for the Web Serial transport.
//
// Mapping: each `text` operation is one printed line (centered when VOTA's text attribute is
// 2, as on screen); `newline` feeds a blank line; `qr` is VOTA's own bitmap printed as a
// raster image (GS v 0), centered and scaled up by whole dots; `cut` feeds past the cutter
// and cuts (GS V). Other operations carry nothing printable.

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

const WIN1252_HIGH = new Map([...'€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'].map((ch, i) => [ch.codePointAt(0), 0x80 + i]));

// Typographic characters a table lacks are printed as their closest ASCII form.
const FALLBACK = { '—': '-', '–': '-', '‐': '-', '−': '-', '‘': "'", '’': "'", '‚': ',', '“': '"', '”': '"', '„': '"', '…': '...', '•': '*', '·': '.', '\u00a0': ' ', '€': 'EUR', '™': 'TM' };

/** Character tables selectable with ESC t n. Only characters used in Portuguese need mapping. */
export const CODE_PAGES = {
	// Windows-1252 ("WPC1252" on Epson-compatible printers): Latin-1 plus typography at 0x80–0x9F.
	wpc1252: { n: 16, map: (c) => (c <= 0xff && (c < 0x80 || c >= 0xa0) ? c : (WIN1252_HIGH.get(c) ?? null)) },
	// IBM 850 (multilingual Latin-1), the most widely available table with Portuguese.
	cp850: { n: 2, map: tableMap('ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´') },
	// IBM 860 (Portuguese).
	cp860: { n: 3, map: tableMap('ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»') }
};

function tableMap(upper) {
	// `upper` lists the characters at 0x80, 0x81, … of an IBM code page.
	const table = new Map([...upper].map((ch, i) => [ch.codePointAt(0), 0x80 + i]));
	return (c) => (c < 0x80 ? c : table.get(c) ?? null);
}

/** Text to printer bytes in the chosen table; missing characters fall back to ASCII forms, lose their accent, or become '?'. */
export function encodeText(text, codePage = 'cp850') {
	const { map } = CODE_PAGES[codePage] ?? CODE_PAGES.cp850;
	const out = [];
	for (const ch of text) {
		const b = map(ch.codePointAt(0));
		if (b != null) {
			out.push(b);
			continue;
		}
		if (FALLBACK[ch]) {
			out.push(...[...FALLBACK[ch]].map((c) => map(c.codePointAt(0)) ?? 0x3f));
			continue;
		}
		const plain = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		out.push((plain.length === 1 ? map(plain.codePointAt(0)) : null) ?? 0x3f);
	}
	return out;
}

/** Printer setup: reset, character table, left alignment. */
export function initialize(codePage = 'cp850') {
	return Uint8Array.from([ESC, 0x40, ESC, 0x74, (CODE_PAGES[codePage] ?? CODE_PAGES.cp850).n, ESC, 0x61, 0]);
}

/** VOTA's QR bitmap (row-major, LSB first, 1 = black) as a GS v 0 raster, scaled by whole dots. */
export function rasterQr(op, maxDots) {
	const width = op.width, scale = Math.max(1, Math.min(8, Math.floor(maxDots / width), Math.max(op.scale || 1, Math.floor(maxDots / 2 / width))));
	const dots = width * scale, rowBytes = Math.ceil(dots / 8), image = new Uint8Array(rowBytes * dots);
	for (let y = 0; y < dots; y++)
		for (let x = 0; x < dots; x++) {
			const bit = Math.floor(y / scale) * width + Math.floor(x / scale);
			if (op.bytes[bit >> 3] & (1 << (bit & 7))) image[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
		}
	return Uint8Array.from([ESC, 0x61, 1, GS, 0x76, 0x30, 0, rowBytes & 0xff, rowBytes >> 8, dots & 0xff, dots >> 8, ...image, LF, ESC, 0x61, 0]);
}

/**
 * Bytes for one captured operation. `paperDots` is the printable width in dots
 * (384 for 58 mm paper, 576 for 80 mm at 203 dpi).
 */
export function encodeOperation(op, { codePage = 'cp850', paperDots = 576 } = {}) {
	if (op.kind === 'text') return Uint8Array.from([ESC, 0x61, op.textAttribute === 2 ? 1 : 0, ...encodeText(op.text, codePage), LF, ESC, 0x61, 0]);
	if (op.kind === 'newline') return Uint8Array.of(LF);
	if (op.kind === 'cut') return Uint8Array.from([GS, 0x56, 66, 3]); // feed 3 lines past the cutter, partial cut
	if (op.kind === 'qr' && op.encoding === 'row-major-lsb-first-1-black' && Number.isInteger(op.width) && op.bytes?.length >= Math.ceil((op.width * op.width) / 8)) return rasterQr(op, paperDots);
	return new Uint8Array(0);
}

/** A short test page: accents in the selected table, centering, and a cut. */
export function testPage(codePage = 'cp850') {
	const lines = [
		[ESC, 0x61, 1, ...encodeText('UrnaEmu - teste de impressão', codePage), LF],
		[ESC, 0x61, 0, ...encodeText('Acentos: á à â ã é ê í ó ô õ ú ç', codePage), LF],
		[...encodeText('Maiúsculas: Á Â Ã É Ê Í Ó Ô Õ Ú Ç', codePage), LF],
		[...encodeText('Se algum acento saiu errado, troque a', codePage), LF],
		[...encodeText('tabela de caracteres.', codePage), LF, LF],
		[GS, 0x56, 66, 3]
	];
	return Uint8Array.from([...initialize(codePage), ...lines.flat()]);
}
