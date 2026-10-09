<script>
	// Paged hex viewer: offset · 16 bytes (8 + 8) · Windows-1252 text. Hovering a byte
	// highlights it in both columns.
	import { t } from '#lib/i18n/t.js';

	let { bytes } = $props();

	const PAGE = 4096;
	const ROW = 16;
	const decoder = new TextDecoder('windows-1252');
	let page = $state(0);
	let hover = $state(-1);

	// Back to the first page when another file is shown.
	$effect(() => {
		bytes;
		page = 0;
	});

	const pages = $derived(Math.max(1, Math.ceil(bytes.length / PAGE)));
	const rows = $derived.by(() => {
		const start = page * PAGE, end = Math.min(bytes.length, start + PAGE), out = [];
		for (let offset = start; offset < end; offset += ROW) {
			const cells = [];
			for (let i = 0; i < ROW; i++) {
				const index = offset + i;
				if (index >= end) {
					cells.push(null);
					continue;
				}
				const value = bytes[index];
				const char = value >= 32 && value !== 127 && !(value >= 128 && value < 160) ? decoder.decode(bytes.subarray(index, index + 1)) : '·';
				cells.push({ index, hex: value.toString(16).padStart(2, '0'), char, zero: value === 0, printable: char !== '·' });
			}
			out.push({ offset, cells });
		}
		return out;
	});
	const offsetWidth = $derived(Math.max(6, bytes.length.toString(16).length));
</script>

<div class="hex" onmouseleave={() => (hover = -1)} role="presentation">
	<div class="table">
		<div class="row head">
			<span class="offset" style:width="{offsetWidth}ch" title={t('files.offset')}>{t('files.offsetShort')}</span>
			<span class="bytes">
				{#each Array(ROW) as _, i}<span class="cell" class:gap={i === 8}>{i.toString(16).toUpperCase()}</span>{/each}
			</span>
			<span class="text">{t('files.text')}</span>
		</div>
		{#each rows as row (row.offset)}
			<div class="row">
				<span class="offset" style:width="{offsetWidth}ch">{row.offset.toString(16).padStart(offsetWidth, '0')}</span>
				<span class="bytes">
					{#each row.cells as cell, i}
						{#if cell}
							<span class="cell" class:gap={i === 8} class:zero={cell.zero} class:hot={hover === cell.index} onmouseenter={() => (hover = cell.index)} role="presentation">{cell.hex}</span>
						{:else}
							<span class="cell" class:gap={i === 8}></span>
						{/if}
					{/each}
				</span>
				<span class="text">
					{#each row.cells as cell}
						{#if cell}<span class="char" class:dim={!cell.printable} class:hot={hover === cell.index} onmouseenter={() => (hover = cell.index)} role="presentation">{cell.char}</span>{/if}
					{/each}
				</span>
			</div>
		{/each}
	</div>
	<div class="footer">
		<span class="muted small mono">
			{#if hover >= 0}
				0x{hover.toString(16)} · {bytes[hover]} · 0x{bytes[hover].toString(16).padStart(2, '0')}
			{:else}
				{t('files.range', { from: (page * PAGE).toString(16), to: Math.min(bytes.length, (page + 1) * PAGE).toString(16), total: bytes.length })}
			{/if}
		</span>
		{#if pages > 1}
			<div class="pager">
				<button class="btn small ghost" disabled={page === 0} onclick={() => (page = 0)}>«</button>
				<button class="btn small ghost" disabled={page === 0} onclick={() => page--}>‹</button>
				<span class="small mono">{page + 1}/{pages}</span>
				<button class="btn small ghost" disabled={page >= pages - 1} onclick={() => page++}>›</button>
				<button class="btn small ghost" disabled={page >= pages - 1} onclick={() => (page = pages - 1)}>»</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.hex {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0;
		flex: 1;
	}
	.table {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: var(--space-2) 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
		font: 12px/1.7 var(--font-mono);
	}
	.row {
		display: flex;
		gap: 16px;
		padding: 0 12px;
		white-space: pre;
		width: max-content;
	}
	.row.head {
		position: sticky;
		top: calc(-1 * var(--space-2));
		margin-bottom: 2px;
		background: var(--surface-alt);
		color: var(--faint);
	}
	/* Every column is sized in ch of the same font, header included, so they line up. */
	.offset {
		flex: none;
		overflow: hidden;
		color: var(--faint);
	}
	.bytes {
		display: flex;
	}
	.cell {
		flex: none;
		width: 3ch;
		text-align: center;
		border-radius: 3px;
	}
	.cell.gap {
		margin-left: 1ch;
	}
	.cell.zero {
		color: var(--faint);
	}
	.text {
		display: flex;
		padding-left: 12px;
		border-left: 1px solid var(--border);
	}
	.char {
		flex: none;
		width: 1ch;
		overflow: hidden;
		text-align: center;
		border-radius: 2px;
	}
	.char.dim {
		color: var(--faint);
	}
	.hot {
		background: var(--accent);
		color: var(--on-accent);
	}
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.pager {
		display: flex;
		align-items: center;
		gap: 2px;
	}
</style>
