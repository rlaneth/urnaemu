// Tour state shared by the menu and the overlay. A tour that needs a fresh training session
// restarts the emulator and resumes after the reload (sessionStorage).
import { DEFAULT_PREFS, queryFor } from '../launcher/prefs.js';

const RESUME_KEY = 'urnaemu:tour';

// `problem`: why the tour cannot run in this session, checked once when it starts (undefined: not yet).
export const tour = $state({ id: null, step: 0, busy: false, error: null, problem: undefined });

export function startTour(id) {
	Object.assign(tour, { id, step: 0, busy: false, error: null, problem: undefined });
}
export function stopTour() {
	Object.assign(tour, { id: null, step: 0, busy: false, error: null, problem: undefined });
}
/** Restart in a new training session of the scenario, then resume the tour. */
export function restartForTour(id, scenario) {
	try {
		sessionStorage.setItem(RESUME_KEY, id);
	} catch {}
	location.search = queryFor({ ...DEFAULT_PREFS, mode: 'treinamento', scenario: scenario ?? DEFAULT_PREFS.scenario });
}
/** The tour to resume after a restart (read once). */
export function takePendingTour() {
	try {
		const id = sessionStorage.getItem(RESUME_KEY);
		sessionStorage.removeItem(RESUME_KEY);
		return id;
	} catch {
		return null;
	}
}
