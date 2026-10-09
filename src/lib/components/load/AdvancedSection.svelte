<script>
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	const editor = app.loadEditor;

	let selected = $state(null);
	let treeDraft = $state('');
	let configDraft = $state('');

	const load = $derived($engine?.load);
	const revision = $derived(load?.revision ?? 0);
	const files = $derived((revision, editor.list()));
	const info = $derived((revision, selected ? editor.fileInfo(selected) : null));
	const fields = $derived((revision, selected ? editor.fields(selected) : []));

	$effect(() => {
		revision;
		if (!selected || !editor.files.has(selected)) selected = files.find((f) => f.path.endsWith('-cp.dat'))?.path ?? files[0]?.path ?? null;
	});
	$effect(() => {
		revision;
		treeDraft = selected ? (editor.treeText(selected) ?? '') : '';
		configDraft = JSON.stringify(editor.readConfig(), null, 2);
	});

	const run = (fn) => action(app, fn);
	const setField = run((berPath, value) => editor.setField(selected, berPath, value));
	const saveTree = run(() => editor.saveTree(selected, treeDraft));
	const saveConfig = run(() => editor.setConfig(configDraft));
	const downloadFile = run(() => app.downloadBytes(editor.files.get(selected), selected.split('/').pop()));

	function fileHandler(fn) {
		return run(async (event) => {
			const input = event.currentTarget;
			const file = input.files?.[0];
			if (!file) return;
			try {
				await fn(file);
			} finally {
				input.value = '';
			}
		});
	}
	const replace = fileHandler(async (file) => editor.replaceFile(selected, await file.arrayBuffer()));
</script>

<div class="editor stack">
	<p class="muted small">{t('loadui.advanced.intro')}</p>


	<label class="field">
		{t('load.file')}
		<select class="input" bind:value={selected} data-testid="load-files">
			{#each files as file}
				<option value={file.path}>{file.category} · {file.name}</option>
			{/each}
		</select>
	</label>
	{#if info}
		<p class="muted small mono">
			{info.path} · {t('load.bytes', { n: info.size })} · {info.unchanged ? t('load.unchanged') : t('load.modified')}
		</p>
	{/if}

	<div class="fields" data-testid="load-fields">
		<span class="eyebrow">{t('load.fields')}</span>
		{#each fields as field (field.berPath)}
			<label class="field">
				<span>{field.label} <span class="faint mono">/{field.berPath}</span></span>
				<input class="input" value={field.text} data-ber-path={field.berPath} onchange={(e) => setField(field.berPath, e.currentTarget.value)} />
			</label>
		{:else}
			<p class="muted small">{info && !editor.tree(selected) ? t('load.opaque') : t('load.noFields')}</p>
		{/each}
	</div>

	<details>
		<summary>{t('load.advanced')}</summary>
		<div class="stack inner">
			{#if editor.tree(selected)}
				<textarea class="input" rows="12" spellcheck="false" bind:value={treeDraft}></textarea>
				<div class="row"><button class="btn small" onclick={saveTree}>{t('load.saveTree')}</button></div>
			{/if}
			<div class="row">
				<button class="btn small ghost" onclick={downloadFile}>{t('load.download')}</button>
				<label class="btn small ghost">{t('load.replace')}<input type="file" hidden onchange={replace} /></label>
			</div>
		</div>
	</details>

	<details>
		<summary>{t('load.config')}</summary>
		<div class="stack inner">
			<textarea class="input" rows="10" spellcheck="false" bind:value={configDraft} onchange={saveConfig}></textarea>
		</div>
	</details>

</div>

<style>
	.fields {
		display: grid;
		gap: var(--space-3);
		max-height: 420px;
		overflow: auto;
		padding-right: 4px;
	}
	.faint {
		color: var(--faint);
		font-size: 11px;
	}
	details {
		border-top: 1px solid var(--border);
		padding-top: var(--space-3);
	}
	summary {
		cursor: pointer;
		font: 600 13.5px var(--font-display);
	}
	.inner {
		margin-top: var(--space-3);
	}
	label.btn {
		position: relative;
	}
</style>
