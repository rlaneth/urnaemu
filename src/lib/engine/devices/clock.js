// Observed imports: a.R = emscripten_date_now, a.ia = clock_time_get,
// a.aa = js_obter_data_hora_local_navegador (seconds with local offset applied).
// Keep monotonic clocks and native JSPI sleep on real elapsed time.
import { VotaLoadFormat } from '../load/load-format.js';

export const CLOCK_STORAGE_KEY = 'vota-session-clock-v1';

export function createNativeClock({ app, log, notify }) {
	let settings = { mode: 'real', iso: new Date().toISOString() }, anchor = performance.now(), installed = false;
	const stats = { dateReads: 0, realtimeReads: 0, localBridgeReads: 0, lastMilliseconds: null };

	function validate(c) {
		if (!c || !['real', 'fixed', 'running'].includes(c.mode) || !Number.isFinite(Date.parse(c.iso))) throw Error('Configuração de relógio inválida');
		const year = new Date(c.iso).getUTCFullYear();
		if (year < 1970 || year > 2100) throw Error('O ano do relógio precisa estar entre 1970 e 2100');
		return { mode: c.mode, iso: new Date(c.iso).toISOString() };
	}
	function now() {
		return settings.mode === 'real' ? Date.now() : Date.parse(settings.iso) + (settings.mode === 'running' ? performance.now() - anchor : 0);
	}
	function configure(c, { save = true } = {}) {
		settings = validate(c);
		anchor = performance.now();
		if (save) sessionStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(settings));
		notify();
		return { ...settings };
	}
	function read() {
		const value = now();
		stats.lastMilliseconds = value;
		return value;
	}
	function install(imports) {
		if (typeof imports.a.R !== 'function' || typeof imports.a.ia !== 'function' || typeof imports.a.aa !== 'function')
			throw Error('Esta versão do VOTA não tem as funções de relógio esperadas pelo emulador');
		const originalClock = imports.a.ia;
		imports.a.aa = () => {
			stats.localBridgeReads++;
			const milliseconds = read();
			return milliseconds / 1000 - new Date(milliseconds).getTimezoneOffset() * 60;
		};
		imports.a.R = () => {
			stats.dateReads++;
			return read();
		};
		imports.a.ia = (id, precision, pointer) => {
			if (id !== 0) return originalClock(id, precision, pointer);
			stats.realtimeReads++;
			const milliseconds = read();
			const whole = Math.trunc(milliseconds);
			const nanoseconds = BigInt(whole) * 1000000n + BigInt(Math.round((milliseconds - whole) * 1000000));
			new DataView(app.exports.Cb.buffer).setBigInt64(pointer, nanoseconds, true);
			return 0;
		};
		installed = true;
		notify();
	}

	/** Apply a clock chosen in the UI; the staged load draft no longer carries its own clock. */
	function apply(c) {
		const result = configure(c);
		app.loadEditor?.clockChanged();
		log('simulated-clock', settings);
		return result;
	}
	/** Apply and restart, keeping a staged draft consistent with the new clock. */
	function applyAndReload(c) {
		configure(c);
		app.loadEditor?.clockChanged();
		if (new URLSearchParams(location.search).get('loadDraft') === '1') {
			const p = JSON.parse(sessionStorage.getItem('vota-load-draft-v1'));
			p.clock = { ...settings };
			delete p.signature;
			sessionStorage.setItem('vota-load-draft-v1', JSON.stringify(p));
		}
		location.reload();
	}
	function reset() {
		return apply({ mode: 'real', iso: new Date().toISOString() });
	}
	/** Election day 08:00 (local) from the loaded election-process file, as a running clock. */
	function electionDayPreset() {
		const cfg = app.sessionConfig || app.bootConfig || {}, files = app.loadEditor?.files;
		const cp = [...(files || [])].find(([p]) => p.endsWith('-cp.dat'));
		if (!cp) throw Error('O arquivo do processo eleitoral (-cp.dat) não está na mídia de carga');
		const t = VotaLoadFormat.parse(cp[1]), date = t.children[cfg.turno === 2 ? 3 : 2].children[2].text;
		if (!/^\d{8}$/.test(date)) throw Error('Data da eleição não reconhecida no arquivo do processo eleitoral');
		const local = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T08:00:00`;
		return { mode: 'running', local, iso: new Date(local).toISOString() };
	}

	try {
		const stored = sessionStorage.getItem(CLOCK_STORAGE_KEY);
		if (stored) settings = validate(JSON.parse(stored));
	} catch (e) {
		log('clock-config-error', String(e));
	}

	return {
		now,
		configure,
		validate,
		install,
		apply,
		applyAndReload,
		reset,
		electionDayPreset,
		stats,
		get installed() {
			return installed;
		},
		get settings() {
			return { ...settings };
		}
	};
}
