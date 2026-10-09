<script>
	import { Menubar } from 'bits-ui';
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { ui, showPanel } from '#lib/ui.svelte.js';
	import { clearPrefs } from '#lib/launcher/prefs.js';
	import { TOURS } from '#lib/tours/index.js';
	import { startTour } from '#lib/tours/runner.svelte.js';

	const { app, engine } = useEngine();
	const s = $derived($engine);
	const run = (fn) => action(app, fn);

	// The Sessão menu owns the session itself: the Controles window, Snapshots, pause/resume and
	// power (power lives in Controles, so it is not duplicated here). The Painéis menu lists the
	// auxiliary windows. Mídia de carga lives in the Mídia menu; Desenvolvedor in Ferramentas.
	// The theme and printer-speed controls are not here — the top bar has the theme toggle and
	// the printer window its speed.
	const panels = ['explicacao', 'dados', 'automatica', 'bobina', 'relogio', 'arquivos'];
	const panelLabel = { bobina: t('printer.short'), arquivos: t('files.title'), explicacao: t('explainer.title'), dados: t('data.title'), automatica: t('simulator.title'), sessao: t('controls.title'), relogio: t('clock.title') };
</script>

{#snippet item(label, onSelect, opts = {})}
	<Menubar.Item class="menu-item" {onSelect} disabled={opts.disabled}>
		<span>{label}</span>
		{#if opts.shortcut}<span class="shortcut">{opts.shortcut}</span>{/if}
	</Menubar.Item>
{/snippet}

<Menubar.Root class="menubar">
	<Menubar.Menu>
		<Menubar.Trigger class="menu-trigger">{t('menu.sessao')}</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content class="menu-content" align="start" sideOffset={6}>
				{@render item(t('menu.newTraining'), () => app.startSession())}
				{@render item(t('menu.newOfficial'), () => showPanel('carga'))}
				{@render item(t('menu.restart'), () => app.reload())}
				{@render item(t('menu.launcher'), () => (ui.launcher = 'manual'))}
				{@render item(t('menu.resetStart'), async () => {
					await clearPrefs();
					location.assign(location.pathname);
				})}
				<Menubar.Separator class="menu-separator" />
				{@render item(t('controls.title'), () => showPanel('sessao'))}
				{@render item(t('snapshot.menu'), () => showPanel('instantaneos'))}
				<Menubar.Separator class="menu-separator" />
				{@render item(s?.autoRun === false ? t('menu.resume') : t('menu.pause'), run(() => (s?.autoRun === false ? app.run() : app.pause())), { disabled: !s?.initialized })}
				{@render item(t('menu.cancelNative'), () => app.cancelNative(), { disabled: !s?.native?.busy })}
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger class="menu-trigger">{t('menu.midia')}</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content class="menu-content" align="start" sideOffset={6}>
				{@render item(t('menu.loadEditor'), () => showPanel('carga'))}
				<Menubar.Separator class="menu-separator" />
				<Menubar.Group>
					<Menubar.GroupHeading class="menu-heading">{t('menu.resultMedia')}</Menubar.GroupHeading>
					{@render item(t('controls.insert'), run(() => app.media.insert()), { disabled: !s?.resultMedia || s.resultMedia.present })}
					{@render item(t('controls.eject'), run(() => app.media.eject()), { disabled: !s?.resultMedia?.present })}
				</Menubar.Group>
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger class="menu-trigger">{t('menu.janelas')}</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content class="menu-content" align="start" sideOffset={6}>
				{#each panels as id}
					{@render item(panelLabel[id], () => showPanel(id))}
				{/each}
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger class="menu-trigger">{t('menu.ferramentas')}</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content class="menu-content" align="start" sideOffset={6}>
				{@render item(t('log.title'), () => showPanel('registro'))}
				{@render item(t('menu.screenshot'), run(() => app.exportScreen()), { disabled: !s?.ready, shortcut: 'Ctrl+Shift+S' })}
				<Menubar.Separator class="menu-separator" />
				{@render item(t('dev.title'), () => showPanel('dev'), { shortcut: 'Ctrl+Shift+D' })}
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>

	<Menubar.Menu>
		<Menubar.Trigger class="menu-trigger">{t('menu.ajuda')}</Menubar.Trigger>
		<Menubar.Portal>
			<Menubar.Content class="menu-content" align="start" sideOffset={6}>
				<Menubar.Group>
					<Menubar.GroupHeading class="menu-heading">{t('tour.menu')}</Menubar.GroupHeading>
					{#each TOURS as tour (tour.id)}
						{@render item(tour.titulo, () => startTour(tour.id))}
					{/each}
				</Menubar.Group>
				<Menubar.Separator class="menu-separator" />
				{@render item(t('menu.shortcuts'), () => (ui.dialog = 'shortcuts'))}
				{@render item(t('menu.fidelity'), () => (ui.dialog = 'fidelity'))}
				<Menubar.Separator class="menu-separator" />
				{@render item(t('menu.about'), () => (ui.dialog = 'about'))}
				{@render item(t('menu.licenses'), () => (ui.dialog = 'licencas'))}
			</Menubar.Content>
		</Menubar.Portal>
	</Menubar.Menu>
</Menubar.Root>

<style>
	:global(.menubar) {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	:global(.menu-trigger) {
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: 500 13.5px var(--font-body);
		cursor: pointer;
	}
	:global(.menu-trigger:hover),
	:global(.menu-trigger[data-state='open']) {
		background: var(--accent-soft);
		color: var(--accent);
	}
	:global(.menu-content) {
		z-index: 9000;
		min-width: 240px;
		padding: 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		outline: none;
	}
	:global(.menu-item) {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
		padding: 0 10px;
		border-radius: 6px;
		color: var(--text);
		font: 400 13.5px var(--font-body);
		cursor: pointer;
		outline: none;
		user-select: none;
	}
	:global(.menu-item[data-highlighted]) {
		background: var(--accent-soft);
		color: var(--accent);
	}
	:global(.menu-item[data-disabled]) {
		opacity: 0.4;
		cursor: default;
	}
	:global(.menu-item .shortcut) {
		margin-left: auto;
		padding-left: 24px;
		color: var(--faint);
		font-size: 12px;
	}
	:global(.menu-item .mark) {
		width: 14px;
		color: var(--accent);
		font-size: 12px;
		text-align: center;
	}
	:global(.menu-heading) {
		padding: 8px 10px 4px;
		color: var(--muted);
		font: 600 10.5px var(--font-display);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	:global(.menu-separator) {
		height: 1px;
		margin: 6px 4px;
		background: var(--border);
	}
</style>
