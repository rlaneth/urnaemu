<script>
	// Eleitorado editor: edit, add, remove, generate fictitious voters, CSV import/export.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { titleCheckDigits } from '#lib/engine/load/eleitorado-generator.js';
	import { voterDraft } from './draft.svelte.js';
	import DateField from '#lib/components/ui/DateField.svelte';

	const { app, engine } = useEngine();
	const editor = app.loadEditor;
	const revision = $derived($engine?.load?.revision ?? 0);

	let rows = $state([]);
	// Unsaved edits are shared so the summary can block preparing an official session.
	let dirty = $state(voterDraft.dirty);
	$effect(() => {
		voterDraft.dirty = dirty;
	});
	let generateCount = $state(20);
	let problems = $state([]);
	let filter = $state('');

	// Reload from the draft when it changes elsewhere (unless there are unsaved edits here).
	$effect(() => {
		revision;
		if (!dirty) rows = editor.voters().map((v) => ({ ...v }));
	});
	const valid = (v) => editor.validateVoters([v]).length === 0;
	const shown = $derived(filter ? rows.filter((r) => (r.title + r.name + (r.cpf ?? '')).toLowerCase().includes(filter.toLowerCase())) : rows);

	function touch() {
		dirty = true;
		problems = [];
	}
	function addRow() {
		rows.push({ title: '', name: '', birth: '', cpf: '' });
		touch();
	}
	function removeRow(row) {
		rows.splice(rows.indexOf(row), 1);
		touch();
	}
	function fixDigits(row) {
		const digits = row.title.replace(/\D/g, '');
		if (digits.length >= 10) row.title = digits.slice(0, 10) + titleCheckDigits(digits.slice(0, 8), digits.slice(8, 10));
		touch();
	}
	const generate = action(app, () => {
		rows.push(...editor.generateVoters(Number(generateCount)).filter((v) => !rows.some((r) => r.title === v.title)));
		touch();
	});
	const save = action(app, async () => {
		problems = editor.validateVoters(rows);
		if (problems.length) return;
		await editor.setVoters(rows.map((r) => ({ title: r.title, name: r.name, birth: r.birth, cpf: (r.cpf ?? '').replace(/\D/g, ''), simulatedBiometrics: !!r.simulatedBiometrics })));
		dirty = false;
	});
	function discard() {
		dirty = false;
		rows = editor.voters().map((v) => ({ ...v }));
		problems = [];
	}
	const importCsv = action(app, async (event) => {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const result = editor.parseVotersCsv(await file.text());
		problems = result.problems;
		if (!result.problems.length) {
			rows = result.voters;
			dirty = true;
		}
	});
	const exportCsv = action(app, () => app.downloadBytes(new TextEncoder().encode(editor.votersCsv(rows)), 'eleitorado.csv'));
</script>

<div class="voters" data-testid="eleitorado-editor">
	<p class="muted small">{t('loadui.voters.intro')}</p>

	<div class="toolbar">
		<input class="input search" type="search" placeholder={t('log.filter')} bind:value={filter} />
		<button class="btn small" onclick={addRow}>{t('loadui.voters.add')}</button>
		<span class="gen">
			<input class="input count" type="number" min="1" max="2000" bind:value={generateCount} aria-label={t('loadui.voters.count')} />
			<button class="btn small" onclick={generate} data-testid="voters-generate">{t('loadui.voters.generate')}</button>
		</span>
		<label class="btn small ghost">{t('loadui.voters.importCsv')}<input type="file" accept=".csv,text/csv,text/plain" hidden onchange={importCsv} /></label>
		<button class="btn small ghost" onclick={exportCsv}>{t('loadui.voters.exportCsv')}</button>
	</div>
	<p class="muted small">{t('loadui.voters.csvHint')}</p>

	<div class="table">
		<table>
			<thead><tr><th>#</th><th>{t('data.title_')}</th><th>{t('data.name')}</th><th>{t('loadui.voters.birth')}</th><th>CPF</th><th>{t('loadui.voters.biometrics')}</th><th></th></tr></thead>
			<tbody>
				{#each shown as row, i (row)}
					<tr class:invalid={!valid(row)}>
						<td class="muted mono">{rows.indexOf(row) + 1}</td>
						<td>
							<span class="title-cell">
								<input class="input mono" bind:value={row.title} oninput={touch} maxlength="14" placeholder="000000000000" />
								{#if row.title && !valid({ ...row, name: row.name || 'x', birth: row.birth || '20000101' })}
									<button class="fix" title={t('loadui.voters.fixDigits')} onclick={() => fixDigits(row)}>DV</button>
								{/if}
							</span>
						</td>
						<td><input class="input" bind:value={row.name} oninput={touch} /></td>
						<td><DateField bind:value={row.birth} oninput={touch} /></td>
						<td><input class="input mono" bind:value={row.cpf} oninput={touch} maxlength="14" placeholder="opcional" title={t('loadui.voters.cpfHint')} /></td>
						<td><input type="checkbox" bind:checked={row.simulatedBiometrics} onchange={touch} aria-label={t('loadui.voters.biometricsFor', { name: row.name })} /></td>
						<td><button class="remove" aria-label={t('loadui.voters.remove')} title={t('loadui.voters.remove')} onclick={() => removeRow(row)}>✕</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if problems.length}
		<ul class="problems small">
			{#each problems.slice(0, 8) as p}<li>{p}</li>{/each}
			{#if problems.length > 8}<li>… {problems.length - 8}</li>{/if}
		</ul>
	{/if}

	<div class="row actions">
		<span class="muted small">{t('loadui.voters.total', { n: rows.length })}</span>
		{#if dirty}<button class="btn small ghost" onclick={discard}>{t('loadui.voters.discard')}</button>{/if}
		<button class="btn small primary" disabled={!dirty} onclick={save} data-testid="voters-save">{t('loadui.voters.save')}</button>
	</div>
</div>

<style>
	.voters {
		display: grid;
		gap: var(--space-3);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.toolbar .input {
		min-height: 32px;
		height: 32px;
		padding: 2px 8px;
		font-size: 13px;
	}
	.search {
		max-width: 200px;
	}
	.gen {
		display: flex;
		gap: 4px;
	}
	.count {
		width: 76px;
	}
	.table {
		max-height: 340px;
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	th:nth-child(1) {
		width: 40px;
	}
	th:nth-child(2) {
		width: 168px;
	}
	/* # · título · nome · nascimento · CPF · remover */
	th:nth-child(4) {
		width: 128px;
	}
	th:nth-child(5) {
		width: 150px;
	}
	th:nth-child(6) { width: 110px; }
	th:nth-child(7) {
		width: 40px;
	}
	td :global(.input) {
		width: 100%;
	}
	th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 6px 8px;
		background: var(--surface-alt);
		color: var(--muted);
		font: 600 10.5px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
	}
	td {
		padding: 3px 6px;
		border-top: 1px solid var(--border);
	}
	td :global(.input) {
		min-height: 30px;
		padding: 4px 8px;
		font-size: 13px;
	}
	tr.invalid td :global(.input) {
		border-color: color-mix(in srgb, var(--danger) 55%, transparent);
	}
	.title-cell {
		display: flex;
		gap: 4px;
	}
	.fix {
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--warning-soft);
		color: var(--warning);
		font: 600 10.5px var(--font-display);
		cursor: pointer;
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
	.problems {
		margin: 0;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.actions {
		justify-content: flex-end;
	}
	.actions span {
		margin-right: auto;
	}
</style>
