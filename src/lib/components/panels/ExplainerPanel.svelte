<script>
	// Follows the session and explains, in plain language, the current step of election day.
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { EXPLICACOES } from '#lib/explicacoes.js';

	const { engine } = useEngine();
	const phase = $derived($engine?.phaseId ?? 'carregando');
	const info = $derived(EXPLICACOES[phase] ?? EXPLICACOES.carregando);
</script>

<article class="explainer" data-testid="explainer" data-phase={phase}>
	<p class="eyebrow">{t('explainer.now')}</p>
	<h2>{info.titulo}</h2>
	<p class="editorial">{info.acontecendo}</p>

	{#if info.fazer.length}
		<h3 class="eyebrow">{t('explainer.todo')}</h3>
		<ol class="steps">
			{#each info.fazer as step}
				<li><span class="device">{step.aparelho}</span><span>{step.acao}</span></li>
			{/each}
		</ol>
	{/if}

	{#if info.real}
		<aside class="note">
			<h3 class="eyebrow">{t('explainer.real')}</h3>
			<p>{info.real}</p>
		</aside>
	{/if}
	{#if info.emulador}
		<aside class="note host">
			<h3 class="eyebrow">{t('explainer.emulator')}</h3>
			<p>{info.emulador}</p>
		</aside>
	{/if}
</article>

<style>
	.explainer {
		display: grid;
		gap: var(--space-3);
		max-width: var(--content-max);
	}
	h2 {
		font-size: 20px;
	}
	.editorial {
		font-size: 16.5px;
		line-height: 1.7;
		color: var(--text);
	}
	h3 {
		margin-top: var(--space-2);
	}
	.steps {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}
	.steps li {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 14px;
		line-height: 1.55;
	}
	.device {
		color: var(--accent);
		font: 600 12.5px/1.55 var(--font-display);
	}
	.note {
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--accent);
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		background: var(--accent-softer);
		font-family: var(--font-editorial);
		font-size: 15px;
		line-height: 1.65;
	}
	.note.host {
		border-left-color: var(--warning);
		background: var(--warning-soft);
	}
	.note h3 {
		margin: 0 0 4px;
		font-family: var(--font-display);
	}
</style>
