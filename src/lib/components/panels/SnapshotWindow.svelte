<script>
	// Session snapshots: save the running session to a file; open one to resume it (VOTA's own
	// restart path), start over with its configuration, or look at its files and paper read-only.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { createSnapshot, validateSnapshot, restoreSnapshot, snapshotSource } from '#lib/engine/snapshot.js';
	import ResultView from '#lib/components/viewers/ResultView.svelte';
	import LogArchiveView from '#lib/components/viewers/LogArchiveView.svelte';
	import HexView from '#lib/components/ui/HexView.svelte';
	import { opened } from './snapshot.svelte.js';

	let { tab = 'instantaneo' } = $props();
	const { app, engine } = useEngine();
	const s = $derived($engine);

	const snapshot = $derived(opened.snapshot);
	const source = $derived(opened.source);
	let selected = $state(null);
	let filter = $state('');
	let busy = $state(false);

	const save = action(app, async () => {
		busy = true;
		try {
			const snap = await createSnapshot(app);
			const stamp = snap.createdAt.replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
			app.downloadBytes(new TextEncoder().encode(JSON.stringify(snap)), `urnaemu-${snap.scenario}-${stamp}.urnaemu.json`);
		} finally {
			busy = false;
		}
	});
	const open = action(app, async (event) => {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const parsed = validateSnapshot(JSON.parse(await file.text()));
		opened.snapshot = parsed;
		opened.fileName = file.name;
		opened.source = snapshotSource(parsed);
		selected = null;
	});
	const restore = action(app, async (resume) => {
		busy = true;
		try {
			await restoreSnapshot(app, snapshot, { resume });
		} finally {
			busy = false;
		}
	});
	function close() {
		opened.snapshot = null;
		opened.source = null;
		opened.fileName = '';
		selected = null;
	}

	const sum = $derived(snapshot?.summary ?? {});
	const canResume = $derived(!!snapshot && sum.session && snapshot.files.length > 0);
	const savedPaths = $derived(new Set((snapshot?.files ?? []).map((f) => f.path)));
	const paths = $derived(source ? source.paths().filter((p) => !filter || p.toLowerCase().includes(filter.toLowerCase())) : []);
	const kindOf = (path) => (/-(bu|rdv)\.dat$|-vota\.vsc$/.test(path) ? 'result' : /\.jez$/.test(path) ? 'archive' : 'bytes');
	const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
	const when = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
</script>

