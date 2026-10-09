// Interface state shared by the menu bar and the workspace (not engine state).

// Tool windows: each floats over the workspace on its own and starts closed.
export const WINDOWS = ['explicacao', 'dados', 'automatica', 'registro', 'sessao', 'dev', 'bobina', 'relogio', 'carga', 'arquivos', 'instantaneos'];

export const ui = $state({
	open: Object.fromEntries(WINDOWS.map((id) => [id, false])),
	snapshotTab: 'instantaneo',
	// Start screen: null, 'required' (nothing to boot yet) or 'manual' (reopened, closable).
	launcher: null,
	dialog: null
});

/** Open a tool window (or bring it to the front). */
export function showPanel(id) {
	if (id === 'fidelidade') ui.dialog = 'fidelity';
	else if (id in ui.open) {
		// Reopening an open window brings it to the front (FloatingPanel raises on open).
		if (ui.open[id]) ui.open[id] = false;
		queueMicrotask(() => (ui.open[id] = true));
	}
}
export function toggleWindow(id) {
	if (ui.open[id]) ui.open[id] = false;
	else showPanel(id);
}

// The former "modo desenvolvedor" toggle is now the Desenvolvedor window.
try {
	localStorage.removeItem('urnaemu:desenvolvedor');
	localStorage.removeItem('urnaemu:painel:v1');
} catch {}
