import { writable } from 'svelte/store';

// Theme: follows the OS color scheme by default, and a saved choice (localStorage) overrides it.
// tokens.css styles an explicit data-theme, so the resolved value shown is always 'light' or 'dark'.
const KEY = 'urnaemu:tema';
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function savedChoice() {
	try {
		const v = localStorage.getItem(KEY);
		return v === 'light' || v === 'dark' ? v : null;
	} catch {
		return null;
	}
}
const osTheme = () => (mq?.matches ? 'dark' : 'light');

// Resolved theme actually applied: the saved override, or the OS scheme.
export const theme = writable(savedChoice() ?? osTheme());

// Apply to the document. Persist only an explicit user choice (theme.set, below), not the OS default.
let persist = false;
theme.subscribe((value) => {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = value;
	if (persist) {
		try {
			localStorage.setItem(KEY, value);
		} catch {}
	}
	persist = false;
});

const apply = theme.set;
// A user choice overrides the OS and is remembered.
theme.set = (value) => {
	persist = true;
	apply(value);
};
/** Forget the saved choice and follow the OS color scheme again. */
export function followSystem() {
	try {
		localStorage.removeItem(KEY);
	} catch {}
	apply(osTheme());
}

// While there is no saved override, track OS changes live.
mq?.addEventListener('change', () => {
	if (!savedChoice()) apply(osTheme());
});
