<script>
	import { tick } from 'svelte';
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	// source: 'native' (binary diagnostics + web-bridge events) or 'host' (UrnaEmu, en-US).
	let { source = 'native' } = $props();
	const sources = $derived(source === 'native' ? ['vota', 'bridge'] : [source]);
	const { app, engine } = useEngine();
	let filter = $state('');
	let list;

	const revision = $derived($engine?.logRevision ?? 0);
	const entries = $derived.by(() => {
		revision;
		const query = filter.trim().toLowerCase();
		const all = app.logger.entries.filter((e) => sources.includes(e.source));
		const shown = query ? all.filter((e) => e.kind.toLowerCase().includes(query) || e.text.toLowerCase().includes(query)) : all;
		return shown.slice(-400);
	});

	$effect(() => {
		entries;
		tick().then(() => {
			if (list) list.scrollTop = list.scrollHeight;
		});
	});

	const tone = (kind) => (kind === 'error' || kind === 'stderr' || kind === 'vota:error' ? 'error' : kind === 'warn' ? 'warn' : kind.startsWith('vota:') ? 'event' : '');
</script>

<div class="log">
	<p class="muted small intro">{source === 'native' ? t('log.votaIntro') : t('log.hostIntro')}</p>
	<div class="toolbar">
		<input class="input" type="search" placeholder={t('log.filter')} bind:value={filter} />
		<button class="btn small ghost" onclick={() => app.downloadBytes(app.logger.entries.filter((e) => sources.includes(e.source)).map((e) => `${e.time} ${e.source} [${e.kind}] ${e.text}`).join('\n'), source === 'native' ? 'diagnosticos-nativos.log' : 'urnaemu-host.log')}>{t('log.download')}</button>
		<button class="btn small ghost" onclick={() => sources.forEach((s) => app.logger.clear(s))}>{t('log.clear')}</button>
	</div>
	<ol class="entries" bind:this={list} data-testid="log">
		{#each entries as entry, i (i + entry.time)}
			<li class={tone(entry.kind)}>
				<time>{entry.time.slice(11, 23)}</time>
				<span class="kind">{entry.source === 'bridge' ? `web · ${entry.kind}` : entry.kind}</span>
				<span class="text">{entry.text}</span>
			</li>
		{:else}
			<li class="empty muted">{t('log.empty')}</li>
		{/each}
	</ol>
</div>

<style>
	.log {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: var(--space-3);
		height: 100%;
		min-height: 240px;
	}
	.toolbar {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.toolbar .input {
		max-width: 280px;
	}
	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: auto;
		max-height: 340px;
		font: 12px/1.55 var(--font-mono);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
	}
	li {
		display: grid;
		grid-template-columns: 92px 150px minmax(0, 1fr);
		gap: 10px;
		padding: 3px 12px;
		border-bottom: 1px solid var(--border);
	}
	li:last-child {
		border-bottom: 0;
	}
	time {
		color: var(--faint);
	}
	.kind {
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	li.error .kind,
	li.error .text {
		color: var(--danger);
	}
	li.warn .kind {
		color: var(--warning);
	}
	li.event .kind {
		color: var(--success);
	}
	.empty {
		display: block;
		padding: var(--space-4);
		font-family: var(--font-body);
	}
</style>
