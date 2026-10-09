// Simulated thermal printer: paints captured native report operations onto a paper roll
// and feeds it at an adjustable speed. Native report calls await `waitForPaper()`, so the
// feed paces VOTA exactly like a real printer would (timing itself is simulated).
import { installNativePaperCapture } from '../services/native-paper-capture.js';

// Feed speed at 1× ("Padrão"). There is no published speed for the urna's printer; 100 mm/s
// is a mid-range estimate for embedded thermal mechanisms (typically 50–150 mm/s). The paper
// is laid out in CSS millimetres (80 mm wide), so mm convert to CSS pixels at 96/25.4.
export const FEED_MM_PER_SECOND = 100;
export const CSS_PX_PER_MM = 96 / 25.4;
export const FEED_PIXELS_PER_SECOND = FEED_MM_PER_SECOND * CSS_PX_PER_MM;
export const SPEED_STORAGE_KEY = 'urnaemu:impressora:velocidade';
export const SPEED_PRESETS = [1, 2, 5, Infinity];
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 10;

// Nominal heights used when the paper is not on screen (hidden panel, background tab).
const LINE_HEIGHT = 15.6;
const QR_MARGIN = 36;

function readSpeed() {
	try {
		const stored = localStorage.getItem(SPEED_STORAGE_KEY);
		if (stored === 'instant') return Infinity;
		const value = Number(stored);
		if (Number.isFinite(value) && value >= SPEED_MIN && value <= SPEED_MAX) return value;
	} catch {}
	return 1;
}

