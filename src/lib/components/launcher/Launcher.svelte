<script>
	// Start screen: how the session starts. Uses the VOTA included in this installation (the
	// upload of other VOTA files is set aside for now; the engine still supports it).
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/t.js';
	import { probeRuntime, selectSource, loadManifest, bundledVersion } from '#lib/engine/assets.js';
	import { DEFAULT_PREFS, loadPrefs, savePrefs, storeMedia, queryFor } from '#lib/launcher/prefs.js';
	import { VotaLoadFormat } from '#lib/engine/load/load-format.js';
	import { APP_VERSION, AUTHOR, REPO_URL } from '#lib/meta.js';

	let { onclose = null } = $props();

	let runtime = $state(null);
	let version = $state(null);
	let scenarios = $state([]);
	let prefs = $state({ ...DEFAULT_PREFS, ...(loadPrefs() ?? {}) });
	let error = $state(null);
	let media = $state(null); // { name, scenario, phase, files }

	onMount(async () => {
		selectSource('bundled');
		runtime = await probeRuntime();
		if (runtime.bundled.ok) bundledVersion().then((v) => (version = v));
		scenarios = (await loadManifest())?.scenarios ?? [];
		if (scenarios.length && !scenarios.some((s) => s.id === prefs.scenario)) prefs.scenario = scenarios[0].id;
	});

	const ready = $derived(!!runtime?.bundled.ok);
	const MODES = ['treinamento', 'oficial', 'simples', 'midia'];
	const usesClock = $derived(prefs.mode === 'treinamento' || prefs.mode === 'simples');

	async function pickMedia(event) {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = null;
		try {
			const text = await file.text();
			const p = VotaLoadFormat.validatePackage(JSON.parse(text));
			await storeMedia(text);
			media = { name: file.name, scenario: p.scenario, phase: p.config.fase === 'of' ? t('phase.official') : t('phase.training'), files: p.files.length };
		} catch (e) {
			media = null;
			error = t('launcher.mediaInvalid', { error: String(e.message ?? e) });
		}
	}
	function start() {
		if (prefs.mode === 'midia' && !media) {
			error = t('launcher.mediaMissing');
			return;
		}
		const chosen = { ...prefs, scenario: prefs.mode === 'midia' ? media.scenario : prefs.scenario };
		if (chosen.remember) savePrefs(chosen);
		location.assign('?' + queryFor(chosen));
	}
</script>

