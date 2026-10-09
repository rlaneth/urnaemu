import { getContext, setContext } from 'svelte';

const KEY = Symbol('urnaemu');

/** Share the engine (`app`) and its snapshot store (`engine`) with all components. */
export function provideEngine(value) {
	setContext(KEY, value);
}

/** @returns {{ app: any, engine: import('svelte/store').Readable<any>, ui: any }} */
export function useEngine() {
	return getContext(KEY);
}

/** Run an engine action, routing failures to the engine's error banner. */
export function action(app, fn) {
	return async (...args) => {
		try {
			return await fn(...args);
		} catch (error) {
			app.fail(error);
		}
	};
}
