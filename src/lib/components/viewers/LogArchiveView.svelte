<script>
	// A .jez log archive (ZIP): its logd.dat as a table. Real urna lines are tab-separated
	// (date time, level, urna id, component, message, authenticator); the web build writes
	// "a|level|message".
	import { t } from '#lib/i18n/t.js';
	import { readZip } from '#lib/results/zip.js';
	import { parseLogdLine } from '#lib/engine/devices/logd.js';

	let { bytes } = $props();
	let entries = $state([]);
	let rows = $state([]);
	let error = $state(null);
	let filter = $state('');

	$effect(() => {
		const data = bytes;
		error = null;
		rows = [];
		readZip(data)
			.then(async (list) => {
				entries = list;
				const log = list.find((e) => /logd\.dat$/i.test(e.name));
				if (!log) return;
				const text = new TextDecoder('windows-1252').decode(await log.read());
				rows = text.split('\n').filter(Boolean).map((line) => {
					const tab = line.split('\t');
					if (tab.length >= 6) return { time: tab[0], level: tab[1], id: tab[2], component: tab[3], message: tab[4], mac: tab[5] };
					const web = parseLogdLine(line);
					return { time: '', level: web.level?.name ?? '', id: '', component: '', message: web.message, mac: '' };
				});
			})
			.catch((e) => (error = String(e.message ?? e)));
	});
	const shown = $derived(filter ? rows.filter((r) => (r.message + r.component + r.level).toLowerCase().includes(filter.toLowerCase())) : rows);
</script>

<div class="archive" data-testid="log-archive">
	{#if error}<p class="error small">{error}</p>{/if}
	<p class="muted small">{t('results.archive', { n: entries.length, names: entries.map((e) => e.name).join(', ') })}</p>
	{#if rows.length}
		<input class="input" type="search" placeholder={t('log.filter')} bind:value={filter} />
		<div class="table">
			<table>
				<thead><tr><th>{t('results.when')}</th><th>{t('log.level')}</th><th>{t('results.component')}</th><th>{t('log.message')}</th></tr></thead>
				<tbody>
					{#each shown.slice(0, 2000) as r, i (i)}
						<tr title={r.mac ? t('results.mac', { mac: r.mac, id: r.id }) : ''}>
							<td class="mono nowrap">{r.time}</td>
							<td class="nowrap"><span class="badge {r.level.toLowerCase()}">{r.level}</span></td>
							<td class="mono">{r.component}</td>
							<td>{r.message}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted small">{t('results.lines', { shown: Math.min(shown.length, 2000), total: rows.length })}</p>
	{/if}
</div>

<style>
	.archive {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex: 1;
		min-height: 0;
	}
	.table {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
	}
	th {
		position: sticky;
		top: 0;
		padding: 6px 8px;
		background: var(--surface-alt);
		color: var(--muted);
		font: 600 10.5px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: left;
	}
	td {
		padding: 4px 8px;
		border-top: 1px solid var(--border);
		vertical-align: top;
	}
	.nowrap {
		white-space: nowrap;
	}
	.badge {
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-alt);
		color: var(--muted);
		font: 600 10px/1.6 var(--font-display);
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
	.error {
		color: var(--danger);
	}
</style>
