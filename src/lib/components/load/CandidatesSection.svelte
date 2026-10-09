<script>
	// Candidates and parties (-ca, -pa, -fo; engine/load/candidates.js): edit, add and remove
	// parties and candidacies (titular with vice or suplentes), with photos.
	import { onDestroy } from 'svelte';
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { candidateDraft } from './draft.svelte.js';
	import DateField from '#lib/components/ui/DateField.svelte';

	const { app, engine } = useEngine();
	const editor = app.loadEditor;
	const revision = $derived($engine?.load?.revision ?? 0);

	let model = $state([]);
	let dirty = $state(candidateDraft.dirty);
	$effect(() => {
		candidateDraft.dirty = dirty;
	});
	let problems = $state([]);
	let filter = $state('');
	let open = $state(null);
	let confirmParty = $state(null);
	let adding = $state({});
	// New or replaced photos: candidate code → JPEG bytes, and preview URLs per code.
	let photos = new Map();
	let previews = $state({});
	const urls = new Set();

	function previewUrl(bytes) {
		const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
		urls.add(url);
		return url;
	}
	function resetPreviews() {
		for (const url of urls) URL.revokeObjectURL(url);
		urls.clear();
		stored.clear();
		previews = {};
		photos = new Map();
	}
	onDestroy(resetPreviews);

	$effect(() => {
		revision;
		if (!dirty) {
			model = editor.candidates();
			resetPreviews();
		}
	});

	// Photos already in the media, cached outside the reactive state (read during rendering).
	const stored = new Map();
	function photoOf(election, code) {
		if (previews[code]) return previews[code];
		if (!stored.has(code)) {
			const bytes = editor.candidatePhoto(election.path, code);
			stored.set(code, bytes ? previewUrl(bytes) : null);
		}
		return stored.get(code);
	}
	function touch() {
		dirty = true;
		problems = [];
	}
	const sigla = (election, number) => election.parties.find((p) => p.number === number)?.sigla ?? '?';
	const people = (o, c) => [[c.titular, t('loadui.candidates.titular')], ...(c.suplentes ?? []).map((s, i) => [s, o.suplentes[i] ?? t('loadui.candidates.suplente')])];
	const matches = (c) => !filter || [c.number, c.titular.nome, c.titular.nomeUrna, ...(c.suplentes ?? []).map((s) => s.nomeUrna)].join(' ').toLowerCase().includes(filter.toLowerCase());
	const electionTitle = (e) => e.offices.map((o) => o.nome).join(', ');

	function person(code, ordem = null) {
		return { code: String(code), nome: '', nomeUrna: '', fonetico: '', nascimento: '19800101', genero: 2, situacao: 12, ordem, extra: { int: '00', flag: '00' } };
	}
	function addParty(election) {
		const used = new Set(election.parties.map((p) => p.number));
		let number = 10;
		while (used.has(number) && number < 99) number++;
		election.parties.push({ number, sigla: '', nome: '' });
		touch();
	}
	function removeParty(election, party) {
		for (const o of election.offices) o.candidacies = o.candidacies.filter((c) => c.party !== party.number);
		election.parties.splice(election.parties.indexOf(party), 1);
		confirmParty = null;
		touch();
	}
	const candidaciesOf = (election, number) => election.offices.reduce((n, o) => n + o.candidacies.filter((c) => c.party === number).length, 0);

	function suggestNumber(o, party) {
		if (o.majoritario || o.digitos === 2) return party;
		const used = new Set(o.candidacies.map((c) => c.number));
		const width = (o.digitos ?? 5) - 2;
		for (let i = 1; i < 10 ** width; i++) {
			const n = Number(`${party}${String(i).padStart(width, '0')}`);
			if (!used.has(n)) return n;
		}
		return party;
	}
	function addCandidacy(election, o) {
		const key = election.path + o.code, form = adding[key];
		const party = Number(form?.party ?? election.parties[0]?.number);
		const number = Number(form?.number || suggestNumber(o, party));
		const first = Number(editor.nextCandidateCode(model));
		o.candidacies.push({ party, number, titular: person(first), label: '', suplentes: o.suplentes.length ? o.suplentes.map((_, i) => person(first + 1 + i, i + 1)) : null, groupTail: '3000' });
		adding[key] = { party, number: '' };
		open = `${election.path}:${o.code}:${number}`;
		touch();
	}
	function removeCandidacy(o, c) {
		o.candidacies.splice(o.candidacies.indexOf(c), 1);
		touch();
	}
	const setPhoto = action(app, async (event, p, role) => {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const { photoFromImage } = await app.lib.candidatePhoto();
		const bytes = await photoFromImage(file, role);
		photos.set(p.code, bytes);
		previews[p.code] = previewUrl(bytes);
		touch();
	});
	const genericPhoto = action(app, async (p, role) => {
		const { placeholderPhoto } = await app.lib.candidatePhoto();
		const bytes = await placeholderPhoto(p.nomeUrna || p.nome, role);
		photos.set(p.code, bytes);
		previews[p.code] = previewUrl(bytes);
		touch();
	});

	const save = action(app, async () => {
		const snapshot = $state.snapshot(model);
		problems = editor.validateCandidates(snapshot);
		if (problems.length) return;
		await editor.setCandidates(snapshot, photos);
		dirty = false;
	});
	function discard() {
		dirty = false;
		problems = [];
		model = editor.candidates();
		resetPreviews();
	}
