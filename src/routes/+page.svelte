<script>
	import { onMount } from 'svelte';
	import { getEngine } from '#lib/engine/index.js';
	import { provideEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { theme } from '#lib/theme.js';
	import { ISSUES_URL } from '#lib/meta.js';
	import { ui, showPanel, toggleWindow } from '#lib/ui.svelte.js';
	import MenuBar from '#lib/components/shell/MenuBar.svelte';
	import HelpDialogs from '#lib/components/shell/HelpDialogs.svelte';
	import FidelityScreen from '#lib/components/shell/FidelityScreen.svelte';
	import ErrorBanner from '#lib/components/shell/ErrorBanner.svelte';
	import UrnaDevice from '#lib/components/devices/UrnaDevice.svelte';
	import MesarioTerminal from '#lib/components/devices/MesarioTerminal.svelte';
	import FloatingPanel from '#lib/components/ui/FloatingPanel.svelte';
	import StartTimeNotice from '#lib/components/shell/StartTimeNotice.svelte';
	import PausedNotice from '#lib/components/shell/PausedNotice.svelte';
	import PrinterNotice from '#lib/components/shell/PrinterNotice.svelte';
	import FileBrowser from '#lib/components/panels/FileBrowser.svelte';
	import Launcher from '#lib/components/launcher/Launcher.svelte';
	import { probeRuntime, selectSource } from '#lib/engine/assets.js';
	import { loadPrefs, queryFor } from '#lib/launcher/prefs.js';
	import PrinterPanel from '#lib/components/panels/PrinterPanel.svelte';
	import SessionPanel from '#lib/components/panels/SessionPanel.svelte';
	import ClockPanel from '#lib/components/panels/ClockPanel.svelte';
	import LoadMediaWindow from '#lib/components/load/LoadMediaWindow.svelte';
	import VotaLogPanel from '#lib/components/panels/VotaLogPanel.svelte';
	import ExplainerPanel from '#lib/components/panels/ExplainerPanel.svelte';
	import DataPanel from '#lib/components/panels/DataPanel.svelte';
	import SimulatorPanel from '#lib/components/panels/SimulatorPanel.svelte';
	import DevPanel from '#lib/components/panels/DevPanel.svelte';
	import TourOverlay from '#lib/components/tour/TourOverlay.svelte';
	import SnapshotWindow from '#lib/components/panels/SnapshotWindow.svelte';
	import { createSnapshot } from '#lib/engine/snapshot.js';

	const { app, store } = getEngine();
	provideEngine({ app, engine: store });
	// Lets tools and tests bring a panel to the front.
	app.showPanel = showPanel;
	app.openFiles = () => showPanel('arquivos');
	// Verify the result set next to a BU/RDV path (tools and tests).
	app.verifyResults = async (path) => (await import('#lib/results/index.js')).verifyFromDirectory(app, path);
	// Session snapshot of the running session (tools and tests).
	app.createSnapshot = () => createSnapshot(app);
	const s = $derived($store);

	const TOOL_WINDOWS = $derived([
		{ id: 'explicacao', label: t('explainer.title'), initial: { width: 560, height: 620, anchor: 'right', cascade: 0 } },
		{ id: 'dados', label: t('data.title'), initial: { width: 600, height: 640, anchor: 'right', cascade: 1 } },
		{ id: 'automatica', label: t('simulator.title'), initial: { width: 620, height: 640, anchor: 'right', cascade: 2 } },
		{ id: 'registro', label: t('log.title'), initial: { width: 780, height: 560, anchor: 'left', cascade: 1 } },
		{ id: 'sessao', label: t('controls.title'), initial: { width: 480, height: 560, anchor: 'right', cascade: 3 } },
		{ id: 'dev', label: t('dev.title'), initial: { width: 880, height: 600, anchor: 'left', cascade: 2 }, minWidth: 480 }
	]);

	const booting = $derived(!s || s.bootStep !== 'ready');
	const statusTone = $derived(s?.status.code === 'running' ? 'success' : s?.status.code === 'error' || s?.status.code === 'engine-error' ? 'danger' : '');
	const statusKind = $derived(
		{ running: 'play', paused: 'pause', done: 'check', error: 'alert', 'engine-error': 'alert', loading: 'spinner' }[s?.status.code] ?? 'spinner'
	);

	/**
	 * Start screen first: when the VOTA runtime is missing, or when there are no start options
	 * in the URL and no remembered preferences. Remembered preferences become URL options.
	 * Explicit URL options (tools, tests, reloads) boot directly.
	 */
	async function decideStart() {
		// Only the VOTA included in this installation is used for now (uploads are set aside), even
		// if an earlier visit selected uploaded files.
		selectSource('bundled');
		const probe = await probeRuntime();
		const runtimeOk = probe.bundled.ok;
		if (!runtimeOk) return (ui.launcher = 'required');
		if (location.search.length > 1) return app.boot();
		const prefs = loadPrefs();
		if (prefs) return location.replace('?' + queryFor(prefs));
		ui.launcher = 'required';
	}


	// Start screen › Sessão oficial: prepare the official media in the Mídia de carga window.
	let setupShown = false;
	$effect(() => {
		if (s?.ready && app.officialSetup && !setupShown) {
			setupShown = true;
			showPanel('carga');
		}
	});

	onMount(() => {
		decideStart();
		const onKey = (e) => {
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
				e.preventDefault();
				toggleWindow('dev');
			}
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
				e.preventDefault();
				app.exportScreen().catch((error) => app.fail(error));
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<svelte:head>
	<title>UrnaEmu{s?.scenario ? ` · ${s.scenario.label}` : ''}</title>
</svelte:head>

{#snippet statusIcon(kind)}
	<svg
		class="status-icon"
		class:spin={kind === 'spinner'}
		viewBox="0 0 24 24"
		aria-hidden="true"
		fill={kind === 'play' || kind === 'pause' ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if kind === 'spinner'}<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		{:else if kind === 'play'}<polygon points="7 4 20 12 7 20 7 4" />
		{:else if kind === 'pause'}<rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" />
		{:else if kind === 'check'}<path d="M20 6 9 17l-5-5" />
		{:else}<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />{/if}
	</svg>
{/snippet}

<header class="topbar">
	<div class="topbar-inner">
		<div class="brand">
			<!-- "Vote" icon from Lucide (ISC License). -->
			<svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="m9 12 2 2 4-4" />
				<path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
				<path d="M22 19H2" />
			</svg>
			<span class="name">{t('app.name')}</span>
			<span class="beta" title={t('app.betaHint')}>{t('app.beta')}</span>
		</div>
		<MenuBar />
		<div class="spacer"></div>
		<div class="status">
			{#if booting}
				<span class="state accent" data-testid="boot-status" data-step={s?.bootStep}>{@render statusIcon('spinner')}{t(`boot.${s?.bootStep ?? 'discovery'}`)}</span>
			{:else}
				<span class="state {statusTone}" data-testid="run-status" data-status={s.status.code}>{@render statusIcon(statusKind)}{t(`status.${s.status.code}`)}</span>
			{/if}
		</div>
		<a class="btn ghost report" href={ISSUES_URL} target="_blank" rel="noreferrer noopener" title={t('app.reportHint')}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
			</svg>
			<span>{t('app.report')}</span>
		</a>
		<button
			class="btn ghost theme"
			aria-label={$theme === 'dark' ? t('menu.themeLight') : t('menu.themeDark')}
			title={$theme === 'dark' ? t('menu.themeLight') : t('menu.themeDark')}
			onclick={() => theme.set($theme === 'dark' ? 'light' : 'dark')}
		>
			{#if $theme === 'dark'}
				<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" /></svg>
			{/if}
		</button>
	</div>
</header>

<main class="workspace">

	<div class="devices">
		<div class="urna-column">
			<UrnaDevice />
		</div>
		<div class="terminal-column">
			<MesarioTerminal />
		</div>
	</div>

</main>

<!-- Tool windows, each on its own (Exibir menu). -->
{#each TOOL_WINDOWS as w (w.id)}
	<FloatingPanel tabs={[{ id: w.id, label: w.label }]} active={w.id} bind:open={ui.open[w.id]} label={w.label} storageKey="urnaemu:janela:{w.id}:v1" initial={w.initial} minWidth={w.minWidth ?? 340} minHeight={260}>
		{#snippet panel()}
			<div data-panel={w.id} class="fill">
				{#if w.id === 'explicacao'}<ExplainerPanel />
				{:else if w.id === 'dados'}<DataPanel />
				{:else if w.id === 'automatica'}<SimulatorPanel />
				{:else if w.id === 'registro'}<VotaLogPanel />
				{:else if w.id === 'sessao'}<SessionPanel />
				{:else if w.id === 'dev'}<DevPanel />
				{/if}
			</div>
		{/snippet}
	</FloatingPanel>
{/each}

<FloatingPanel tabs={[{ id: 'impressora', label: t('printer.short') }]} active="impressora" bind:open={ui.open.bobina} label={t('printer.short')} storageKey="urnaemu:impressora:v1" initial={{ width: 380, height: 640, anchor: 'left' }} minWidth={320} minHeight={360}>
	{#snippet panel()}
		<div data-panel="bobina" class="fill"><PrinterPanel /></div>
	{/snippet}
</FloatingPanel>

<FloatingPanel tabs={[{ id: 'relogio', label: t('clock.title') }]} active="relogio" bind:open={ui.open.relogio} label={t('clock.title')} storageKey="urnaemu:relogio:v1" initial={{ width: 440, height: 500, anchor: 'right' }} minWidth={340} minHeight={320}>
	{#snippet panel()}
		<ClockPanel />
	{/snippet}
</FloatingPanel>

<FloatingPanel tabs={[{ id: 'carga', label: t('load.title') }]} active="carga" bind:open={ui.open.carga} label={t('load.title')} storageKey="urnaemu:carga:v1" initial={{ width: 960, height: 640, anchor: 'left' }} minWidth={680} minHeight={420}>
	{#snippet panel()}
		<LoadMediaWindow />
	{/snippet}
</FloatingPanel>

<FloatingPanel tabs={[{ id: 'arquivos', label: t('files.title') }]} active="arquivos" bind:open={ui.open.arquivos} label={t('files.title')} storageKey="urnaemu:arquivos:v1" initial={{ width: 1000, height: 620, anchor: 'left' }} minWidth={620} minHeight={380}>
	{#snippet panel()}
		<FileBrowser open={ui.open.arquivos} />
	{/snippet}
</FloatingPanel>

<FloatingPanel
	tabs={[
		{ id: 'instantaneo', label: t('snapshot.title') },
		{ id: 'arquivos', label: t('snapshot.filesTab') },
		{ id: 'bobina', label: t('snapshot.paperTab') }
	]}
	bind:active={ui.snapshotTab}
	bind:open={ui.open.instantaneos}
	label={t('snapshot.title')}
	storageKey="urnaemu:instantaneos:v1"
	initial={{ width: 860, height: 600, anchor: 'right' }}
	minWidth={520}
	minHeight={360}
>
	{#snippet panel(id)}
		<SnapshotWindow tab={id} />
	{/snippet}
</FloatingPanel>

<!-- Notices float at the bottom center, stacked, so they never cover or shift the devices' tops. -->
<div class="toasts">
	<PausedNotice />
	<PrinterNotice />
	<StartTimeNotice />
	<ErrorBanner />
</div>

<HelpDialogs />
{#if ui.dialog === 'fidelity'}<FidelityScreen />{/if}
<TourOverlay />

{#if ui.launcher}
	<Launcher onclose={ui.launcher === 'manual' ? () => (ui.launcher = null) : null} />
{/if}

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		height: var(--menubar-height);
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(10px);
	}
	/* Same centered width as the workspace below. */
	.topbar-inner {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		height: 100%;
		max-width: var(--layout-max);
		margin: 0 auto;
		padding: 0 var(--space-5);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-right: var(--space-2);
	}
	.logo {
		width: 24px;
		height: 24px;
		color: var(--accent);
	}
	.name {
		font: 800 16px var(--font-display);
		letter-spacing: -0.02em;
	}
	.beta {
		display: inline-flex;
		align-items: center;
		align-self: center;
		height: 17px;
		padding: 0 7px;
		border-radius: 999px;
		background: var(--warning-soft);
		color: var(--warning);
		font: 700 10px/1 var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.report {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 12px;
		text-decoration: none;
		white-space: nowrap;
	}
	.report svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.spacer {
		flex: 1;
	}
	.status {
		display: flex;
		gap: var(--space-2);
	}
	.status .state {
		gap: 5px;
	}
	.status-icon {
		width: 14px;
		height: 14px;
		flex: none;
	}
	.spin {
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.toasts {
		position: fixed;
		left: 50%;
		bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
		z-index: 45;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		transform: translateX(-50%);
		pointer-events: none;
	}
	.toasts > :global(*) {
		pointer-events: auto;
	}
	.active-toggle {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}
	.theme {
		width: 38px;
		height: 38px;
		padding: 0;
	}
	.theme svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.pulse {
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	.workspace {
		display: grid;
		gap: var(--space-5);
		max-width: var(--layout-max);
		margin: 0 auto;
		padding: var(--space-5);
	}
	/* Printer · urna · terminal, side by side like on the table of a polling station. */
	/* Urna and terminal take the whole workspace, vertically centered; tools are windows. */
	.devices {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(360px, 1fr);
		gap: var(--space-7);
		align-items: center;
		min-height: calc(100svh - var(--menubar-height) - var(--space-5) * 2);
	}
	.urna-column,
	.terminal-column {
		min-width: 0;
	}
	.terminal-column {
		max-width: 620px;
	}
	:global(.fill) {
		height: 100%;
	}
	@media (max-width: 1000px) {
		.devices {
			grid-template-columns: minmax(0, 1fr);
		}
		.terminal-column {
			max-width: none;
		}
	}
	@media (max-width: 720px) {
		.topbar-inner {
			padding: 0 var(--space-3);
			gap: var(--space-2);
		}
		.name {
			display: none;
		}
		.workspace {
			padding: var(--space-4) var(--space-3) var(--space-7);
		}
	}
</style>
