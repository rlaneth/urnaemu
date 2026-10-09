<script>
	// Decoded Boletim de Urna + Registro Digital do Voto, with every verification check.
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { verifyFromDirectory } from '#lib/results/index.js';
	import { cargoName, TIPO_VOTO_BU, TIPO_VOTO_RDV, FASES, dataHoraJE } from '#lib/results/labels.js';

	// `source`: where the files come from (the running emulator, or a snapshot opened read-only).
	let { path, source = null } = $props();
	const { app } = useEngine();

	let report = $state(null);
	let error = $state(null);
	$effect(() => {
		const target = path;
		report = null;
		error = null;
		verifyFromDirectory(source ?? app, target).then(
			(r) => (report = r),
			(e) => (error = String(e.message ?? e))
		);
	});

	const checkLabel = (c) => {
		const [kind, ...rest] = c.id.split(':');
		const office = rest[1] ? ` · ${cargoName(Number(rest[1]))}` : '';
		const election = rest[0] ? ` · ${t('results.election', { id: rest[0] })}` : '';
		return t(`results.checks.${kind}`) + (kind === 'totals' || kind === 'sorted' ? office : election);
	};
	const section = $derived(report?.bu.identificacaoSecao);
	const total = (office) => office.votes.reduce((n, v) => n + v.quantidade, 0);
</script>

<div class="result" data-testid="result-view">
	{#if error}
		<p class="error small">{error}</p>
	{:else if !report}
		<p class="muted small">{t('results.verifying')}</p>
	{:else}
		<header class="summary" class:ok={report.ok}>
			<strong>{report.ok ? t('results.allOk') : t('results.someFailed')}</strong>
			<span class="muted small">{t('results.checked', { n: report.checks.length })}</span>
		</header>

		<dl class="facts">
			<div><dt>{t('results.phase')}</dt><dd>{FASES[report.bu.fase] ?? report.bu.fase}</dd></div>
			<div><dt>{t('results.section')}</dt><dd class="mono">{JSON.stringify(section?.municipioZona ? { ...section.municipioZona, secao: section.secao } : section).replace(/[{}"]/g, '').replace(/,/g, ' · ')}</dd></div>
			<div><dt>{t('results.issued')}</dt><dd>{dataHoraJE(report.bu.dataHoraEmissao)}</dd></div>
			<div><dt>{t('results.attendance')}</dt><dd>{report.bu.qtdEleitoresCompareceram}</dd></div>
		</dl>

		{#each report.elections as election (election.id)}
			<section>
				<h3 class="eyebrow">{t('results.election', { id: election.id })}</h3>
				{#each election.offices as office (office.code)}
					<div class="office">
						<h4>{cargoName(office.cargo)} <span class="muted small">· {t('results.votes', { n: total(office) })}</span></h4>
						<table>
							<tbody>
								{#each office.votes as vote}
									<tr>
										<td>{TIPO_VOTO_BU[vote.tipo] ?? vote.tipo}</td>
										<td class="mono">{vote.codigo ?? ''}</td>
										<td class="mono muted">{vote.partido !== null ? t('results.party', { n: vote.partido }) : ''}</td>
										<td class="num mono">{vote.quantidade}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}

				<details>
					<summary class="small">{t('results.rdvTitle')}</summary>
					<p class="muted small rdv-note">{t('results.rdvNote')}</p>
					{#each election.rdvOffices as office (office.code)}
						<div class="office">
							<h4>{cargoName(office.cargo)}</h4>
							<ol class="rdv">
								{#each office.votes as vote}<li><span>{TIPO_VOTO_RDV[vote.tipo] ?? vote.tipo}</span><span class="mono">{vote.digitacao ?? ''}</span></li>{/each}
							</ol>
						</div>
					{/each}
				</details>
			</section>
		{/each}

		<section>
			<h3 class="eyebrow">{t('results.checksTitle')}</h3>
			<ul class="checks">
				{#each report.checks as c}
					<li class:fail={!c.ok}><span class="mark">{c.ok ? '✓' : '✗'}</span><span>{checkLabel(c)}{c.detail ? ` — ${c.detail}` : ''}</span></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.result {
		display: grid;
		gap: var(--space-4);
		overflow: auto;
		flex: 1;
		min-height: 0;
		padding-right: 4px;
	}
	.summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.summary.ok {
		background: var(--success-soft);
		color: var(--success);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	.facts div {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	dt {
		color: var(--muted);
		font: 600 10.5px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	dd {
		margin: 2px 0 0;
		font-size: 13px;
	}
	.office {
		margin-top: var(--space-2);
	}
	h4 {
		font-size: 13.5px;
		margin-bottom: 4px;
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
	.rdv-note {
		margin: 6px 0;
		font-family: var(--font-editorial);
		font-size: 14px;
	}
	.rdv {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rdv li {
		display: flex;
		gap: 6px;
		padding: 2px 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 12px;
	}
	.checks {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}
	.checks li {
		display: flex;
		gap: 8px;
	}
	.mark {
		color: var(--success);
		font-weight: 700;
	}
	.fail .mark,
	.fail {
		color: var(--danger);
	}
	summary {
		cursor: pointer;
		margin-top: var(--space-3);
	}
	.error {
		color: var(--danger);
	}
</style>
