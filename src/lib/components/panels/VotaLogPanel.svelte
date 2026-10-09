<script>
	// VOTA's own log (logd.dat), the same log the real urna keeps and later exports in log.jez.
	import { tick } from 'svelte';
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { LOGD_PATH } from '#lib/engine/devices/logd.js';

	const { app, engine } = useEngine();
	let filter = $state('');
	let list;

	const revision = $derived($engine?.logdRevision ?? 0);
	const entries = $derived.by(() => {
		revision;
		const query = filter.trim().toLowerCase();
		// Always a new array: the engine appends to the same one, which Svelte would not see as a change.
		const all = app.logd.entries;
		return query ? all.filter((e) => e.message.toLowerCase().includes(query)) : all.slice();
	});

	$effect(() => {
		entries;
		tick().then(() => {
			if (list) list.scrollTop = list.scrollHeight;
		});
	});

	const time = (iso) => new Date(iso).toLocaleString('pt-BR', { hour12: false });
	function download() {
		app.downloadBytes(app.logd.entries.map((e) => e.raw).join('\n') + '\n', 'logd.dat');
	}
</script>

<div class="logd" data-testid="vota-log">
	<p class="muted small intro">{t('log.logdIntro')}</p>
	<div class="toolbar">
		<input class="input" type="search" placeholder={t('log.filter')} bind:value={filter} />
		<button class="btn small ghost" disabled={!app.logd.entries.length} onclick={download}>{t('log.downloadLogd')}</button>
	</div>
	<div class="table" bind:this={list}>
		<table>
			<thead>
				<tr>
					<th title={t('log.observedHint')}>{t('log.observed')}</th>
					<th>{t('log.level')}</th>
					<th>{t('log.message')}</th>
				</tr>
			</thead>
			<tbody>
				{#each entries as entry, i (i)}
					<tr>
						<td class="time">{time(entry.observed)}</td>
						<td class="level" title={t('log.fieldsHint', { fields: entry.fields.join('|') })}>
							{#if entry.level}
								<span class="badge {entry.level.name.toLowerCase()}">{entry.level.name}{entry.level.confirmed ? '' : '?'}</span>
							{/if}
						</td>
						<td class="message">{entry.message}</td>
					</tr>
				{:else}
					<tr><td colspan="3" class="empty muted">{t('log.logdEmpty')}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<details class="about small">
		<summary>{t('log.aboutTitle')}</summary>
		<ul>
			<li>{t('log.aboutHere', { path: LOGD_PATH })}</li>
			<li>{t('log.aboutFields')}</li>
			<li>{t('log.aboutExported')}</li>
			<li>{t('log.aboutTheory')}</li>
		</ul>
	</details>
</div>

<style>
	.logd {
		display: grid;
		gap: var(--space-3);
	}
	.toolbar {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.toolbar .input {
		max-width: 280px;
	}
	.table {
		max-height: 360px;
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	th {
		position: sticky;
		top: 0;
		padding: 8px 12px;
		background: var(--surface-alt);
		color: var(--muted);
		font: 600 11px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
	}
	td {
		padding: 6px 12px;
		border-top: 1px solid var(--border);
		vertical-align: top;
	}
	.time {
		white-space: nowrap;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
	.level {
		white-space: nowrap;
	}
	.badge {
		display: inline-block;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--surface-alt);
		color: var(--muted);
		font: 600 10.5px/1.6 var(--font-display);
		letter-spacing: 0.06em;
	}
	.badge.alerta {
		background: var(--warning-soft);
		color: var(--warning);
	}
	.badge.erro,
	.badge.what {
		background: var(--danger-soft);
		color: var(--danger);
	}
	.badge.externo {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.message {
		overflow-wrap: anywhere;
	}
	.empty {
		padding: var(--space-4);
	}
	summary {
		cursor: pointer;
		color: var(--muted);
	}
	.about ul {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding-left: 1.2em;
		color: var(--muted);
		line-height: 1.55;
	}
</style>
