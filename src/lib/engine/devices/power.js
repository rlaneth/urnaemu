// One native power snapshot drives both the urna display and the terminal's battery icon.
import { installNativePower } from '../services/native-power.js';

export const POWER_ICONS = [
	'img-ac-bateria-full.jpg',
	'img-ac-bateria-parcial.jpg',
	'img-ac-bateria-critical.jpg',
	'img-ac-sem-bateria.jpg',
	'img-bateria-full.jpg',
	'img-bateria-parcial.jpg',
	'img-bateria-critical.jpg',
	'img-bateria-ext-full.jpg',
	'img-bateria-ext-parcial.jpg',
	'img-bateria-ext-critical.jpg'
];

export function powerIcon(state) {
	const icon = state?.icon;
	if (!Number.isInteger(icon) || icon < 0 || icon > 9) return null;
	return 'assets/power/' + POWER_ICONS[icon];
}

export function createPowerCompanion({ app, log, notify }) {
	let api = null;

	async function install() {
		api = await installNativePower(app);
		notify();
		return api;
	}
	/** Change the simulated supply: source 'mains'|'battery', level 'full'|'partial'|'critical'|'absent'. */
	async function set({ source, level } = {}) {
		if (!api) throw Error('Initialize the runtime before changing native power');
		await api.set({ source: source ?? api.state.source, level: level ?? api.state.level });
		if (powerIcon(api.state) === null) throw Error('Unrecognized native battery icon');
		notify();
		log('simulated-power', api.state);
	}
	async function refresh() {
		if (!api) throw Error('Native power adapter unavailable');
		await api.refresh();
		notify();
	}

	return { install, set, refresh, render: notify };
}