<div class="snapshot" data-testid="snapshot-window" data-loaded={snapshot ? 'true' : 'false'}>
	{#if tab === 'instantaneo'}
		<section class="block">
			<h3>{t('snapshot.saveTitle')}</h3>
			<p class="muted small">{t('snapshot.saveBody')}</p>
			<div class="row">
				<button class="btn small primary" onclick={save} disabled={busy || !s?.ready} data-testid="snapshot-save">{t('snapshot.save')}</button>
			</div>
		</section>

		<section class="block">
			<h3>{t('snapshot.openTitle')}</h3>
			<div class="row">
				<label class="btn small">{t('snapshot.open')}<input type="file" accept=".json,application/json" hidden onchange={open} data-testid="snapshot-file" /></label>
				{#if snapshot}<span class="muted small mono">{opened.fileName}</span><button class="btn small ghost" onclick={close}>{t('snapshot.close')}</button>{/if}
			</div>
			{#if snapshot}
				<dl class="facts">
					<div><dt>{t('snapshot.scenario')}</dt><dd>{snapshot.scenarioLabel ?? snapshot.scenario}</dd></div>
					<div><dt>{t('snapshot.phase')}</dt><dd>{snapshot.load.config.fase === 'of' ? t('phase.official') : t('phase.training')} · {t('data.sectionValue', { uf: String(snapshot.load.config.uf).toUpperCase(), municipio: snapshot.load.config.municipio, zona: snapshot.load.config.zona, secao: snapshot.load.config.secao })}</dd></div>
					<div><dt>{t('snapshot.created')}</dt><dd>{when(snapshot.createdAt)}</dd></div>
					<div><dt>{t('snapshot.urnaClock')}</dt><dd>{when(snapshot.clock?.now)}</dd></div>
					<div><dt>{t('snapshot.state')}</dt><dd>{!sum.session ? t('snapshot.stateSimple') : sum.closed ? t('snapshot.stateClosed') : sum.booting ? t('snapshot.stateOpening') : t('snapshot.stateVoting', { n: sum.votes ?? 0 })}</dd></div>
					<div><dt>{t('snapshot.identity')}</dt><dd>{snapshot.identity?.name ?? (snapshot.identity ? t('snapshot.identityUnnamed') : '—')}</dd></div>
					<div><dt>{t('snapshot.files')}</dt><dd>{t('snapshot.filesValue', { load: snapshot.load.files.length, saved: snapshot.files.length })}</dd></div>
					{#if snapshot.runtime && !snapshot.runtime.supported}<div><dt>VOTA</dt><dd class="warn">{t('snapshot.unsupported')}</dd></div>{/if}
				</dl>
				<div class="choices">
					<div class="choice">
						<button class="btn small primary" disabled={busy || !canResume} onclick={() => restore(true)} data-testid="snapshot-resume">{t('snapshot.resume')}</button>
						<p class="muted small">{canResume ? t('snapshot.resumeBody') : t('snapshot.resumeUnavailable')}</p>
					</div>
					<div class="choice">
						<button class="btn small" disabled={busy} onclick={() => restore(false)} data-testid="snapshot-restart">{t('snapshot.restart')}</button>
						<p class="muted small">{t('snapshot.restartBody')}</p>
					</div>
				</div>
			{/if}
		</section>
		<p class="note small">{t('snapshot.limits')}</p>
	{:else if !snapshot}
		<p class="muted small">{t('snapshot.none')}</p>
	{:else if tab === 'arquivos'}
		<div class="files">
			<div class="list">
				<input class="input search" type="search" placeholder={t('log.filter')} bind:value={filter} />
				<ul>
					{#each paths as path (path)}
						<li>
							<button class:active={selected === path} onclick={() => (selected = path)}>
								<span class="mono name">{path.replace('/dsk/fi/', '')}</span>
								<span class="muted small">{savedPaths.has(path) ? t('snapshot.savedFile') : t('snapshot.loadFile')} · {size(source.size(path))}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
			<div class="view">
				{#if !selected}
					<p class="muted small">{t('snapshot.pick')}</p>
				{:else if kindOf(selected) === 'result'}
					<ResultView path={selected} {source} />
				{:else if kindOf(selected) === 'archive'}
					<LogArchiveView bytes={source.readFile(selected)} />
				{:else}
					<HexView bytes={source.readFile(selected).slice(0, 65536)} />
				{/if}
			</div>
		</div>
	{:else if tab === 'bobina'}
		{#if snapshot.printer?.text}
			<pre class="paper" data-testid="snapshot-paper">{snapshot.printer.text}</pre>
		{:else}
			<p class="muted small">{t('snapshot.noPaper')}</p>
		{/if}
	{/if}
</div>

<style>
	.snapshot {
		display: grid;
		gap: var(--space-3);
		height: 100%;
		align-content: start;
	}
	.block {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-2) var(--space-4);
		margin: var(--space-2) 0 0;
	}
	.facts dt {
		color: var(--muted);
		font-size: 12px;
	}
	.facts dd {
		margin: 0;
		font-size: 13.5px;
	}
	.warn {
		color: var(--warning);
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.choice {
		display: grid;
		gap: 6px;
		align-content: start;
		justify-items: start;
	}
	.choice p {
		margin: 0;
		line-height: 1.5;
	}
	.note {
		margin: 0;
		padding: var(--space-3);
		border-left: 3px solid var(--border);
		background: var(--surface-alt);
		line-height: 1.55;
	}
	.files {
		display: grid;
		grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
		gap: var(--space-3);
		min-height: 0;
		height: 100%;
	}
	.list {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--space-2);
		min-height: 0;
	}
	.list ul {
		margin: 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}
	.list button {
		display: grid;
		width: 100%;
		padding: 4px 8px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		text-align: left;
		cursor: pointer;
	}
	.list button:hover,
	.list button.active {
		background: var(--accent-soft);
	}
	.name {
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.view {
		min-width: 0;
		overflow: auto;
	}
	.search {
		min-height: 32px;
		font-size: 13px;
	}
	.paper {
		margin: 0 auto;
		padding: var(--space-3);
		max-width: 420px;
		background: #fffdf6;
		color: #1b1b1b;
		font: 12px/1.35 'DejaVu Sans Mono', ui-monospace, monospace;
		white-space: pre-wrap;
		box-shadow: var(--shadow);
	}
	@media (max-width: 720px) {
		.files {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
