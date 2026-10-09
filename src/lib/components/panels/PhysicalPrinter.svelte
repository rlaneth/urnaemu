<script>
	// Optional physical ESC/POS printer over Web Serial (see engine/devices/serial-printer.js).
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { BAUD_RATES, PAPER_WIDTHS } from '#lib/engine/devices/serial-printer.js';
	import { CODE_PAGES } from '#lib/engine/devices/escpos.js';

	const { app, engine } = useEngine();
	const serial = $derived($engine?.serialPrinter);
	const connected = $derived(serial?.status === 'connected');
	const busy = $derived(serial?.status === 'connecting');

	const connect = action(app, (fromStart) => app.serialPrinter.connect({ fromStart }));
	const disconnect = action(app, () => app.serialPrinter.disconnect());
	const test = action(app, () => app.serialPrinter.test());
	const reprint = action(app, () => app.serialPrinter.reprint());
	const save = (field, value) => app.serialPrinter.saveSettings({ [field]: value });
</script>

<details class="physical" data-testid="physical-printer">
	<summary>
		<span>{t('printer.physical.title')}</span>
		<span class="status" data-status={serial?.status}>
			{t(`printer.physical.status.${serial?.status ?? 'disconnected'}`, { bytes: serial?.bytes ?? 0, error: serial?.error ?? '' })}
		</span>
	</summary>
	<div class="body">
		<p class="muted">{t('printer.physical.intro')}</p>
		<p class="note">{t('printer.physical.support')}</p>
		{#if !serial?.supported}
			<p class="warn">{t('printer.physical.unsupported')}</p>
		{:else}
			<div class="grid">
				<label>
					<span>{t('printer.physical.baud')}</span>
					<select class="input" value={serial.settings.baudRate} disabled={connected || busy} onchange={(e) => save('baudRate', Number(e.currentTarget.value))}>
						{#each BAUD_RATES as rate}<option value={rate}>{rate}</option>{/each}
					</select>
				</label>
				<label>
					<span>{t('printer.physical.codePage')}</span>
					<select class="input" value={serial.settings.codePage} disabled={connected || busy} onchange={(e) => save('codePage', e.currentTarget.value)}>
						{#each Object.keys(CODE_PAGES) as page}<option value={page}>{t(`printer.physical.codePages.${page}`)}</option>{/each}
					</select>
				</label>
				<label>
					<span>{t('printer.physical.paper')}</span>
					<select class="input" value={String(serial.settings.paper)} onchange={(e) => save('paper', Number(e.currentTarget.value))}>
						{#each Object.keys(PAPER_WIDTHS) as mm}<option value={mm}>{t('printer.physical.paperWidth', { mm })}</option>{/each}
					</select>
				</label>
			</div>
			<p class="hint">{t('printer.physical.settingsHint')}</p>
			{#if serial.openFailed}
				<p class="warn" data-testid="physical-printer-open-failed">{t('printer.physical.openFailed')}</p>
			{/if}
			<div class="row">
				{#if connected}
					<button class="btn small" onclick={test}>{t('printer.physical.test')}</button>
					<button class="btn small" onclick={reprint}>{t('printer.physical.reprint')}</button>
					<button class="btn small ghost" onclick={disconnect}>{t('printer.physical.disconnect')}</button>
				{:else}
					<button class="btn small primary" disabled={busy} onclick={() => connect(false)} data-testid="physical-printer-connect">{t('printer.physical.connect')}</button>
					<button class="btn small ghost" disabled={busy} onclick={() => connect(true)}>{t('printer.physical.connectFromStart')}</button>
				{/if}
			</div>
		{/if}
	</div>
</details>

<style>
	.physical {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 13px;
	}
	summary {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: baseline;
		justify-content: space-between;
		padding: 8px 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.status {
		font-weight: 400;
		font-size: 12px;
		color: var(--muted);
	}
	.status[data-status='connected'] {
		color: var(--accent);
	}
	.status[data-status='error'] {
		color: var(--danger, #b42318);
	}
	.body {
		display: grid;
		gap: var(--space-2);
		padding: 0 12px 12px;
	}
	.body p {
		margin: 0;
	}
	.muted,
	.hint {
		color: var(--muted);
	}
	.hint {
		font-size: 12px;
	}
	.note {
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
		font-size: 12.5px;
	}
	.warn {
		color: var(--danger, #b42318);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-2);
	}
	label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		color: var(--muted);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
