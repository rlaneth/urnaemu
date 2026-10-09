// The snapshot opened in the Instantâneos window, shared by its tabs (large: kept raw, not deep-reactive).
class OpenedSnapshot {
	snapshot = $state.raw(null);
	fileName = $state('');
	source = $state.raw(null);
}
export const opened = new OpenedSnapshot();
