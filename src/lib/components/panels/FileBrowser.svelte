<script>
	// Browser for the emulator's virtual file system (MEMFS): load media, VOTA's dynamic
	// data, result media and logs. Reads go through the engine queue, between native calls.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { category } from '#lib/engine/load/load-editor.js';
	import FileIcon from '#lib/components/ui/FileIcon.svelte';
	import HexView from '#lib/components/ui/HexView.svelte';
	import ResultView from '#lib/components/viewers/ResultView.svelte';
	import LogArchiveView from '#lib/components/viewers/LogArchiveView.svelte';
	import { writeZip } from '#lib/results/zip.js';
	// Decoded views: BU/RDV/signature catalog → verified results; .jez → archived log.
	const resultKind = (name) => (/-(bu|rdv)\.dat$|-vota\.vsc$/.test(name) ? 'result' : /\.jez$/.test(name) ? 'archive' : null);

	const { app, engine } = useEngine();
	let { open = false } = $props();

	const PLACES = [
		{ path: '/dsk/fi/estatico', label: t('files.places.load') },
		{ path: '/dsk/fi/dinamico', label: t('files.places.dynamic') },
		{ path: '/dsk/mr', label: t('files.places.result') },
		{ path: '/dsk/fi/dinamico/log', label: t('files.places.log') },
		{ path: '/', label: t('files.places.root') }
	];
	// Result and runtime files, by suffix: description key and icon.
	const KINDS = [
		[/-bu\.dat$/, 'files.kinds.bu', 'report'],
		[/-imgbu\.dat$/, 'files.kinds.imgbu', 'report'],
		[/-rdv\.dat$/, 'files.kinds.rdv', 'report'],
		[/wsq.*\.jez$/, 'files.kinds.biometrics', 'archive'],
		[/(^|-)log\.jez$|logd\.dat$/, 'files.kinds.log', 'log'],
		[/-imgze\.dat$|ze\.dat$/, 'files.kinds.zeresima', 'report'],
		[/-hash\.dat$/, 'files.kinds.hash', 'data'],
		[/\.vsc$|\.vsu$/, 'files.kinds.signature', 'signature'],
		[/-jufa\.dat$/, 'files.kinds.jufa', 'data'],
		[/\.ver$/, 'files.kinds.version', 'data'],
		[/\.(jez|zip)$/, 'files.kinds.archive', 'archive']
	];
	const MAX_PREVIEW = 4 * 1024 * 1024;
	// Images by magic bytes (load media may store photos under .dat names).
	function imageType(bytes) {
		const b = bytes;
		if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
		if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
		if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
		if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
		if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
		// SVG is markup: shown through <img>, so any script inside never runs.
		const head = decoder.decode(b.subarray(0, 1024)).replace(/^\uFEFF/, '').trimStart();
		if ((head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!--')) && /<svg[\s>]/i.test(head)) return 'image/svg+xml';
		return null;
	}
	const decoder = new TextDecoder('windows-1252');

	let path = $state('/dsk/fi/dinamico');
	let entries = $state([]);
	let selected = $state(null);
	let preview = $state(null);
	let mode = $state('text');
	let imageUrl = $state(null);
	let imageSize = $state(null);
	let error = $state(null);

	function kindOf(entry) {
		if (entry.isDir) return t('files.folder');
		for (const [pattern, key] of KINDS) if (pattern.test(entry.name)) return t(key);
		if (entry.path.startsWith('/dsk/fi/estatico/')) return category(entry.path);
		return '';
	}
	function iconOf(entry) {
		if (entry.isDir) return 'folder';
		for (const [pattern, , icon] of KINDS) if (pattern.test(entry.name)) return icon;
		return entry.name.endsWith('.dat') ? 'data' : 'file';
	}
	const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

	async function load(next = path) {
		error = null;
		try {
			const listing = await app.browse(next);
			if (listing.kind !== 'directory') return select({ path: next, name: next.split('/').pop() });
			path = next;
			const fs = globalThis.Module.FS;
			entries = listing.entries
				.filter((e) => e.name !== '..')
				.map((e) => {
					let st = null;
					try {
						st = fs.stat(e.path);
					} catch {}
					return { ...e, size: st?.size ?? 0, mtime: st?.mtime ? new Date(st.mtime) : null };
				})
				.sort((a, b) => b.isDir - a.isDir || a.name.localeCompare(b.name));
			if (selected && !entries.some((e) => e.path === selected.path)) (selected = null), (preview = null);
		} catch (e) {
			error = String(e.message ?? e);
			entries = [];
		}
	}
	async function select(entry) {
		if (entry.isDir) return load(entry.path);
		selected = entry;
		try {
			const bytes = app.readFile(entry.path);
			preview = { bytes: bytes.slice(0, MAX_PREVIEW), total: bytes.length, image: imageType(bytes) };
			if (imageUrl) URL.revokeObjectURL(imageUrl);
			imageUrl = preview.image ? URL.createObjectURL(new Blob([bytes], { type: preview.image })) : null;
			imageSize = null;
			preview.decoded = resultKind(entry.name);
			if (preview.image) mode = 'image';
			else if (preview.decoded) mode = 'decoded';
			else if (mode === 'image' || mode === 'decoded') mode = 'text';
		} catch (e) {
			preview = null;
			error = String(e.message ?? e);
		}
	}
	const download = action(app, () => app.downloadBytes(app.readFile(selected.path), selected.name));
	/** The current directory (recursively) as a ZIP. */
	const downloadZip = action(app, async () => {
		const fs = globalThis.Module.FS, entries = [];
		(function walk(dir, prefix) {
			for (const name of fs.readdir(dir)) {
				if (name === '.' || name === '..') continue;
				const full = (dir === '/' ? '' : dir) + '/' + name;
				let st;
				try {
					st = fs.lstat(full);
				} catch {
					continue;
				}
				if (fs.isDir(st.mode)) {
					if (!['/proc', '/dev'].includes(full)) walk(full, prefix + name + '/');
				} else if (fs.isFile(st.mode)) entries.push({ name: prefix + name, bytes: fs.readFile(full), mtime: st.mtime ? new Date(st.mtime) : null });
			}
		})(path, '');
		if (!entries.length) throw Error(t('files.zipEmpty'));
		const base = path === '/' ? 'raiz' : path.split('/').filter(Boolean).join('-');
		app.downloadBytes(await writeZip(entries), `${base}.zip`);
	});
	const toggleMedia = action(app, async () => {
		if ($engine.resultMedia.present) app.media.eject();
		else app.media.insert();
		await load(path);
	});
	const crumbs = $derived(path === '/' ? [] : path.split('/').filter(Boolean).map((part, i, all) => ({ name: part, path: '/' + all.slice(0, i + 1).join('/') })));
	const printable = $derived(preview ? preview.bytes.subarray(0, 4096).every((b) => b === 9 || b === 10 || b === 13 || b >= 32) : false);

	// Refresh while open: when VOTA logs, prints or the runtime becomes ready.
	const pulse = $derived(`${$engine?.logdRevision}:${$engine?.printer?.operations}:${$engine?.ready}:${open}`);
	$effect(() => {
		pulse;
		if (open && $engine?.ready) load(path);
	});
</script>

<div class="files" data-testid="file-browser">
	<nav class="places" aria-label={t('files.places.title')}>
		{#each PLACES as place}
			<div class="place-row">
				<button class="place" class:active={path === place.path} onclick={() => load(place.path)}>
					<span>{place.label}</span>
					<span class="mono faint">{place.path}</span>
				</button>
				{#if place.path === '/dsk/mr' && $engine?.resultMedia}
					<button
						class="eject"
						title={$engine.resultMedia.present ? t('controls.eject') : t('controls.insert')}
						aria-label={$engine.resultMedia.present ? t('controls.eject') : t('controls.insert')}
						data-testid="result-media-eject"
						onclick={toggleMedia}
					>
						{#if $engine.resultMedia.present}
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8H5z" /><path d="M5 18h14" /></svg>
						{:else}
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l7-8H5z" /><path d="M5 6h14" /></svg>
						{/if}
					</button>
				{/if}
			</div>
		{/each}
	</nav>

	<div class="main">
		<div class="crumbs">
			<button class="crumb" onclick={() => load('/')}>/</button>
			{#each crumbs as crumb}
				<span class="sep">›</span>
				<button class="crumb" onclick={() => load(crumb.path)}>{crumb.name}</button>
			{/each}
			<div class="tools">
				<button class="btn" onclick={downloadZip} title={t('files.zipHint')} data-testid="download-zip">{t('files.zip')}</button>
				<button class="btn icon-btn" onclick={() => load(path)} title={t('files.refresh')} aria-label={t('files.refresh')}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4.5V11h-6.5" /></svg>
				</button>
			</div>
		</div>

		{#if error}<p class="error small">{error}</p>{/if}

		<div class="split">
			<div class="list" role="listbox" aria-label={path}>
				{#each entries as entry (entry.path)}
					<button class="entry" class:selected={selected?.path === entry.path} class:dir={entry.isDir} onclick={() => select(entry)} title={kindOf(entry) || entry.name}>
						<FileIcon kind={iconOf(entry)} />
						<span class="name">{entry.name}</span>
						<span class="size mono">{entry.isDir ? '' : size(entry.size)}</span>
					</button>
				{:else}
					<p class="muted small empty">{t('files.empty')}</p>
				{/each}
			</div>

			<div class="preview">
				{#if selected && preview}
					<div class="preview-head">
						<div>
							<strong class="mono">{selected.name}</strong>
							<p class="muted small">{kindOf(selected) || t('files.file')} · {size(preview.total)}{selected.mtime ? ` · ${selected.mtime.toLocaleString('pt-BR')}` : ''}</p>
						</div>
						<div class="row">
							<div class="segmented">
								{#if preview.image}<button class:active={mode === 'image'} onclick={() => (mode = 'image')}>{t('files.image')}</button>{/if}
								{#if preview.decoded}<button class:active={mode === 'decoded'} onclick={() => (mode = 'decoded')}>{preview.decoded === 'result' ? t('files.result') : t('files.log')}</button>{/if}
								<button class:active={mode === 'text'} onclick={() => (mode = 'text')}>{t('files.text')}</button>
								<button class:active={mode === 'hex'} onclick={() => (mode = 'hex')}>{t('files.hex')}</button>
							</div>
							<button class="btn small" onclick={download}>{t('files.download')}</button>
						</div>
					</div>
					{#if mode === 'decoded' && preview.decoded === 'result'}
						<ResultView path={selected.path} />
					{:else if mode === 'decoded' && preview.decoded === 'archive'}
						<LogArchiveView bytes={preview.bytes} />
					{:else if mode === 'image' && imageUrl}
						<div class="image">
							<img src={imageUrl} alt={selected.name} onload={(e) => (imageSize = `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)} />
						</div>
						{#if imageSize}<p class="muted small mono">{preview.image} · {imageSize} px</p>{/if}
					{:else if mode === 'hex' || !printable}
						{#if mode === 'text'}<p class="muted small">{t('files.binary')}</p>{/if}
						<HexView bytes={preview.bytes} />
					{:else}
						<pre class="code-block content">{decoder.decode(preview.bytes.subarray(0, 262144))}</pre>
					{/if}
					{#if preview.total > preview.bytes.length}<p class="muted small">{t('files.truncated')}</p>{/if}
				{:else}
					<p class="muted small empty">{t('files.select')}</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.files {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		gap: var(--space-4);
		height: 100%;
		min-height: 0;
	}
	.places {
		display: grid;
		align-content: start;
		gap: 2px;
	}
	.place-row {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.place-row .place {
		flex: 1;
		min-width: 0;
	}
	.eject {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.eject:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.eject svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.place {
		display: grid;
		gap: 1px;
		padding: 7px 10px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: 500 13px var(--font-body);
		text-align: left;
		cursor: pointer;
	}
	.place:hover {
		background: var(--surface-hover);
	}
	.place.active {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.faint {
		color: var(--faint);
		font-size: 10.5px;
	}
	.main {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: var(--space-2);
		min-width: 0;
		min-height: 0;
	}
	.crumbs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
		font-size: 13px;
	}
	.crumb {
		padding: 2px 6px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--accent);
		font: 500 13px var(--font-mono);
		cursor: pointer;
	}
	.crumb:hover {
		background: var(--accent-soft);
	}
	.sep {
		color: var(--faint);
	}
	.tools {
		display: flex;
		gap: var(--space-2);
		margin-left: auto;
	}
	.icon-btn {
		width: 34px;
		padding: 0;
	}
	.icon-btn svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.error {
		color: var(--danger);
	}
	.split {
		display: grid;
		grid-template-columns: minmax(200px, 0.75fr) minmax(0, 1.6fr);
		gap: var(--space-3);
		min-height: 0;
	}
	.list,
	.preview {
		min-height: 0;
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	/* Uniform rows: icon · name · size; the file type is in the tooltip. */
	.entry {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 12px;
		width: 100%;
		height: 44px;
		padding: 0 12px;
		border: 0;
		border-bottom: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		text-align: left;
		cursor: pointer;
	}
	.entry:hover {
		background: var(--surface-hover);
	}
	.entry.selected {
		background: var(--accent-soft);
	}
	.entry :global(.icon) {
		color: var(--muted);
	}
	.entry.dir :global(.icon) {
		color: var(--accent);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font: 13px var(--font-mono);
	}
	.size {
		color: var(--faint);
		font-size: 11.5px;
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
	}
	.preview-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
	}
	/* Checkerboard so transparent pixels are visible. */
	.image {
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: auto;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: repeating-conic-gradient(var(--surface-alt) 0 25%, var(--surface) 0 50%) 0 0 / 16px 16px;
	}
	.image img {
		max-width: 100%;
		max-height: 100%;
		image-rendering: auto;
	}
	.content {
		flex: 1;
		max-height: none;
		margin: 0;
	}
	.segmented {
		display: flex;
		padding: 2px;
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
	}
	.segmented button {
		height: 32px;
		padding: 0 14px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--muted);
		font: 500 12px var(--font-body);
		cursor: pointer;
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--accent);
	}
	.empty {
		padding: var(--space-4);
	}
</style>
