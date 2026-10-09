// Start-screen preferences: how UrnaEmu starts. Saved in local storage when the user asks;
// later visits start directly with them until reset from the Sessão menu.
import { searchFor, TRAINING_SESSION_FLAGS, DEFAULT_SCENARIO } from '../engine/options.js';
import { putStored, storedFile, deleteStored } from '../engine/assets.js';

const KEY = 'urnaemu:inicio:v1';
const MEDIA_PATH = 'inicio/midia.vota-load.json';

export const DEFAULT_PREFS = { mode: 'treinamento', scenario: DEFAULT_SCENARIO, clock: 'election', customClock: '', remember: true };

export function loadPrefs() {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return saved ? { ...DEFAULT_PREFS, ...saved } : null;
	} catch {
		return null;
	}
}
export function savePrefs(prefs) {
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {}
}
export async function clearPrefs() {
	try {
		localStorage.removeItem(KEY);
	} catch {}
	await deleteStored(MEDIA_PATH).catch(() => {});
}

/** The uploaded media package (IndexedDB: packages are several MB). */
export const storeMedia = (text) => putStored(MEDIA_PATH, new Blob([text], { type: 'application/json' }));
export async function storedMedia() {
	const blob = await storedFile(MEDIA_PATH).catch(() => null);
	return blob ? blob.text() : null;
}

/** URL query that starts UrnaEmu as the preferences describe. */
export function queryFor(prefs) {
	const clock = prefs.clock === 'custom' && prefs.customClock ? new Date(prefs.customClock).toISOString() : prefs.clock;
	const options = { scenario: prefs.scenario, clock };
	if (prefs.mode === 'treinamento') for (const flag of TRAINING_SESSION_FLAGS) options[flag] = true;
	if (prefs.mode === 'oficial') options.start = 'official';
	if (prefs.mode === 'midia') options.start = 'import';
	return searchFor(options);
}
