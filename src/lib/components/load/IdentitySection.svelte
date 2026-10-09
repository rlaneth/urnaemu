<script>
	// Test identities (key + self-signed certificate) that sign official media and session
	// results. Created explicitly here, with editable certificate fields; kept in this browser.
	import { onMount } from 'svelte';
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { listIdentities, createIdentity, importIdentityPem, exportIdentityPem, deleteIdentity } from '#lib/engine/load/identity-store.js';
	import { DEFAULT_CERTIFICATE_FIELDS } from '#lib/engine/services/webcrypto-provider.js';
	import DateField from '#lib/components/ui/DateField.svelte';

	const { app, engine } = useEngine();
	const editor = app.loadEditor;
	const load = $derived($engine?.load);
	let identities = $state([]);
	let creating = $state(false);
	let menu = $state(null);
	let confirmDelete = $state(null);
	let showAdvanced = $state(false);

	// Validity dates as AAAAMMDD (DateField shows DD/MM/AAAA).
	const compact = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
	const today = compact(Date.now());
	const inTwoYears = compact(Date.now() + 86400000 * 730);
	const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
	const blankForm = () => ({ name: '', ...DEFAULT_CERTIFICATE_FIELDS, serial: '', notBefore: today, notAfter: inTwoYears });
	let form = $state(blankForm());

	// The election day of the loaded media: results are signed then, so the certificate must cover it.
	const electionDay = $derived.by(() => {
		load?.revision;
		try {
			return app.clock.electionDayPreset().local.slice(0, 10);
		} catch {
			return null;
		}
	});
	const covers = (info) => !electionDay || !info || (info.notBefore.slice(0, 10) <= electionDay && info.notAfter.slice(0, 10) >= electionDay);
	// Certificate validity is in UTC (X.509); shown as the UTC date so 2026-01-01T00:00Z is 01/01/2026.
	const date = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
	const holder = (info) => [info?.subject.CN, info?.subject.O].filter(Boolean).join(' · ');
	const place = (info) => [info?.subject.L, info?.subject.ST, info?.subject.C].filter(Boolean).join(', ');

	const active = $derived(identities.find((i) => i.id === load?.identity?.id) ?? null);
	const others = $derived(identities.filter((i) => i.id !== load?.identity?.id));

	async function refresh() {
		identities = await listIdentities();
	}
	onMount(refresh);

	const use = action(app, async (id) => {
		await editor.useIdentity(id);
		menu = null;
		await refresh();
	});
	const create = action(app, async () => {
		if (!/^\d{8}$/.test(form.notBefore) || !/^\d{8}$/.test(form.notAfter)) throw Error(t('loadui.identity.badDates'));
		const fields = { ...form, notBefore: new Date(iso(form.notBefore) + 'T00:00:00').toISOString(), notAfter: new Date(iso(form.notAfter) + 'T23:59:59').toISOString() };
		delete fields.name;
		const record = await createIdentity(fields, form.name.trim() || undefined);
		await editor.useIdentity(record);
		creating = false;
		form = blankForm();
		await refresh();
	});
	const importPem = action(app, async (event) => {
		const input = event.currentTarget, file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const record = await importIdentityPem(await file.text(), file.name.replace(/\.(pem|txt)$/i, ''));
		await editor.useIdentity(record);
		await refresh();
	});
	const exportPem = action(app, async (record, withPrivateKey) => {
		const text = await exportIdentityPem(record, { withPrivateKey });
		app.downloadBytes(text, `${record.name.replace(/[^\w.-]+/g, '_')}${withPrivateKey ? '-com-chave-privada' : ''}.pem`);
		menu = null;
	});
	const remove = action(app, async (record) => {
		const wasActive = record.id === load?.identity?.id;
		await deleteIdentity(record.id);
		if (wasActive) editor.clearIdentity();
		confirmDelete = null;
		menu = null;
		await refresh();
	});
</script>

