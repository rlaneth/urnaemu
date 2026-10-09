<script>
	// Mídia de carga: the election data VOTA boots from, organized by task.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import OverviewSection from './OverviewSection.svelte';
	import IdentitySection from './IdentitySection.svelte';
	import EleitoradoSection from './EleitoradoSection.svelte';
	import CandidatesSection from './CandidatesSection.svelte';
	import ElectionSection from './ElectionSection.svelte';
	import SignatureSection from './SignatureSection.svelte';
	import AdvancedSection from './AdvancedSection.svelte';

	const { app, engine } = useEngine();
	const load = $derived($engine?.load);
	// Why "Aplicar e reiniciar" can't run yet (e.g. official media without an identity), or null.
	const applyBlock = $derived((load?.revision, app.loadEditor.applyBlock()));
	let section = $state('resumo');

	const sections = [
		{ id: 'resumo', label: t('loadui.nav.overview') },
		{ id: 'identidade', label: t('loadui.nav.identity') },
		{ id: 'eleitorado', label: t('loadui.nav.voters') },
		{ id: 'candidatos', label: t('loadui.nav.candidates') },
		{ id: 'eleicao', label: t('loadui.nav.election') },
		{ id: 'assinatura', label: t('loadui.nav.signature') },
		{ id: 'avancado', label: t('loadui.nav.advanced') }
	];

	const apply = action(app, () => app.loadEditor.apply());
	const reset = action(app, () => app.loadEditor.reset());
	const exportMedia = action(app, async () => app.downloadBytes(JSON.stringify(await app.loadEditor.exportPackage(), null, 2), 'midia-de-carga.vota-load.json'));
	const importMedia = action(app, async (event) => {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (file.size > 40 * 1024 * 1024) throw Error('Arquivo grande demais');
		await app.loadEditor.importPackage(JSON.parse(await file.text()));
	});
</script>

<div class="window" data-testid="load-editor">
	<nav class="nav" aria-label={t('load.title')}>
		{#each sections as s}
			<button class="item" class:active={section === s.id} onclick={() => (section = s.id)} data-testid="load-nav-{s.id}">{s.label}</button>
		{/each}
	</nav>

	<div class="content">
		<div class="body">
			{#if section === 'resumo'}<OverviewSection go={(id) => (section = id)} />
			{:else if section === 'identidade'}<IdentitySection />
			{:else if section === 'eleitorado'}<EleitoradoSection />
			{:else if section === 'candidatos'}<CandidatesSection />
			{:else if section === 'eleicao'}<ElectionSection />
			{:else if section === 'assinatura'}<SignatureSection />
			{:else if section === 'avancado'}<AdvancedSection />
			{/if}
		</div>

		<footer class="footer">
			<p class="status small" data-testid="load-status" data-status={load?.status.code}>
				{#if load?.dirty}<span class="state warning">{t('loadui.pending')}</span>{/if}
				<span>{load?.status.text}</span>
			</p>
			<div class="row">
				<label class="btn ghost small">{t('load.import')}<input type="file" accept=".json,application/json" hidden onchange={importMedia} /></label>
				<button class="btn ghost small" onclick={exportMedia}>{t('load.export')}</button>
				<button class="btn ghost small danger" onclick={reset} title={t('loadui.resetHint')}>{t('loadui.reset')}</button>
				<button class="btn primary" onclick={apply} disabled={!!applyBlock} data-testid="load-apply" title={applyBlock || t('loadui.applyHint')}>{t('load.apply')}</button>
			</div>
		</footer>
	</div>
</div>

<style>
	.window {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: var(--space-4);
		height: 100%;
		min-height: 0;
	}
	.nav {
		display: grid;
		align-content: start;
		gap: 2px;
	}
	.item {
		padding: 9px 12px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: 500 13.5px var(--font-body);
		text-align: left;
		cursor: pointer;
	}
	.item:hover {
		background: var(--surface-hover);
	}
	.item.active {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.content {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: var(--space-3);
		min-height: 0;
	}
	.body {
		min-height: 0;
		overflow: auto;
		padding-right: 6px;
	}
	.footer {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.footer .row {
		justify-content: flex-end;
	}
	.status {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--muted);
		line-height: 1.5;
		overflow-wrap: anywhere;
		max-height: 3em;
		overflow: hidden;
	}
	.danger {
		color: var(--danger);
	}
</style>
