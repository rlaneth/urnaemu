<script>
	// Eleição e seção: phase and place (município, zona, seção) are editable, each converting the
	// whole media consistently; turno, processo and UF define the election and come from the scenario.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { UFS } from '#lib/engine/load/places-edit.js';

	const { app, engine } = useEngine();
	const load = $derived($engine?.load);
	const config = $derived((load?.revision, app.loadEditor.readConfig()));
	const fixed = $derived(
		config
			? [
					[t('loadui.election.round'), `${config.turno}º`],
					[t('loadui.election.process'), config.pe]
				]
			: []
	);
	// UF is editable (experimental); turno/processo and the cargos stay from the scenario.
	// config is a fresh object on every engine update (several per second while VOTA runs): sync
	// the form from its primitive values only, or each update would undo the user's choice.
	const currentUf = $derived(config?.uf ?? '');
	let newUf = $state('');
	$effect(() => {
		newUf = currentUf;
	});
	const changeUf = action(app, () => app.loadEditor.changeUf(newUf));
	// Another election (bundled scenario): reloads its media, keeping the official setup open.
	let newScenario = $state($engine?.scenario?.id ?? '');
	const switchScenario = action(app, () => app.loadEditor.switchScenario(newScenario, { official: config?.fase === 'of' }));
	// Places the media declares (municipalities and their zones).
	const places = $derived((load?.revision, app.loadEditor.places()));
	let place = $state({ municipio: null, zona: null, secao: null });
	const currentPlace = $derived(config ? `${config.municipio}/${config.zona}/${config.secao}` : '');
	$effect(() => {
		if (!currentPlace) return;
		const [municipio, zona, secao] = currentPlace.split('/').map(Number);
		place = { municipio, zona, secao };
	});
	const zonas = $derived(places.find((p) => p.municipio === Number(place.municipio))?.zonas ?? []);
	// Picking another município selects its first zone.
	function pickMunicipio(value) {
		place.municipio = Number(value);
		if (!zonas.includes(Number(place.zona))) place.zona = places.find((p) => p.municipio === place.municipio)?.zonas[0] ?? null;
	}
	const changed = $derived(!!config && (Number(place.municipio) !== config.municipio || Number(place.zona) !== config.zona || Number(place.secao) !== config.secao));

	const toOfficial = action(app, () => app.loadEditor.generateOfficial());
	const toTraining = action(app, () => app.loadEditor.reset());
	const changeLocation = action(app, () => app.loadEditor.changeLocation({ municipio: Number(place.municipio), zona: Number(place.zona), secao: Number(place.secao) }));

	// Edit the municípios the media declares (código and name) and add new zonas (places-edit.js,
	// via the load editor). The scenario declares three municípios; each can take any código.
	let editingPlaces = $state(false);
	let editCodigo = $state('');
	let editName = $state('');
	let newZona = $state('');
	const selectedName = $derived(places.find((p) => p.municipio === Number(place.municipio))?.nome ?? '');
	// Reset the fields to the selected município whenever the selection (or its name) changes.
	$effect(() => {
		editCodigo = place.municipio ?? '';
		editName = selectedName;
	});
	const municipioEdited = $derived(!!editName.trim() && Number(editCodigo) > 0 && (Number(editCodigo) !== Number(place.municipio) || editName.trim() !== selectedName));

	const saveMunicipio = action(app, async () => {
		const from = Number(place.municipio), to = Number(editCodigo), nome = editName.trim();
		if (to !== from) {
			await app.loadEditor.renumberMunicipio(from, to);
			place.municipio = to;
		}
		if (nome !== selectedName) await app.loadEditor.renameMunicipio(to, nome);
	});
	const addZona = action(app, async () => {
		const zona = Number(newZona);
		await app.loadEditor.createZona(Number(place.municipio), zona);
		place.zona = zona;
		newZona = '';
	});
</script>

