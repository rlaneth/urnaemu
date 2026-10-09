<script>
	// Cast many ballots automatically, with a reproducible seed and weighted choices.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	const sim = $derived($engine?.simulator);
	const official = $derived($engine?.phase === 'official');
	const ready = $derived(!!$engine?.session?.enabled && !$engine.session.booting && !$engine.session.closed);
	const eleitorado = $derived(($engine?.load?.revision, official ? app.simulator.eleitorado() : []));

	let count = $state(5);
	let seed = $state(1);
	let pace = $state(120);
	let weights = $state({ candidato: 6, legenda: 1, branco: 1, nulo: 1 });

	const start = action(app, () => app.simulator.start({ count: Number(count), seed: Number(seed), weights: { ...weights }, pace: Number(pace) }));
	const tally = $derived(Object.entries(sim?.tally ?? {}));
</script>

<div class="simulator" data-testid="simulator">
	<p class="muted small">{t('simulator.intro')}</p>
	{#if official}
		<p class="note small">{t('simulator.official', { n: eleitorado.length })}</p>
	{/if}

	<div class="grid">
		<label class="field">{t('simulator.count')}<input class="input" type="number" min="1" max="500" bind:value={count} disabled={sim?.running} /></label>
		<label class="field">{t('simulator.seed')}<input class="input" type="number" min="1" bind:value={seed} disabled={sim?.running} /></label>
		<label class="field"
			>{t('simulator.pace')}
			<select class="input" bind:value={pace} disabled={sim?.running}>
				<option value={250}>{t('simulator.paces.slow')}</option>
				<option value={120}>{t('simulator.paces.visible')}</option>
				<option value={0}>{t('simulator.paces.fast')}</option>
			</select>
		</label>
	</div>

	<fieldset class="weights" disabled={sim?.running}>
		<legend class="eyebrow">{t('simulator.weights')}</legend>
		{#each ['candidato', 'legenda', 'branco', 'nulo'] as key}
			<label class="weight">
				<span>{t(`simulator.kinds.${key}`)}</span>
				<input type="range" min="0" max="10" bind:value={weights[key]} />
				<span class="mono">{weights[key]}</span>
			</label>
		{/each}
	</fieldset>

	<div class="row">
		{#if sim?.running}
			<button class="btn" onclick={() => app.simulator.stop()}>{t('simulator.stop')}</button>
			<span class="small">{t('simulator.progress', { cast: sim.cast, total: sim.total, current: sim.current ?? '' })}</span>
		{:else}
			<button class="btn primary" disabled={!ready} onclick={start} data-testid="simulator-start">{t('simulator.start')}</button>
			{#if sim?.cast}<button class="btn ghost" onclick={() => app.simulator.reset()}>{t('simulator.reset')}</button>{/if}
			{#if !ready}<span class="muted small">{t('simulator.needsSession')}</span>{/if}
		{/if}
	</div>
	{#if sim?.error}<p class="error small">{sim.error}</p>{/if}

	{#if tally.length}
		<section>
			<h3 class="eyebrow">{t('simulator.expected', { n: sim.cast })}</h3>
			<p class="muted small">{t('simulator.expectedHint')}</p>
			{#each tally as [cargo, counts]}
				<h4>{cargo}</h4>
				<table>
					<tbody>
						{#each Object.entries(counts).sort((a, b) => b[1] - a[1]) as [choice, n]}
							<tr><td>{choice}</td><td class="num mono">{n}</td></tr>
						{/each}
					</tbody>
				</table>
			{/each}
		</section>
	{/if}
</div>

<style>
	.simulator {
		display: grid;
		gap: var(--space-4);
		max-width: var(--content-max);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--accent-softer);
		border: 1px solid var(--border);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-3);
	}
	.weights {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.weight {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) 24px;
		align-items: center;
		gap: var(--space-3);
		font-size: 13.5px;
	}
	.weight input {
		accent-color: var(--accent);
	}
	h4 {
		margin: var(--space-3) 0 4px;
		font-size: 13.5px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	td {
		padding: 4px 8px;
		border-bottom: 1px solid var(--border);
	}
	.num {
		text-align: right;
	}
	.error {
		color: var(--danger);
	}
</style>