</script>

<div class="candidates" data-testid="candidates-editor">
	<p class="muted small">{t('loadui.candidates.intro')}</p>
	<input class="input search" type="search" placeholder={t('loadui.candidates.search')} bind:value={filter} />

	{#each model as election (election.path)}
		<section class="election">
			{#if model.length > 1}<h3>{electionTitle(election)} <span class="muted small mono">{election.path.split('/').pop()}</span></h3>{/if}

			<details class="block">
				<summary><strong>{t('loadui.candidates.parties')}</strong> <span class="muted small">{election.parties.length}</span></summary>
				<table class="parties">
					<thead><tr><th>{t('loadui.candidates.number')}</th><th>{t('loadui.candidates.sigla')}</th><th>{t('loadui.candidates.partyName')}</th><th>{t('loadui.candidates.candidacies')}</th><th></th></tr></thead>
					<tbody>
						{#each election.parties as party (party)}
							{@const count = candidaciesOf(election, party.number)}
							<tr>
								<td><input class="input mono" type="number" min="10" max="99" value={party.number} disabled={count > 0} title={count ? t('loadui.candidates.partyNumberLocked') : ''} onchange={(e) => ((party.number = Number(e.currentTarget.value)), touch())} /></td>
								<td><input class="input" bind:value={party.sigla} oninput={touch} maxlength="20" /></td>
								<td><input class="input" bind:value={party.nome} oninput={touch} maxlength="80" /></td>
								<td class="muted small">{count}</td>
								<td class="actions-cell">
									{#if confirmParty === party}
										<span class="small">{t('loadui.candidates.removePartyConfirm', { n: count })}</span>
										<button class="btn small danger" onclick={() => removeParty(election, party)}>{t('loadui.candidates.remove')}</button>
										<button class="btn small ghost" onclick={() => (confirmParty = null)}>{t('loadui.candidates.cancel')}</button>
									{:else}
										<button class="remove" aria-label={t('loadui.candidates.removeParty')} title={t('loadui.candidates.removeParty')} onclick={() => (count ? (confirmParty = party) : removeParty(election, party))}>✕</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<button class="btn small" onclick={() => addParty(election)} data-testid="party-add">{t('loadui.candidates.addParty')}</button>
			</details>

			{#each election.offices as o (o.code)}
				{@const key = election.path + o.code}
				<details class="block" open={!!filter || model.length === 1}>
					<summary>
						<strong>{o.nome}</strong>
						<span class="muted small">{t('loadui.candidates.officeInfo', { n: o.candidacies.length, digits: o.digitos ?? '?' })}{o.suplentes.length ? ` · ${o.suplentes.join(', ')}` : ''}</span>
					</summary>
					<ul class="list">
						{#each o.candidacies.filter(matches) as c (c)}
							{@const id = `${election.path}:${o.code}:${c.number}`}
							<li class:open={open === id}>
								<div class="row-head">
									{#if photoOf(election, c.titular.code)}<img class="thumb" src={photoOf(election, c.titular.code)} alt="" />{:else}<span class="thumb empty"></span>{/if}
									<span class="mono number">{c.number}</span>
									<span class="name">{c.titular.nomeUrna || t('loadui.candidates.unnamed')}</span>
									<span class="muted small">{sigla(election, c.party)}</span>
									<button class="btn small ghost" onclick={() => (open = open === id ? null : id)}>{open === id ? t('loadui.candidates.close') : t('loadui.candidates.edit')}</button>
									<button class="remove" aria-label={t('loadui.candidates.removeCandidacy')} title={t('loadui.candidates.removeCandidacy')} onclick={() => removeCandidacy(o, c)}>✕</button>
								</div>
								{#if open === id}
									<div class="form">
										<label class="narrow">{t('loadui.candidates.party')}
											<select class="input" value={c.party} onchange={(e) => ((c.party = Number(e.currentTarget.value)), touch())}>
												{#each election.parties as p}<option value={p.number}>{p.number} · {p.sigla}</option>{/each}
											</select>
										</label>
										<label class="narrow">{t('loadui.candidates.number')}<input class="input mono" type="number" value={c.number} onchange={(e) => ((c.number = Number(e.currentTarget.value)), touch())} /></label>
										{#each people(o, c) as [p, role], i (p.code)}
											{@const photoRole = i === 0 ? 'titular' : 'suplente'}
											<fieldset>
												<legend>{role}</legend>
												<div class="photo">
													{#if photoOf(election, p.code)}<img src={photoOf(election, p.code)} alt="" />{:else}<span class="empty">{t('loadui.candidates.photoPending')}</span>{/if}
													<label class="btn small ghost">{t('loadui.candidates.photoChoose')}<input type="file" accept="image/*" hidden onchange={(e) => setPhoto(e, p, photoRole)} /></label>
													<button class="btn small ghost" onclick={() => genericPhoto(p, photoRole)}>{t('loadui.candidates.photoGeneric')}</button>
												</div>
												<div class="fields">
													<label>{t('loadui.candidates.fullName')}<input class="input" bind:value={p.nome} oninput={touch} maxlength="80" /></label>
													<label>{t('loadui.candidates.ballotName')}<input class="input" bind:value={p.nomeUrna} oninput={touch} maxlength="30" /></label>
													<label>{t('loadui.candidates.phonetic')}<input class="input" bind:value={p.fonetico} oninput={touch} maxlength="80" placeholder={t('loadui.candidates.phoneticHint')} /></label>
													<label>{t('loadui.candidates.birth')}<DateField bind:value={p.nascimento} oninput={touch} /></label>
													<label>{t('loadui.candidates.gender')}
														<select class="input" value={p.genero} onchange={(e) => ((p.genero = Number(e.currentTarget.value)), touch())}>
															<option value={4}>{t('loadui.candidates.female')}</option>
															<option value={2}>{t('loadui.candidates.male')}</option>
														</select>
													</label>
													<span class="muted small code">{t('loadui.candidates.code', { code: p.code })}</span>
												</div>
											</fieldset>
										{/each}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
					{#if election.parties.length}
						<div class="add">
							<select class="input" value={adding[key]?.party ?? election.parties[0].number} onchange={(e) => (adding[key] = { ...adding[key], party: Number(e.currentTarget.value), number: '' })} aria-label={t('loadui.candidates.party')}>
								{#each election.parties as p}<option value={p.number}>{p.number} · {p.sigla}</option>{/each}
							</select>
							<input class="input mono" type="number" placeholder={String(suggestNumber(o, Number(adding[key]?.party ?? election.parties[0].number)))} value={adding[key]?.number ?? ''} oninput={(e) => (adding[key] = { ...adding[key], number: e.currentTarget.value })} aria-label={t('loadui.candidates.number')} />
							<button class="btn small" onclick={() => addCandidacy(election, o)} data-testid="candidacy-add">{t('loadui.candidates.addCandidacy')}</button>
						</div>
					{/if}
				</details>
			{/each}
		</section>
	{:else}
		<p class="muted small">{t('loadui.candidates.none')}</p>
	{/each}

	<p class="note small">{t('loadui.candidates.limits')}</p>

	{#if problems.length}
		<ul class="problems small">
			{#each problems.slice(0, 8) as p}<li>{p}</li>{/each}
			{#if problems.length > 8}<li>… {problems.length - 8}</li>{/if}
		</ul>
	{/if}

	<div class="row footer">
		{#if dirty}<button class="btn small ghost" onclick={discard}>{t('loadui.voters.discard')}</button>{/if}
		<button class="btn small primary" disabled={!dirty} onclick={save} data-testid="candidates-save">{t('loadui.voters.save')}</button>
	</div>
</div>

<style>
	.candidates {
		display: grid;
		gap: var(--space-3);
	}
	.search {
		max-width: 320px;
	}
	.election {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-size: 14px;
	}
	.block {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.block[open] > :not(summary) {
		margin-top: var(--space-2);
	}
	summary {
		cursor: pointer;
		font-size: 13.5px;
	}
	.candidates :global(.input) {
		min-height: 32px;
		padding: 4px 8px;
		font-size: 13px;
	}
	.parties {
		width: 100%;
		border-collapse: collapse;
	}
	.parties th {
		padding: 4px 6px;
		color: var(--muted);
		font: 600 10.5px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
	}
	.parties td {
		padding: 3px 4px;
		border-top: 1px solid var(--border);
	}
	.parties td:first-child {
		width: 76px;
	}
	.parties td:nth-child(2) {
		width: 110px;
	}
	.parties td:nth-child(4) {
		width: 90px;
	}
	.parties .input {
		width: 100%;
	}
	.actions-cell {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		justify-content: flex-end;
	}
	.list {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list li {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.list li.open {
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.row-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: 4px 8px;
	}
	.thumb {
		width: 26px;
		height: 36px;
		object-fit: cover;
		border-radius: 2px;
		background: var(--surface-alt);
	}
	.number {
		min-width: 52px;
		font-weight: 600;
	}
	.name {
		flex: 1;
		min-width: 120px;
	}
	.form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-3);
		border-top: 1px solid var(--border);
	}
	.form label {
		display: grid;
		align-content: start;
		gap: 3px;
		font-size: 12px;
		color: var(--muted);
	}
	.narrow {
		width: 150px;
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		flex-basis: 100%;
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	legend {
		padding: 0 4px;
		font-size: 12.5px;
		font-weight: 600;
	}
	.photo {
		display: grid;
		gap: 4px;
		justify-items: start;
		width: 120px;
	}
	.photo img,
	.photo .empty {
		width: 90px;
		height: 126px;
		object-fit: cover;
		border: 1px solid var(--border);
		border-radius: 2px;
	}
	.photo .empty,
	.thumb.empty {
		display: grid;
		place-items: center;
		padding: 4px;
		background: var(--surface-alt);
		color: var(--muted);
		font-size: 11px;
		text-align: center;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}
	.code {
		align-self: end;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.add .input {
		width: 160px;
	}
	.remove {
		border: 0;
		background: transparent;
		color: var(--faint);
		cursor: pointer;
	}
	.remove:hover {
		color: var(--danger);
	}
	.note {
		margin: 0;
		padding: var(--space-3);
		border-left: 3px solid var(--border);
		background: var(--surface-alt);
		line-height: 1.55;
	}
	.problems {
		margin: 0;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.footer {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}
</style>