<div class="identity" data-testid="load-identity">
	<p class="intro">{t('loadui.identity.intro')}</p>

	<section class="current" data-testid="identity-current">
		<h3>{t('loadui.identity.inUse')}</h3>
		{#if active}
			<div class="detail">
				<strong class="name">{active.name}</strong>
				<dl>
					<dt>{t('loadui.identity.holder')}</dt>
					<dd>{holder(active.info) || '—'}</dd>
					{#if place(active.info)}<dt>{t('loadui.identity.place')}</dt><dd>{place(active.info)}</dd>{/if}
					{#if active.info?.subject.emailAddress}<dt>{t('loadui.identity.email')}</dt><dd>{active.info.subject.emailAddress}</dd>{/if}
					<dt>{t('loadui.identity.validity')}</dt>
					<dd>
						{date(active.info?.notBefore)} – {date(active.info?.notAfter)}
						{#if electionDay}<span class={covers(active.info) ? 'ok' : 'bad'}>{covers(active.info) ? t('loadui.identity.coversElection') : t('loadui.identity.missesElection', { date: date(electionDay) })}</span>{/if}
					</dd>
				</dl>
				<div class="actions">
					<button class="btn small" onclick={() => exportPem(active, false)}>{t('loadui.identity.exportCert')}</button>
					<button class="btn small" onclick={() => exportPem(active, true)}>{t('loadui.identity.exportKey')}</button>
					{#if confirmDelete === active.id}
						<span class="confirm">{t('loadui.identity.deleteConfirm')}</span>
						<button class="btn small danger" onclick={() => remove(active)}>{t('loadui.identity.delete')}</button>
						<button class="btn small ghost" onclick={() => (confirmDelete = null)}>{t('loadui.identity.cancel')}</button>
					{:else}
						<button class="btn small ghost danger" onclick={() => (confirmDelete = active.id)}>{t('loadui.identity.delete')}</button>
					{/if}
				</div>
				<p class="note">{t('loadui.identity.exportNote')}</p>
			</div>
		{:else}
			<p class="empty">{identities.length ? t('loadui.identity.noneChosen') : t('loadui.identity.noneYet')}</p>
		{/if}
	</section>

	{#if others.length}
		<section>
			<h3>{active ? t('loadui.identity.others') : t('loadui.identity.choose')}</h3>
			<ul class="list">
				{#each others as record (record.id)}
					<li data-testid="identity-{record.id}">
						<div class="who">
							<strong>{record.name}</strong>
							<span>{holder(record.info)} · {t('loadui.identity.validUntil', { date: date(record.info?.notAfter) })}{electionDay && !covers(record.info) ? ` · ${t('loadui.identity.missesShort')}` : ''}</span>
							<span class="meta">{t('loadui.identity.created', { date: date(record.createdAt) })} · {t('loadui.identity.serial')} {record.info?.serial ?? '—'}</span>
						</div>
						<div class="row-actions">
							<button class="btn small" onclick={() => use(record.id)}>{t('loadui.identity.use')}</button>
							<button class="btn small ghost" aria-expanded={menu === record.id} onclick={() => ((menu = menu === record.id ? null : record.id), (confirmDelete = null))}>{t('loadui.identity.more')}</button>
						</div>
						{#if menu === record.id}
							<div class="more">
								<button class="link" onclick={() => exportPem(record, false)}>{t('loadui.identity.exportCert')}</button>
								<button class="link" onclick={() => exportPem(record, true)}>{t('loadui.identity.exportKey')}</button>
								{#if confirmDelete === record.id}
									<span>{t('loadui.identity.deleteConfirm')}</span>
									<button class="link danger" onclick={() => remove(record)}>{t('loadui.identity.delete')}</button>
									<button class="link" onclick={() => (confirmDelete = null)}>{t('loadui.identity.cancel')}</button>
								{:else}
									<button class="link danger" onclick={() => (confirmDelete = record.id)}>{t('loadui.identity.delete')}</button>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="toolbar">
		<button class="btn small" class:primary={!identities.length} onclick={() => (creating = !creating)} data-testid="identity-new">{creating ? t('loadui.identity.closeForm') : t('loadui.identity.create')}</button>
		<label class="btn small ghost">{t('loadui.identity.import')}<input type="file" accept=".pem,.txt" hidden onchange={importPem} /></label>
	</div>

	{#if creating}
		<form class="form" onsubmit={(e) => (e.preventDefault(), create())}>
			<label class="wide">{t('loadui.identity.nameLabel')}<input class="input" bind:value={form.name} placeholder={t('loadui.identity.namePlaceholder')} /></label>
			<fieldset>
				<legend>{t('loadui.identity.holderTitle')}</legend>
				<label>{t('loadui.identity.cn')}<input class="input" bind:value={form.CN} required /></label>
				<label>{t('loadui.identity.o')}<input class="input" bind:value={form.O} /></label>
				<label>{t('loadui.identity.ou')}<input class="input" bind:value={form.OU} /></label>
				<label>{t('loadui.identity.emailLabel')}<input class="input" type="email" bind:value={form.emailAddress} /></label>
				<label>{t('loadui.identity.l')}<input class="input" bind:value={form.L} /></label>
				<label>{t('loadui.identity.st')}<input class="input" bind:value={form.ST} maxlength="64" /></label>
				<label>{t('loadui.identity.c')}<input class="input" bind:value={form.C} maxlength="2" pattern="[A-Za-z]{'{'}2{'}'}" /></label>
			</fieldset>
			<fieldset>
				<legend>{t('loadui.identity.validityTitle')}</legend>
				<label>{t('loadui.identity.from')}<DateField class="input" bind:value={form.notBefore} required /></label>
				<label>{t('loadui.identity.to')}<DateField class="input" bind:value={form.notAfter} required /></label>
				{#if electionDay && /^\d{8}$/.test(form.notBefore) && /^\d{8}$/.test(form.notAfter) && (iso(form.notBefore) > electionDay || iso(form.notAfter) < electionDay)}
					<p class="bad wide">{t('loadui.identity.missesElection', { date: date(electionDay) })}</p>
				{/if}
			</fieldset>
			<button type="button" class="link" onclick={() => (showAdvanced = !showAdvanced)}>{showAdvanced ? '▾' : '▸'} {t('loadui.identity.advanced')}</button>
			{#if showAdvanced}
				<fieldset>
					<label class="wide">{t('loadui.identity.serialLabel')}<input class="input mono" bind:value={form.serial} pattern="[0-9a-fA-F]{'{'}0,40{'}'}" placeholder={t('loadui.identity.serialPlaceholder')} /></label>
					<p class="note wide">{t('loadui.identity.keyNote')}</p>
				</fieldset>
			{/if}
			<div class="actions">
				<button class="btn primary small" type="submit" data-testid="identity-create">{t('loadui.identity.createUse')}</button>
				<button class="btn ghost small" type="button" onclick={() => (creating = false)}>{t('loadui.identity.cancel')}</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.identity {
		display: grid;
		gap: var(--space-4);
		max-width: 760px;
	}
	.intro {
		margin: 0;
		color: var(--muted);
		font-size: 13.5px;
		line-height: 1.55;
	}
	h3 {
		margin: 0 0 var(--space-2);
		color: var(--muted);
		font: 600 11.5px var(--font-display);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.current .detail {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.name {
		font-size: 15px;
	}
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 3px var(--space-4);
		margin: 0;
		font-size: 13.5px;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.ok {
		margin-left: var(--space-2);
		color: var(--success);
	}
	.bad {
		margin-left: var(--space-2);
		color: var(--danger);
	}
	p.bad {
		margin: 0;
		font-size: 13px;
	}
	.empty {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--muted);
		font-size: 13.5px;
	}
	.note {
		margin: 0;
		color: var(--muted);
		font-size: 12.5px;
		line-height: 1.5;
	}
	.actions,
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.list li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-2) var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-3);
	}
	.list li + li {
		border-top: 1px solid var(--border);
	}
	.who {
		display: grid;
		gap: 1px;
		min-width: 0;
		font-size: 13.5px;
	}
	.who span {
		color: var(--muted);
	}
	.meta {
		font-size: 12px;
	}
	.row-actions {
		display: flex;
		gap: var(--space-1, 4px);
	}
	.more {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		font-size: 13px;
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		justify-self: start;
	}
	.link.danger {
		color: var(--danger);
	}
	.actions .btn.danger {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
	}
	.actions .btn.ghost.danger {
		color: var(--danger);
	}
	.confirm {
		color: var(--muted);
		font-size: 13px;
	}
	.form {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
	.form label {
		display: grid;
		gap: 4px;
		color: var(--muted);
		font-size: 12.5px;
	}
	fieldset {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2) var(--space-3);
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-2);
		padding: 0;
		font-size: 13px;
		font-weight: 600;
	}
	.wide {
		grid-column: 1 / -1;
	}
	@media (max-width: 560px) {
		fieldset {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
