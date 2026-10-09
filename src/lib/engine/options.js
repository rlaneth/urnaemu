// Boot options live in the URL (and sessionStorage for staged media). The engine is a
// per-page singleton: changing options means a full reload into a fresh runtime.
// Eleições Gerais, 1º turno: the most complete ballot (six offices).
export const DEFAULT_SCENARIO = 'geral-t1';

const FLAGS = ['session', 'fullSession', 'testgap', 'persist', 'crypto', 'testkey', 'loadDraft'];

// Training-phase session with every test service. `fullSession` (native result media
// and closure) is only valid with official-phase media; the load editor sets it when
// applying generated official media.
export const TRAINING_SESSION_FLAGS = ['session', 'testgap', 'persist', 'crypto', 'testkey'];

export function readOptions(search = location.search) {
	const params = new URLSearchParams(search);
	const options = {
		scenario: params.get('scenario') || DEFAULT_SCENARIO,
		voice: params.get('voice') === '1'
	};
	for (const flag of FLAGS) options[flag] = params.get(flag) === '1';
	// Start-screen choices: clock preset ('real' | 'election' | ISO time), and a follow-up
	// after boot ('official': open the Mídia de carga window to prepare the official media;
	// 'import': apply the uploaded media package).
	options.clock = params.get('clock');
	options.start = params.get('start');
	return options;
}

export function searchFor(options) {
	const params = new URLSearchParams();
	params.set('scenario', options.scenario || DEFAULT_SCENARIO);
	if (options.voice) params.set('voice', '1');
	for (const flag of FLAGS) if (options[flag]) params.set(flag, '1');
	if (options.clock) params.set('clock', options.clock);
	if (options.start) params.set('start', options.start);
	return params.toString();
}

/** Reload into a fresh runtime with the given options. */
export function reboot(options) {
	location.search = searchFor(options);
}