<div class="election" data-testid="load-election">
	<p class="muted small">{t('loadui.election.intro')}</p>

	<section class="card">
		<h3>{t('loadui.election.phase')}</h3>
		<p class="small">{config?.fase === 'of' ? t('phase.official') : t('phase.training')}</p>
		{#if config?.fase === 'of'}
			<p class="small muted">{t('loadui.election.officialNow')}</p>
			<button class="btn small" onclick={toTraining}>{t('loadui.election.toTraining')}</button>
		{:else}
			<p class="small muted">{t('loadui.election.toOfficialBody')}</p>
			<button class="btn small" disabled={!load?.provider} onclick={toOfficial} data-testid="election-to-official">{t('loadui.election.toOfficial')}</button>
			{#if !load?.provider}<p class="warn small">{t('loadui.election.needIdentity')}</p>{/if}
		{/if}
	</section>

	<section class="card">
		<h3>{t('loadui.election.place')}</h3>
		<p class="small muted">{t('loadui.election.placeBody')}</p>
		<div class="place">
			<label class="field">{t('loadui.election.municipality')}
				<select class="input" value={place.municipio} onchange={(e) => pickMunicipio(e.currentTarget.value)} data-testid="election-municipio">
					{#each places as p (p.municipio)}<option value={p.municipio}>{p.municipio} · {p.nome}</option>{/each}
				</select>
			</label>
			<label class="field">{t('loadui.election.zone')}
				<select class="input" bind:value={place.zona} data-testid="election-zona">
					{#each zonas as z}<option value={z}>{z}</option>{/each}
				</select>
			</label>
			<label class="field">{t('loadui.election.section')}
				<input class="input mono" type="number" min="1" max="9999" bind:value={place.secao} data-testid="election-section" />
			</label>
			<button class="btn small" disabled={!changed} onclick={changeLocation} data-testid="election-section-apply">{t('loadui.election.placeApply')}</button>
		</div>
		<button class="link" aria-expanded={editingPlaces} onclick={() => (editingPlaces = !editingPlaces)} data-testid="election-edit-places">{editingPlaces ? '▾' : '▸'} {t('loadui.election.editPlaces')}</button>
		{#if editingPlaces}
			<div class="places-edit" data-testid="election-places-edit">
				<p class="small muted">{t('loadui.election.editPlacesHint')}</p>
				<div class="place-form">
					<span class="group-label">{t('loadui.election.editMunicipality')}</span>
					<label class="field num">{t('loadui.election.municipalityCode')}<input class="input mono" type="number" min="1" max="99999" bind:value={editCodigo} data-testid="edit-municipio-codigo" /></label>
					<label class="field grow">{t('loadui.election.municipalityName')}
						<input class="input" bind:value={editName} data-testid="rename-municipio-name" />
					</label>
					<button class="btn small" disabled={!municipioEdited} onclick={saveMunicipio} data-testid="rename-municipio">{t('loadui.election.saveMunicipality')}</button>
				</div>
				<div class="place-form">
					<span class="group-label">{t('loadui.election.newZone')}</span>
					<label class="field num">{t('loadui.election.zone')}<input class="input mono" type="number" min="1" max="9999" bind:value={newZona} data-testid="new-zona-num" /></label>
					<button class="btn small" disabled={!newZona} onclick={addZona} data-testid="add-zona">{t('loadui.election.addZone')}</button>
				</div>
			</div>
		{/if}
	</section>

	<section class="card">
		<h3>{t('loadui.election.fromScenario')}</h3>
		<p class="small muted">{t('loadui.election.fromScenarioBody')}</p>
		<div class="uf-edit">
			<label class="field">
				<span class="group-label">{t('loadui.election.scenario')}</span>
				<select class="input" bind:value={newScenario} data-testid="election-scenario">
					{#each app.scenarios as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
				</select>
			</label>
			<button class="btn small" disabled={!newScenario || newScenario === $engine?.scenario?.id} onclick={switchScenario} data-testid="election-scenario-apply">{t('loadui.election.scenarioApply')}</button>
		</div>
		<dl>
			{#each fixed as [label, value]}
				<div><dt>{label}</dt><dd class="mono">{value}</dd></div>
			{/each}
		</dl>
		<div class="uf-edit">
			<label class="field">
				<span class="group-label">{t('loadui.election.uf')}</span>
				<select class="input" bind:value={newUf} data-testid="election-uf">
					{#each UFS as u (u.sigla)}<option value={u.sigla}>{u.sigla.toUpperCase()} · {u.nome}</option>{/each}
				</select>
			</label>
			<button class="btn small" disabled={!newUf || newUf === config?.uf} onclick={changeUf} data-testid="election-uf-apply">{t('loadui.election.ufApply')}</button>
		</div>
		<p class="warn small">{t('loadui.election.ufExperimental')}</p>
	</section>
	<p class="note small">{t('loadui.election.note')}</p>
</div>

<style>
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.card h3 {
		margin: 0;
		font-size: 14px;
	}
	.card p {
		margin: 0;
	}
	.place {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-3);
	}
	.place .field {
		display: grid;
		gap: 4px;
		flex: 1 1 130px;
		color: var(--muted);
		font-size: 12.5px;
	}
	.place .field:first-child {
		flex: 2 1 240px;
	}
	.place .field .input {
		width: 100%;
	}
	.place > .btn {
		flex: 0 0 auto;
	}
	.card > .btn {
		justify-self: start;
	}
	.link {
		justify-self: start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.places-edit {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
	}
	.places-edit p {
		margin: 0;
	}
	.place-form {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-2) var(--space-3);
	}
	.place-form .field {
		display: grid;
		gap: 4px;
		color: var(--muted);
		font-size: 12.5px;
	}
	.place-form .field.grow {
		flex: 1 1 160px;
	}
	.place-form .field.num {
		flex: 0 0 90px;
	}
	.place-form .field .input {
		width: 100%;
	}
	.group-label {
		flex-basis: 100%;
		color: var(--muted);
		font: 600 11.5px var(--font-display);
		letter-spacing: 0.04em;
	}
	.uf-edit {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
	}
	.uf-edit .field {
		display: grid;
		gap: 4px;
		flex: 1 1 220px;
	}
	.uf-edit .field .input {
		width: 100%;
	}
	.warn {
		color: var(--danger);
	}
	.election {
		display: grid;
		gap: var(--space-3);
		max-width: 640px;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	dl div {
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
		font-size: 15px;
	}
	.note {
		padding: var(--space-3);
		border-left: 3px solid var(--accent);
		background: var(--accent-softer);
		line-height: 1.55;
	}
</style>
