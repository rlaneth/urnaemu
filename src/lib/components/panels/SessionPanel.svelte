<script>
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();

	const s = $derived($engine);
	let scenario = $state(app.options.scenario);

	const start = action(app, () => app.startSession({ scenario }));
	const load = action(app, () => app.loadScenario(scenario, false));
	const media = action(app, (present) => (present ? app.media.insert() : app.media.eject()));
	const power = action(app, (change) => app.setPower(change));
	const owner = action(app, (value) => app.training.chooseKeyboard(value));

</script>

<div class="session stack">
	<div class="group">
		<div class="row">
			{#if s?.session?.enabled && !s.session.booting}
				<label class="owner">
					<span class="muted small">{t('controls.keyboardOwner')}</span>
					<select class="input" value={s.session.keyboardOwner} onchange={(e) => owner(e.currentTarget.value)}>
						<option value="voter">{t('keyboard.voter')}</option>
						<option value="mesario">{t('keyboard.mesario')}</option>
					</select>
				</label>
			{/if}
		</div>
		{#if s?.session}
			<p class="status small" data-testid="session-status" data-status={s.session.status}>{t(`session.${s.session.status}`)}</p>
			{#if s.session.error}
				<p class="small danger mono">{s.session.error}</p>
			{/if}
		{/if}
	</div>

	<div class="group">
		<h3 class="eyebrow">{t('controls.scenario')}</h3>
		<select class="input" bind:value={scenario}>
			{#each s?.scenarios ?? [] as option}
				<option value={option.id}>{option.label}</option>
			{/each}
		</select>
		<div class="row">
			<button class="btn primary" onclick={start}>{t('controls.startSession')}</button>
			<button class="btn" onclick={load}>{t('controls.loadScenario')}</button>
		</div>
		<p class="muted small">{t('controls.scenarioHint')}</p>
	</div>

	<div class="group">
		<h3 class="eyebrow">{t('controls.media')}</h3>
		{#if s?.resultMedia}
			<div class="row">
				<span class="state" class:success={s.resultMedia.present}>{s.resultMedia.present ? t('controls.mediaPresent') : t('controls.mediaAbsent')}</span>
				<button class="btn small" onclick={() => media(!s.resultMedia.present)} data-testid="result-media-toggle">
					{s.resultMedia.present ? t('controls.eject') : t('controls.insert')}
				</button>
			</div>
		{:else}
			<p class="muted small">{t('controls.mediaUnavailable')}</p>
		{/if}
	</div>

	{#if s?.power}
		<div class="group">
			<h3 class="eyebrow">{t('terminal.power')}</h3>
			<div class="power">
				<select class="input" value={s.power.source} onchange={(e) => power({ source: e.currentTarget.value })} data-testid="power-source">
					{#each ['mains', 'battery'] as source}
						<option value={source}>{t(`terminal.source.${source}`)}</option>
					{/each}
				</select>
				<select class="input" value={s.power.level} onchange={(e) => power({ level: e.currentTarget.value })} data-testid="power-level">
					{#each ['full', 'partial', 'critical', 'absent'] as level}
						<option value={level}>{t(`terminal.level.${level}`)}</option>
					{/each}
				</select>
			</div>
			{#if s.power.source === 'battery' && s.power.level === 'critical'}
				<p class="small warn">{t('terminal.criticalAdvice')}</p>
			{:else if s.power.source === 'battery' && s.power.level !== 'absent'}
				<p class="small warn">{t('terminal.batteryAdvice')}</p>
			{/if}
		</div>
	{/if}

	{#if s?.native?.busy}
		<div class="group">
			<button class="btn danger" onclick={() => app.cancelNative()}>{t('controls.cancelNative')}</button>
			<p class="muted small">{t('controls.cancelNativeHint')}</p>
		</div>
	{/if}
</div>

<style>
	.group {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.group:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.owner {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}
	.owner .input {
		width: auto;
	}
	.status {
		color: var(--text);
	}
	.danger {
		color: var(--danger);
	}
	.warn {
		color: var(--warning);
	}
	.power {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}
</style>
