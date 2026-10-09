<script>
	import { onMount } from 'svelte';
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { SPEED_MIN, SPEED_MAX, FEED_MM_PER_SECOND } from '#lib/engine/devices/printer.js';
	import PhysicalPrinter from './PhysicalPrinter.svelte';

	const { app, engine } = useEngine();
	let viewport;
	let follow = $state(app.printer.follow);

	const printer = $derived($engine?.printer);
	const speed = $derived(printer?.speed ?? 1);
	const status = $derived(!printer?.installed ? 'off' : printer.printing ? 'printing' : printer.operations ? 'paper' : 'ready');
	// Log scale slider: 0..100 ↔ 0.5×..10×.
	const toSlider = (s) => Math.round((Math.log(s / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN)) * 100);
	const fromSlider = (v) => Math.round(SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, v / 100) * 10) / 10;
	const presets = [
		{ value: 1, label: t('printer.speedPresets.1') },
		{ value: 2, label: t('printer.speedPresets.2') },
		{ value: 5, label: t('printer.speedPresets.5') },
		{ value: Infinity, label: t('printer.speedPresets.instant') }
	];

	onMount(() => {
		app.printer.attach(viewport);
		return () => app.printer.detach(viewport);
	});

	const setSpeed = action(app, (value) => app.printer.setSpeed(value));
	function toggleFollow() {
		app.printer.follow = follow;
	}
	function download(text, name) {
		if (text) app.downloadBytes(text, name);
	}
	function print() {
		app.printer.flush();
		const sheet = document.createElement('div');
		sheet.className = 'print-sheet';
		sheet.append(app.printer.roll.cloneNode(true));
		document.body.append(sheet);
		document.body.classList.add('printing-paper');
		try {
			window.print();
		} finally {
			document.body.classList.remove('printing-paper');
			sheet.remove();
		}
	}
</script>

<div class="printer" data-testid="printer" data-status={status} data-tour="printer">
	<div class="head">
		<div class="speed" role="group" aria-label={t('printer.speed')}>
			<span class="eyebrow" title={t('printer.speedHint')}>{t('printer.speed')}</span>
			<div class="segmented">
				{#each presets as preset}
					<button class="seg" class:active={speed === preset.value} onclick={() => setSpeed(preset.value)}>{preset.label}</button>
				{/each}
			</div>
			<input
				class="slider"
				type="range"
				min="0"
				max="100"
				value={speed === Infinity ? 100 : toSlider(speed)}
				disabled={speed === Infinity}
				aria-label={t('printer.speed')}
				oninput={(e) => setSpeed(fromSlider(Number(e.currentTarget.value)))}
			/>
			<span class="value mono">{speed === Infinity ? '∞' : `${Math.round(FEED_MM_PER_SECOND * speed)} mm/s`}</span>
		</div>
	</div>

	<div class="slot" aria-hidden="true"></div>
	<div class="viewport" class:blank={!printer?.visibleOperations} bind:this={viewport} data-testid="printer-viewport">
		{#if !printer?.installed}
			<p class="empty">{t('printer.notInstalled')}</p>
		{:else if !printer.visibleOperations}
			<p class="empty">{t('printer.empty')}</p>
		{/if}
	</div>

	<div class="footer">
		<label class="check small">
			<input type="checkbox" bind:checked={follow} onchange={toggleFollow} />
			{t('printer.follow')}
		</label>
		<div class="row">
			<button class="btn small ghost" disabled={!printer?.operations} onclick={() => download(app.printer.text(), 'bobina-simulada.txt')}>{t('printer.downloadText')}</button>
			<button
				class="btn small ghost"
				disabled={!printer?.operations}
				onclick={() => download(JSON.stringify(app.printer.snapshot(), null, 2), 'bobina-operacoes.json')}>{t('printer.downloadJson')}</button
			>
			<button class="btn small ghost" disabled={!printer?.operations} onclick={print}>{t('printer.print')}</button>
			<button class="btn small ghost" data-testid="printer-clear" disabled={!printer?.visibleOperations} onclick={() => app.printer.clear()}>{t('printer.clear')}</button>
		</div>
	</div>

	<PhysicalPrinter />
</div>

<style>
	.printer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		height: 100%;
		min-height: 0;
	}
	.head {
		display: grid;
		gap: var(--space-3);
	}
	.speed {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas: 'label value' 'seg seg' 'slider slider';
		gap: 8px 12px;
		align-items: center;
	}
	.speed .eyebrow {
		grid-area: label;
	}
	.value {
		grid-area: value;
		justify-self: end;
		font-size: 12.5px;
		color: var(--muted);
	}
	.segmented {
		grid-area: seg;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		padding: 3px;
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
	}
	.seg {
		height: 32px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--muted);
		font: 500 12.5px var(--font-body);
		cursor: pointer;
	}
	.seg.active {
		background: var(--surface);
		color: var(--accent);
		box-shadow: var(--shadow-sm);
	}
	.slider {
		grid-area: slider;
		width: 100%;
		accent-color: var(--accent);
	}
	.slot {
		height: 10px;
		margin: 0 8px -4px;
		border-radius: 0 0 8px 8px;
		background: #1a221e;
		box-shadow: inset 0 2px 5px #000;
	}
	.viewport {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 16px 12px 0;
		border-radius: 0 0 var(--radius) var(--radius);
		background: var(--surface-alt);
	}
	.viewport.blank :global(.printer-paper) {
		visibility: hidden;
	}
	.empty {
		position: absolute;
		inset: 24px 16px auto;
		text-align: center;
		color: var(--muted);
		font-size: 13px;
		pointer-events: none;
	}
	.footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
	}
</style>