<div class="launcher" role="dialog" aria-modal="true" aria-labelledby="launcher-title" data-testid="launcher">
	<div class="card">
		<header>
			<!-- "Vote" icon from Lucide (ISC License). -->
			<svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="m9 12 2 2 4-4" />
				<path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
				<path d="M22 19H2" />
			</svg>
			<div>
				<h1 id="launcher-title">{t('app.name')} <span class="beta">{t('app.beta')}</span></h1>
				<p class="muted">{t('app.tagline')}</p>
			</div>
			{#if onclose}<button class="close" aria-label={t('common.close')} onclick={onclose}>✕</button>{/if}
		</header>

		<div class="modes" role="radiogroup" aria-label={t('launcher.startTitle')}>
			{#each MODES as mode}
				<label class="mode" class:active={prefs.mode === mode}>
					<input type="radio" name="mode" value={mode} bind:group={prefs.mode} />
					<strong>{t(`launcher.modes.${mode}.title`)}</strong>
					<span>{t(`launcher.modes.${mode}.body`)}</span>
				</label>
			{/each}
		</div>

		<div class="options">
			{#if prefs.mode === 'midia'}
				<div class="field">
					<span class="label">{t('launcher.mediaFile')}</span>
					<div class="row">
						<label class="btn">{media ? media.name : t('launcher.chooseMedia')}<input type="file" accept=".json,application/json" hidden onchange={pickMedia} /></label>
						{#if media}<span class="muted small">{t('launcher.mediaInfo', media)}</span>{/if}
					</div>
				</div>
			{:else}
				<label class="field">
					<span class="label">{t('controls.scenario')}</span>
					<select class="input" bind:value={prefs.scenario}>
						{#each scenarios as s}<option value={s.id}>{s.label}</option>{/each}
					</select>
				</label>
				{#if usesClock}
					<label class="field">
						<span class="label">{t('launcher.clock')}</span>
						<select class="input" bind:value={prefs.clock}>
							<option value="election">{t('launcher.clocks.election')}</option>
							<option value="real">{t('launcher.clocks.real')}</option>
							<option value="custom">{t('launcher.clocks.custom')}</option>
						</select>
					</label>
					{#if prefs.clock === 'custom'}
						<label class="field"><span class="label">{t('clock.date')}</span><input class="input" type="datetime-local" step="1" bind:value={prefs.customClock} /></label>
					{/if}
				{:else if prefs.mode === 'oficial'}
					<p class="hint">{t('launcher.officialNext')}</p>
				{/if}
			{/if}
		</div>

		{#if error}<p class="error small">{error}</p>{/if}
		{#if runtime && !ready}<p class="error small">{t('launcher.runtimeMissing')}</p>{/if}

		<footer>
			<label class="check small"><input type="checkbox" bind:checked={prefs.remember} /> {t('launcher.remember')}</label>
			<button class="btn primary big" disabled={!ready} onclick={start} data-testid="launcher-start">{prefs.mode === 'oficial' ? t('launcher.startOfficial') : t('launcher.start')}</button>
		</footer>

		{#if runtime?.bundled.ok}
			<div class="runtime" data-testid="launcher-runtime">
				<strong>VOTA {version ?? '…'}</strong>
				<span class="muted">{t('launcher.runtimeSource')}</span>
				<span class="state success" title={`SHA-256 ${runtime.bundled.hash}`}>{t('launcher.supported')}</span>
			</div>
		{/if}
		<p class="fine attribution">UrnaEmu {APP_VERSION} · <a class="link" href={AUTHOR.url} target="_blank" rel="noreferrer noopener">{AUTHOR.name}</a> · <a class="link" href={REPO_URL} target="_blank" rel="noreferrer noopener">GitHub</a></p>
		<p class="fine" data-testid="launcher-disclaimer">{t('launcher.disclaimer')}</p>
	</div>
</div>

<style>
	.launcher {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		overflow: auto;
		padding: var(--space-6) var(--space-4);
		background: var(--bg);
	}
	.card {
		display: grid;
		gap: var(--space-5);
		width: min(680px, 100%);
		padding: var(--space-6);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 14px);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	header > div {
		flex: 1;
	}
	h1 {
		margin: 0;
		font: 800 26px var(--font-display);
		letter-spacing: -0.02em;
	}
	header p {
		margin: 2px 0 0;
		font-size: 14px;
	}
	.logo {
		width: 40px;
		height: 40px;
		flex: none;
		color: var(--accent);
	}
	.close {
		align-self: flex-start;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.close:hover {
		background: var(--surface-alt);
	}
	/* Equal cards: every row as tall as the tallest one. */
	.modes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: 1fr;
		gap: var(--space-2);
	}
	.mode {
		position: relative;
		display: grid;
		align-content: start;
		gap: 4px;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition:
			border-color 0.15s var(--ease),
			background 0.15s var(--ease);
	}
	.mode:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}
	.mode.active {
		border-color: var(--accent);
		background: var(--accent-softer);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.mode input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.mode strong {
		font: 650 15px var(--font-display);
	}
	.mode span {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.mode:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-3);
		min-height: 64px;
		align-content: start;
	}
	.field {
		display: grid;
		gap: 6px;
	}
	.label {
		color: var(--muted);
		font-size: 12.5px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.hint {
		align-self: center;
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.beta {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		margin-left: 6px;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--warning-soft);
		color: var(--warning);
		font: 700 10px/1 var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.attribution {
		color: var(--muted);
	}
	.link {
		color: var(--accent);
		text-decoration: none;
	}
	.link:hover {
		text-decoration: underline;
	}
	.error {
		margin: 0;
		color: var(--danger);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.big {
		min-width: 160px;
		min-height: 44px;
		font-size: 15px;
	}
	.runtime {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
		font-size: 13px;
	}
	.fine {
		margin: 0;
		color: var(--faint, var(--muted));
		font-size: 12px;
		line-height: 1.5;
	}
	@media (max-width: 560px) {
		.card {
			padding: var(--space-4);
		}
		.modes {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