export function createPrinter({ app, log, notify }) {
	let api = null, visibleFrom = 0, rendered = 0, line = null, follow = true, frame = 0, feeding = null, lastTime = 0, target = null;
	let speed = readSpeed(), viewport = null;
	const waiters = [];
	// The engine owns the roll; the printer panel only moves it into place.
	const roll = document.createElement('div');
	roll.className = 'printer-paper';
	roll.dataset.testid = 'printer-paper';

	function newLine() {
		line = document.createElement('div');
		line.className = 'paper-line';
		(target || roll).append(line);
		return line;
	}
	function note(message, className = 'paper-note') {
		const node = document.createElement('div');
		node.className = className;
		node.textContent = message;
		(target || roll).append(node);
		line = null;
		return node;
	}
	function append(op) {
		if (op.kind === 'text') {
			newLine();
			line.style.textAlign = op.textAttribute === 2 ? 'center' : 'left';
			const span = document.createElement('span');
			span.textContent = op.text;
			span.dataset.nativeStyle = String(op.style);
			span.dataset.nativeAttribute = String(op.textAttribute ?? 'unknown');
			span.title = `Estilo nativo ${op.style}, atributo ${op.textAttribute ?? 'desconhecido'}`;
			line.append(span);
		} else if (op.kind === 'newline') newLine();
		else if (op.kind === 'cut') {
			// The cutter separates the paper: one piece ends here and a new one begins.
			const cut = note('', 'paper-cut');
			const mark = document.createElement('span');
			mark.className = 'paper-cut-mark';
			mark.textContent = '✂ corte';
			cut.append(mark);
		}
		else if (op.kind === 'begin') line = null;
		else if (op.kind === 'qr') {
			line = null;
			if (op.encoding !== 'row-major-lsb-first-1-black' || !Number.isInteger(op.width) || op.width < 1 || op.bytes.length < Math.ceil((op.width * op.width) / 8)) {
				note('Operação de QR nativa capturada; formato de bitmap não suportado.');
				return;
			}
			const canvas = document.createElement('canvas');
			canvas.className = 'paper-qr-code';
			canvas.width = canvas.height = op.width;
			canvas.style.width = `${op.width * Math.max(1, Math.min(4, op.scale || 1))}px`;
			canvas.setAttribute('aria-label', `QR code nativo original, ${op.width} por ${op.width} pixels`);
			const context = canvas.getContext('2d');
			context.fillStyle = 'white';
			context.fillRect(0, 0, op.width, op.width);
			context.fillStyle = 'black';
			for (let y = 0; y < op.width; y++)
				for (let x = 0; x < op.width; x++) {
					const bit = y * op.width + x;
					if (op.bytes[bit >> 3] & (1 << (bit & 7))) context.fillRect(x, y, 1, 1);
				}
			(target || roll).append(canvas);
		} else if (op.kind === 'image-unknown' || op.kind === 'drawing-unknown') note('Operação gráfica nativa capturada; o layout de pixels ainda não foi decodificado.');
	}
	function modelHeight(op) {
		if (op.kind === 'text' || op.kind === 'newline') return LINE_HEIGHT;
		if (op.kind === 'qr') return (op.width || 0) * Math.max(1, Math.min(4, op.scale || 1)) + QR_MARGIN;
		if (op.kind === 'cut') return 70; // gap plus margins, see .paper-cut
		return 0;
	}
	function visible() {
		return roll.isConnected && roll.offsetParent !== null;
	}
	function completeWaiters() {
		if (api && rendered === api.state.operations.length && !feeding) for (const resolve of waiters.splice(0)) resolve();
	}
	function paint(flush = false, time = performance.now()) {
		if (!api) return;
		const s = api.state, operations = s.operations;
		if (rendered > operations.length) {
			rendered = visibleFrom = 0;
			roll.replaceChildren();
			line = null;
			feeding = null;
		}
		if (speed === Infinity) flush = true;
		// Limit catch-up after a hidden tab or a busy frame: paper must still feed visibly.
		let budget = flush ? Infinity : Math.min(50, Math.max(0, time - lastTime)) * speed;
		lastTime = time;
		while (rendered < operations.length) {
			if (!feeding) {
				const op = operations[rendered], node = document.createElement('div');
				node.className = 'paper-feed';
				node.style.display = 'flow-root';
				node.style.overflow = 'hidden';
				if (rendered >= visibleFrom) {
					roll.append(node);
					target = node;
					append(op);
					target = null;
				}
				const height = visible() ? node.getBoundingClientRect().height : modelHeight(op);
				// Durations are at 1×; the budget above is scaled by the selected speed.
				feeding = { node, height, elapsed: 0, duration: op.kind === 'begin' ? 450 : op.kind === 'cut' ? 350 : (height / FEED_PIXELS_PER_SECOND) * 1000 };
				node.style.height = '0px';
			}
			const f = feeding, used = Math.min(budget, Math.max(0, f.duration - f.elapsed));
			f.elapsed += used;
			budget -= used;
			f.node.style.height = (f.duration ? f.height * Math.min(1, f.elapsed / f.duration) : f.height) + 'px';
			if (f.elapsed < f.duration) break;
			f.node.style.height = '';
			feeding = null;
			rendered++;
			if (!flush && budget <= 0) break;
		}
		if (follow && viewport) viewport.scrollTop = viewport.scrollHeight;
		completeWaiters();
		notify();
		if (rendered < operations.length && !flush) render();
	}
	function render() {
		if (!frame) {
			if (!lastTime) lastTime = performance.now();
			frame = requestAnimationFrame((time) => {
				frame = 0;
				paint(false, time);
			});
		}
	}
	function flush() {
		cancelAnimationFrame(frame);
		frame = 0;
		paint(true);
	}
	function waitForPaper() {
		if (!api || (rendered === api.state.operations.length && !feeding)) return Promise.resolve();
		render();
		return new Promise((resolve) => waiters.push(resolve));
	}
	async function install() {
		api = await installNativePaperCapture(app);
		api.onUpdate = render;
		api.waitForPaper = waitForPaper;
		render();
		log('printer', 'Simulated paper display attached to original native report calls');
		return api;
	}
	/** Hide paper printed so far; the captured evidence is kept. */
	function clear() {
		if (!api) return;
		cancelAnimationFrame(frame);
		frame = 0;
		visibleFrom = rendered = api.state.operations.length;
		roll.replaceChildren();
		line = null;
		feeding = null;
		lastTime = 0;
		paint(true);
		log('printer-view', 'Visible paper cleared; full captured evidence retained');
	}
	/** Repaint every captured operation from the start (the whole backlog feeds again). */
	function replay() {
		cancelAnimationFrame(frame);
		frame = 0;
		rendered = visibleFrom = 0;
		roll.replaceChildren();
		line = null;
		feeding = null;
		lastTime = 0;
		render();
		notify();
	}
	/** Feed speed multiplier (Infinity = instant). Paper already in the slot keeps its progress. */
	function setSpeed(value) {
		const next = value === 'instant' ? Infinity : Number(value);
		if (next !== Infinity && !(next >= SPEED_MIN && next <= SPEED_MAX)) throw Error(`Velocidade da impressora fora do intervalo (${SPEED_MIN}–${SPEED_MAX}×)`);
		speed = next;
		try {
			localStorage.setItem(SPEED_STORAGE_KEY, next === Infinity ? 'instant' : String(next));
		} catch {}
		if (speed === Infinity) flush();
		else render();
		notify();
	}
	function attach(element) {
		viewport = element;
		element.append(roll);
		if (follow) element.scrollTop = element.scrollHeight;
	}
	function detach(element) {
		if (viewport === element) viewport = null;
		if (roll.parentElement === element) roll.remove();
	}

	return {
		install,
		render,
		flush,
		waitForPaper,
		clear,
		replay,
		setSpeed,
		attach,
		detach,
		roll,
		get speed() {
			return speed;
		},
		get follow() {
			return follow;
		},
		set follow(value) {
			follow = Boolean(value);
			if (follow && viewport) viewport.scrollTop = viewport.scrollHeight;
		},
		get installed() {
			return !!api;
		},
		get pending() {
			return api ? api.state.operations.length - rendered : 0;
		},
		get printing() {
			return !!api && (api.state.active !== null || rendered < api.state.operations.length);
		},
		get visibleOperations() {
			return api ? api.state.operations.length - visibleFrom : 0;
		},
		text: () => api?.text(),
		snapshot: () => api?.snapshot()
	};
}
