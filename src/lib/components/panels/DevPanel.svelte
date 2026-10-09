<script>
	// Developer window: host and native logs, engine state, memory and the terminal's text.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import LogPanel from './LogPanel.svelte';

	const { app, engine } = useEngine();
	const dev = app.dev;
	const s = $derived($engine);

	const tabs = ['host', 'diagnostics', 'state', 'memory', 'terminal'];
	let tab = $state('host');
	const run = (fn) => action(app, fn);
	const show = (value) => dev.formatValue(value);

	// Memory
	let offset = $state('0');
	let length = $state('256');
	let memory = $state('');
	let context = $state('');
	const readMemory = run(() => (memory = dev.readMemory(Number(offset), Number(length))));
	const readContext = run(async () => {
		const value = await dev.readContext();
		context = show(value);
		offset = String(value.pointer);
	});
</script>

<div class="dev">
	<p class="warning small">{t('dev.warning')}</p>
	<label class="check small"><input type="checkbox" checked={!!s?.debug} onchange={(e) => app.setDebug(e.currentTarget.checked)} /> {t('dev.consoleDebug')}</label>
	<div class="subtabs" role="tablist">
		{#each tabs as id}
			<button role="tab" class="subtab" class:active={tab === id} aria-selected={tab === id} onclick={() => (tab = id)}>{t(`dev.tabs.${id}`)}</button>
		{/each}
	</div>

	{#if tab === 'host'}
		<LogPanel source="host" />
	{:else if tab === 'diagnostics'}
		<LogPanel source="native" />
	{:else if tab === 'state'}
		<div class="stack">
			<div class="row"><button class="btn small" onclick={run(() => app.readState())}>{t('dev.refresh')}</button></div>
			<h3 class="eyebrow">{t('dev.sessionState')}</h3>
			<pre class="code-block" data-testid="experiment-state">{show({ status: s?.status, operator: s?.operator, session: s?.session, native: s?.native })}</pre>
			<h3 class="eyebrow">{t('dev.votaState')}</h3>
			<pre class="code-block" data-testid="engine-state">{show(s?.vota)}</pre>
		</div>
	{:else if tab === 'memory'}
		<div class="stack">
			<div class="row"><button class="btn small" onclick={readContext}>{t('dev.context')}</button></div>
			{#if context}<pre class="code-block">{context}</pre>{/if}
			<div class="grid">
				<label class="field">{t('dev.offset')}<input class="input mono" bind:value={offset} /></label>
				<label class="field">{t('dev.length')}<input class="input mono" bind:value={length} /></label>
			</div>
			<div class="row"><button class="btn small" onclick={readMemory}>{t('dev.read')}</button></div>
			{#if memory}<pre class="code-block">{memory}</pre>{/if}
		</div>
	{:else if tab === 'terminal'}
		<div class="stack">
			<pre class="code-block" data-testid="terminal-text">{s?.terminal.text || '—'}</pre>
			<p class="muted small">{s?.terminal.encoding ? t('dev.encoding', { encoding: s.terminal.encoding }) : '—'}</p>
		</div>
	{/if}
</div>

<style>
	.dev {
		display: grid;
		gap: var(--space-4);
	}
	.warning {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--warning-soft);
		color: var(--warning);
	}
	.subtabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.subtab {
		height: 32px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: 500 12.5px var(--font-body);
		cursor: pointer;
	}
	.subtab.active {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-3);
	}
</style>
