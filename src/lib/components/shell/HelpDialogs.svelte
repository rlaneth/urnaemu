<script>
	import { Dialog } from 'bits-ui';
	import { t } from '#lib/i18n/t.js';
	import { ui } from '#lib/ui.svelte.js';
	import { APP_VERSION, AUTHOR, REPO_URL, ISSUES_URL } from '#lib/meta.js';
	import { LICENCAS } from '#lib/licencas.js';

	// Fidelidade e limitações has its own full-screen view (FidelityScreen.svelte).
	const open = $derived(ui.dialog !== null && ui.dialog !== 'fidelity');
	const titles = { about: t('about.title'), shortcuts: t('shortcuts.title'), licencas: t('licencas.title') };
</script>

<Dialog.Root open={open} onOpenChange={(value) => !value && (ui.dialog = null)}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title class="dialog-title">{titles[ui.dialog] ?? ''}</Dialog.Title>
			<div class="dialog-body">
				{#if ui.dialog === 'about'}
					<p class="editorial">{t('about.body1')}</p>
					<p class="editorial">{t('about.body2')}</p>
					<p class="muted small">{t('about.notOfficial')}</p>
					<dl class="about-meta">
						<dt>{t('about.version')}</dt>
						<dd>{APP_VERSION}</dd>
						<dt>{t('about.author')}</dt>
						<dd><a href={AUTHOR.url} target="_blank" rel="noreferrer noopener">{AUTHOR.name}</a></dd>
						<dt>{t('about.code')}</dt>
						<dd><a href={REPO_URL} target="_blank" rel="noreferrer noopener">{t('about.openSource')}</a></dd>
					</dl>
					<div class="callout">
						<strong>{t('about.betaTitle')}</strong>
						<p>{t('about.betaBody')}</p>
						<a href={ISSUES_URL} target="_blank" rel="noreferrer noopener">{t('about.reportLink')}</a>
					</div>
					<p class="muted small">
						<button class="link" onclick={() => (ui.dialog = 'licencas')}>{t('about.licensesLink')}</button>
					</p>
				{:else if ui.dialog === 'licencas'}
					<p class="editorial">{t('licencas.intro')}</p>
					<ul class="licencas">
						{#each LICENCAS as item}
							<li>
								<strong>{item.nome}</strong>
								<span class="lic">{item.licenca}</span>
								<p class="muted small">{t(`licencas.${item.id}`)}</p>
								{#if item.url}<a class="small" href={item.url} target="_blank" rel="noreferrer noopener">{item.url.replace(/^https?:\/\//, '')}</a>{/if}
							</li>
						{/each}
					</ul>
				{:else if ui.dialog === 'shortcuts'}
					<table>
						<tbody>
							<tr><td><kbd>0</kbd>–<kbd>9</kbd></td><td>{t('shortcuts.digits')}</td></tr>
							<tr><td><kbd>Enter</kbd></td><td>{t('shortcuts.confirma')}</td></tr>
							<tr><td><kbd>Esc</kbd> / <kbd>Backspace</kbd></td><td>{t('shortcuts.corrige')}</td></tr>
							<tr><td><kbd>Espaço</kbd></td><td>{t('shortcuts.branco')}</td></tr>
							<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></td><td>{t('shortcuts.dev')}</td></tr>
							<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></td><td>{t('shortcuts.screenshot')}</td></tr>
						</tbody>
					</table>
					<p class="muted small">{t('shortcuts.routing')}</p>
				{/if}
			</div>
			<Dialog.Close class="btn dialog-close">{t('common.close')}</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: #0a0e1a66;
		backdrop-filter: blur(2px);
	}
	:global(.dialog-content) {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 61;
		display: grid;
		gap: var(--space-5);
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		overflow: auto;
		padding: var(--space-6);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		transform: translate(-50%, -50%);
	}
	:global(.dialog-title) {
		font: 700 20px/1.3 var(--font-display);
	}
	:global(.dialog-close) {
		justify-self: end;
	}
	.dialog-body {
		display: grid;
		gap: var(--space-4);
	}
	table {
		border-collapse: collapse;
		width: 100%;
	}
	td {
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
		font-size: 14px;
	}
	td:first-child {
		width: 50%;
		white-space: nowrap;
	}
	.about-meta {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px var(--space-4);
		margin: 0;
		font-size: 14px;
	}
	.about-meta dt {
		color: var(--muted);
	}
	.about-meta dd {
		margin: 0;
	}
	.callout {
		display: grid;
		gap: 6px;
		justify-items: start;
		padding: var(--space-3);
		border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--border));
		border-radius: var(--radius-sm);
		background: var(--warning-soft);
	}
	.callout strong {
		font: 700 11px var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--warning);
	}
	.callout p {
		margin: 0;
		font-size: 14px;
		color: var(--text);
		line-height: 1.5;
	}
	.callout a {
		font-size: 14px;
		color: var(--accent);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}
	.licencas {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.licencas li {
		display: grid;
		gap: 2px;
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.licencas li:last-child {
		border-bottom: 0;
	}
	.licencas .lic {
		color: var(--muted);
		font: 600 11.5px var(--font-display);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.licencas p {
		margin: 2px 0 0;
		line-height: 1.5;
	}
	a {
		color: var(--accent);
		overflow-wrap: anywhere;
	}
</style>
