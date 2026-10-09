// Terminal do mesário: VOTA supplies the LCD text and the cabin occupancy flag
// (CABINA LIVRE/OCUPADA). The host draws the lamps using the TSE mapping.

/** Wrap import `Ba` (terminal text + busy flag) to decode the original bytes. */
export function installTerminalDecoder({ app, imports, log, rawText, notify }) {
	const originalTerminal = imports.a.Ba;
	imports.a.Ba = (pointer, busy) => {
		originalTerminal(pointer, busy);
		try {
			const memory = new Uint8Array(app.exports.Cb.buffer);
			let end = pointer;
			while (end < memory.length && end - pointer < 8192 && memory[end]) end++;
			const bytes = memory.slice(pointer, end);
			let text, encoding;
			try {
				text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
				encoding = 'UTF-8';
			} catch {
				text = new TextDecoder('windows-1252').decode(bytes);
				encoding = 'Windows-1252 fallback for invalid UTF-8 bytes';
			}
			app.terminalText = text;
			app.terminalBusy = Boolean(busy);
			app.terminalEncoding = encoding;
			app.terminalRaw = rawText();
			notify();
		} catch (error) {
			log('terminal-decode', String(error));
		}
	};
}

/** LCD contents: decoded text while it matches the bridge output, otherwise the raw bridge text. */
export function terminalLines(app, raw) {
	const text = app.terminalRaw === raw ? app.terminalText : raw;
	// Blank until VOTA writes to the terminal: the emulator adds no text of its own.
	return (text || '').split('\n').slice(0, 4);
}

export function terminalLamps(app) {
	const session = app.session;
	const active = !!session?.enabled && !session.booting && !session.closed && !session.operatorFinished;
	const battery = app.power?.state.source === 'battery' && app.power.state.level !== 'absent';
	const critical = battery && app.power.state.level === 'critical';
	return {
		liberado: active && app.terminalBusy === false,
		aguarde: active && app.terminalBusy === true,
		bateria: battery,
		// Steady on internal battery; the terminal flashes it only at critical charge.
		bateriaStatus: critical ? 'critical' : battery ? 'battery' : 'off'
	};
}
