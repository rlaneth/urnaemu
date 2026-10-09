// Physical ESC/POS printer over Web Serial. Only printers exposed as a serial port work
// (USB-serial adapters and USB printers with a CDC/virtual COM interface, Bluetooth SPP,
// RS-232); printers that only offer a raw USB printer interface are not reachable here.
// Every operation VOTA prints is sent as it is captured, independently of the on-screen
// paper animation: the physical printer feeds at its own speed.
import { encodeOperation, initialize, testPage } from './escpos.js';

const SETTINGS_KEY = 'urnaemu:impressora-fisica:v1';
export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
export const PAPER_WIDTHS = { 58: 384, 80: 576 };
const DEFAULTS = { baudRate: 9600, codePage: 'cp850', paper: 80 };

function readSettings() {
	try {
		return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
	} catch {
		return { ...DEFAULTS };
	}
}

export function createSerialPrinter({ app, log, notify }) {
	const state = {
		supported: typeof navigator !== 'undefined' && 'serial' in navigator,
		status: 'disconnected', // disconnected | connecting | connected | error
		error: null,
		openFailed: false, // the port exists but the system refused to open it
		port: null, // { usbVendorId, usbProductId } when known
		sent: 0, // operations already sent
		bytes: 0,
		settings: readSettings()
	};
	let port = null, writer = null, timer = 0, chain = Promise.resolve();

	function set(fields) {
		Object.assign(state, fields);
		notify();
	}
	function saveSettings(fields) {
		state.settings = { ...state.settings, ...fields };
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
		} catch {}
		notify();
	}
	// Writes are serialized; a failed write disconnects and reports the error.
	function write(bytes) {
		if (!bytes.length) return chain;
		chain = chain.then(async () => {
			if (!writer) return;
			await writer.write(bytes);
			state.bytes += bytes.length;
		}).catch((error) => fail(error));
		return chain;
	}
	function operations() {
		return app.paperCapture?.state.operations ?? [];
	}
	// Send whatever VOTA printed since the last pump.
	function pump() {
		const ops = operations();
		if (state.sent > ops.length) state.sent = 0; // capture was reset
		if (state.sent === ops.length) return;
		const options = { codePage: state.settings.codePage, paperDots: PAPER_WIDTHS[state.settings.paper] ?? 576 };
		const parts = ops.slice(state.sent).map((op) => encodeOperation(op, options));
		state.sent = ops.length;
		const total = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
		let at = 0;
		for (const p of parts) total.set(p, (at += p.length) - p.length);
		write(total);
		notify();
	}

	async function connect({ fromStart = false } = {}) {
		if (!state.supported) throw Error('Web Serial indisponível neste navegador');
		set({ status: 'connecting', error: null });
		try {
			port = await navigator.serial.requestPort();
			await port.open({ baudRate: Number(state.settings.baudRate) });
			writer = port.writable.getWriter();
			const info = port.getInfo?.() ?? {};
			set({ status: 'connected', openFailed: false, port: { usbVendorId: info.usbVendorId ?? null, usbProductId: info.usbProductId ?? null }, bytes: 0, sent: fromStart ? 0 : operations().length });
			await write(initialize(state.settings.codePage));
			log('serial-printer', { event: 'connected', ...state.port, baudRate: state.settings.baudRate });
			timer = setInterval(pump, 200);
			pump();
		} catch (error) {
			await close();
			// Closing the port chooser is not an error; anything else is shown to the user.
			if (error?.name === 'NotFoundError') set({ status: 'disconnected', error: null });
			else {
				log('serial-printer', { event: 'open-failed', error: String(error?.message ?? error) });
				set({ status: 'error', error: String(error?.message ?? error), openFailed: error?.name === 'NetworkError' || /open/i.test(String(error?.message)) });
			}
		}
	}
	async function close() {
		clearInterval(timer);
		timer = 0;
		try {
			await chain;
			writer?.releaseLock();
			await port?.close();
		} catch {}
		writer = null;
		port = null;
	}
	async function disconnect() {
		await close();
		set({ status: 'disconnected', port: null });
		log('serial-printer', { event: 'disconnected' });
	}
	function fail(error) {
		log('serial-printer', { event: 'error', error: String(error?.message ?? error) });
		close().then(() => set({ status: 'error', error: String(error?.message ?? error) }));
	}
	/** Print everything captured so far again (e.g. after connecting late). */
	function reprint() {
		state.sent = 0;
		write(initialize(state.settings.codePage));
		pump();
	}
	function test() {
		return write(testPage(state.settings.codePage));
	}

	return { state, connect, disconnect, reprint, test, saveSettings };
}
