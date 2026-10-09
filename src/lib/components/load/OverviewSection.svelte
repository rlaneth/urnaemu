<script>
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { voterDraft, candidateDraft } from './draft.svelte.js';

	let { go } = $props();
	const { app, engine } = useEngine();
	const load = $derived($engine?.load);
	const config = $derived((load?.revision, app.loadEditor.readConfig()));
	const voters = $derived((load?.revision, app.loadEditor.voters().length));
	const official = $derived(config?.fase === 'of');
	const places = $derived((load?.revision, app.loadEditor.places()));
	const municipioName = $derived(places.find((p) => p.municipio === config?.municipio)?.nome ?? '—');

	// One explicit action: generate the official media from the saved draft, sign it with
	// the identity the user chose (never created implicitly) and restart.
	let preparing = $state(false);
	const prepare = action(app, async () => {
		if (voterDraft.dirty) throw Error(t('loadui.overview.unsavedVoters'));
		if (candidateDraft.dirty) throw Error(t('loadui.overview.unsavedCandidates'));
		preparing = true;
		try {
			await app.loadEditor.generateOfficial();
			await app.loadEditor.apply();
		} finally {
			preparing = false;
		}
	});
</script>

<div class="overview">
	<p class="editorial">{t('loadui.overview.intro')}</p>

	<dl class="facts">
		<div><dt>{t('loadui.overview.scenario')}</dt><dd>{$engine?.scenario?.label ?? '—'}</dd></div>
		<div><dt>{t('loadui.overview.phase')}</dt><dd>{official ? t('phase.official') : t('phase.training')}</dd></div>
		<div><dt>{t('loadui.election.uf')}</dt><dd>{config ? String(config.uf).toUpperCase() : '—'}</dd></div>
		<div><dt>{t('loadui.election.municipality')}</dt><dd>{config ? municipioName : '—'}</dd></div>
		<div><dt>{t('loadui.election.zone')}</dt><dd class="mono">{config?.zona ?? '—'}</dd></div>
		<div><dt>{t('loadui.election.section')}</dt><dd class="mono">{config?.secao ?? '—'}</dd></div>
		<div><dt>{t('loadui.overview.voters')}</dt><dd>{voters} <button class="link" onclick={() => go('eleitorado')}>{t('loadui.overview.edit')}</button></dd></div>
		<div><dt>{t('loadui.overview.signature')}</dt><dd>{load?.signed ? t('loadui.overview.signed') : t('loadui.overview.unsigned')}{load?.provider ? ` · ${load.provider}` : ''}</dd></div>
	</dl>

	<section class="howto">
		<h3>{t('loadui.overview.trainingTitle')}</h3>
		<p class="small">{t('loadui.overview.trainingBody')}</p>
	</section>

	<section class="howto">
		<h3>{t('loadui.overview.officialTitle')}</h3>
		<ol class="steps">
			<li class:warn={voterDraft.dirty}>
				<span class="n">1</span>
				<div>
					<strong>{t('loadui.overview.step1')}</strong>
					<p class="small muted">{voterDraft.dirty ? t('loadui.overview.unsavedVoters') : t('loadui.overview.step1Body', { n: voters })}</p>
					<button class="btn small" onclick={() => go('eleitorado')}>{t('loadui.nav.voters')}</button>
				</div>
			</li>
			<li>
				<span class="n">2</span>
				<div>
					<strong>{t('loadui.overview.step2')}</strong>
					<p class="small muted">{load?.identity ? t('loadui.overview.step2Existing', { name: load.identity.name }) : load?.provider ? t('loadui.overview.step2Key', { alg: load.provider }) : t('loadui.overview.step2New')}</p>
					<button class="btn small" onclick={() => go('identidade')}>{t('loadui.nav.identity')}</button>
				</div>
			</li>
			<li>
				<span class="n">3</span>
				<div>
					<strong>{t('loadui.overview.step3')}</strong>
					<p class="small muted">{candidateDraft.dirty ? t('loadui.overview.unsavedCandidates') : t('loadui.overview.step3Body')}</p>
					<button class="btn primary" disabled={voterDraft.dirty || candidateDraft.dirty || preparing || !load?.provider} onclick={prepare} data-testid="load-prepare-official">
						{preparing ? t('loadui.overview.preparing') : t('loadui.overview.prepare')}
					</button>
				</div>
			</li>
		</ol>
	</section>
</div>

<style>
	.overview {
		display: grid;
		gap: var(--space-4);
		max-width: var(--content-max);
	}
	.editorial {
		font-size: 15.5px;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	.mono {
		font-variant-numeric: tabular-nums;
	}
	.facts div {
		padding: var(--space-3);
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
		margin: 4px 0 0;
		font-size: 14px;
	}
	.link {
		margin-left: 6px;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
		text-decoration: underline;
	}
	.howto h3 {
		font-size: 15px;
		margin-bottom: var(--space-2);
	}
	.steps {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.steps li {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.steps p {
		margin: 2px 0 var(--space-2);
	}
	.steps li.warn {
		border-color: color-mix(in srgb, var(--warning) 50%, transparent);
		background: var(--warning-soft);
	}
	.n {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font: 700 13px var(--font-display);
	}
</style>
