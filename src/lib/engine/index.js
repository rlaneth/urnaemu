// Single engine per page: the VOTA WebAssembly instance, its table hooks and MEMFS
// live for the page's lifetime. Restarting is a reload (see options.js).
import { createEngine } from './controller.js';
import { createEngineStore } from './store.js';
import { VotaLoadFormat } from './load/load-format.js';
import { VotaLoadSignatures } from './load/load-signature.js';
import { generateOfficialLoad } from './load/official-load.js';
import { createWebCryptoProvider } from './services/webcrypto-provider.js';
import { VotaPrinterSpool } from './services/printer-spool.js';
import { createOperatorEventPump } from './session/operator-event-pump.js';

let instance = null;

export function getEngine() {
	if (instance) return instance;
	const store = createEngineStore();
	const app = createEngine({ notify: store.notify });
	// Host libraries for tools and tests that run inside the page.
	app.lib = { VotaLoadFormat, VotaLoadSignatures, generateOfficialLoad, createWebCryptoProvider, VotaPrinterSpool, createOperatorEventPump, printedBu: () => import('../results/printed-bu.js'), identities: () => import('./load/identity-store.js'), candidatePhoto: () => import('./load/candidate-photo.js') };
	store.bind(app);
	// The vendor runtime writes the raw terminal text into #mt directly.
	const mt = document.getElementById('mt');
	if (mt) new MutationObserver(store.notify).observe(mt, { childList: true, characterData: true, subtree: true });
	window.urnaEmu = app;
	instance = { app, store };
	return instance;
}

// Hot-reloading engine modules would install the native table hooks twice.
if (import.meta.hot) import.meta.hot.decline();
