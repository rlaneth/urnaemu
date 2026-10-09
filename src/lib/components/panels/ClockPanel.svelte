<script>
	import { onMount } from 'svelte';
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();

	const toLocal = (iso) => {
		const date = new Date(iso);
		return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
	};
	const initial = app.clock.settings;
	let mode = $state(initial.mode);
	let local = $state(toLocal(initial.iso));
	let now = $state('');

	const clock = $derived($engine?.clock);
	const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	onMount(() => {
		const update = () => (now = new Date(app.clock.now()).toLocaleString('pt-BR'));
		update();
		const timer = setInterval(update, 500);
		return () => clearInterval(timer);
	});

	const chosen = () => ({ mode, iso: new Date(local).toISOString() });
	const apply = action(app, () => app.clock.apply(chosen()));
	const applyReload = action(app, () => app.clock.applyAndReload(chosen()));
	const reset = action(app, () => {
		const s = app.clock.reset();
		mode = s.mode;
		local = toLocal(s.iso);
	});
	const preset = action(app, (hour) => {
		const p = app.clock.electionDayPreset();
		mode = p.mode;
		local = p.local.replace('T08:', `T${hour}:`);
	});
</script>

<div class="clock stack" data-testid="clock-panel">
	<div class="now">
		<span class="eyebrow">{t('clock.now')}</span>
		<strong class="time" data-testid="clock-now">{now}</strong>
		<span class="muted small">{zone} · {t(`clock.modes.${clock?.mode ?? 'real'}`)}</span>
	</div>

	<div class="grid">
		<label class="field">
			{t('clock.mode')}
			<select class="input" bind:value={mode} data-testid="clock-mode">
				{#each ['real', 'fixed', 'running'] as option}
					<option value={option}>{t(`clock.modes.${option}`)}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			{t('clock.date')}
			<input class="input" type="datetime-local" step="1" bind:value={local} disabled={mode === 'real'} data-testid="clock-date" />
		</label>
	</div>

	<div class="row">
		<button class="btn small" onclick={() => preset('08')}>{t('clock.electionDay')}</button>
		<button class="btn small" onclick={() => preset('17')}>{t('clock.closingTime')}</button>
	</div>
	<div class="row">
		<button class="btn primary" onclick={apply}>{t('clock.apply')}</button>
		<button class="btn" onclick={applyReload}>{t('clock.applyReload')}</button>
		<button class="btn ghost" onclick={reset}>{t('clock.reset')}</button>
	</div>

	<p class="muted small">{t('clock.hint')}</p>
	{#if clock?.stats}
		<p class="muted small mono">
			{t('clock.reads', { local: clock.stats.localBridgeReads, date: clock.stats.dateReads, realtime: clock.stats.realtimeReads })}
		</p>
	{/if}
</div>

<style>
	.now {
		display: grid;
		gap: 4px;
	}
	.time {
		font: 600 22px/1.2 var(--font-display);
		font-variant-numeric: tabular-nums;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
	}
</style>
