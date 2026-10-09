<script>
	// Election data of the running session: section, counter and the current office's candidates.
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { readEleitorado } from '#lib/engine/load/eleitorado.js';

	const { app, engine } = useEngine();
	const s = $derived($engine);
	const config = $derived(s?.ready ? (app.sessionConfig ?? null) : null);
	const cargo = $derived(s?.vota?.cargo ?? null);
	const eleitorado = $derived((s?.load?.revision, s?.ready ? readEleitorado(app.loadEditor.files) : []));
	const candidates = $derived((s?.vota?.candidates ?? []).slice().sort((a, b) => a.number - b.number));
	// The terminal shows the native counter as "Votos: 0001" (hidden while someone votes,
	// so keep the last value seen).
	let votes = $state(null);
	$effect(() => {
		const seen = s?.terminal.lines.join('\n').match(/Votos:\s*(\d+)/)?.[1];
		if (seen !== undefined) votes = seen;
	});
</script>

<div class="data" data-testid="voting-data">
	<dl class="facts">
		<div><dt>{t('data.scenario')}</dt><dd>{s?.scenario?.label ?? '—'}</dd></div>
		<div><dt>{t('data.phase')}</dt><dd>{s?.phase ? t(`phase.${s.phase}`) : '—'}</dd></div>
		{#if config}
			<div><dt>{t('data.uf')}</dt><dd>{String(config.uf).toUpperCase()}</dd></div>
			<div><dt>{t('data.municipality')}</dt><dd class="mono">{config.municipio}</dd></div>
			<div><dt>{t('data.zone')}</dt><dd class="mono">{config.zona}</dd></div>
			<div><dt>{t('data.section')}</dt><dd class="mono">{config.secao}</dd></div>
			<div><dt>{t('data.round')}</dt><dd>{config.turno}º</dd></div>
		{/if}
		<div><dt>{t('data.votes')}</dt><dd class="mono">{votes ? Number(votes) : '—'}</dd></div>
	</dl>

	<section>
		<h3 class="eyebrow">{t('data.eleitorado', { n: eleitorado.length })}</h3>
		<p class="muted small">{t('data.eleitoradoHint')}</p>
		<table>
			<thead><tr><th>{t('data.title_')}</th><th>{t('data.name')}</th><th>{t('data.birth')}</th></tr></thead>
			<tbody>
				{#each eleitorado as v (v.title)}
					<tr><td class="mono">{v.title}</td><td>{v.name}</td><td class="mono">{v.birth.replace(/^(\d{4})(\d{2})(\d{2})$/, '$3/$2/$1')}</td></tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section>
		<h3 class="eyebrow">{cargo ? t('data.office', { name: cargo.name }) : t('data.noOffice')}</h3>
		{#if cargo}
			<p class="muted small">
				{t('data.digits', { n: cargo.digits })}{cargo.tipo ? ` · ${cargo.tipo === 'proporcional' ? t('data.proportional') : t('data.majority')}` : ''}{cargo.legendaDigits ? ` · ${t('data.party', { n: cargo.legendaDigits })}` : ''}
			</p>
			<table>
				<thead><tr><th>{t('data.number')}</th><th>{t('data.name')}</th><th>{t('data.partyCol')}</th></tr></thead>
				<tbody>
					{#each candidates as c (c.number)}
						<tr class:inapt={c.apt === false}>
							<td class="mono">{c.number}</td>
							<td>{c.name}{c.apt === false ? ` (${t('data.inapt')})` : ''}</td>
							<td class="mono">{c.party ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="muted small">{t('data.officeHint')}</p>
		{/if}
	</section>
</div>

<style>
	.data {
		display: grid;
		gap: var(--space-5);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
		margin: 0;
	}
	.facts div {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	dt {
		color: var(--muted);
		font: 600 11px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	dd {
		margin: 4px 0 0;
		font-size: 14px;
	}
	table {
		width: 100%;
		margin-top: var(--space-2);
		border-collapse: collapse;
		font-size: 13.5px;
	}
	th {
		padding: 6px 10px;
		color: var(--muted);
		font: 600 11px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
	}
	.inapt {
		color: var(--faint);
	}
</style>
