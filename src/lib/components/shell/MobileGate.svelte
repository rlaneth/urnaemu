<script>
	// A soft gate for small screens: the layout (urna + terminal side by side, floating
	// windows) is built for a computer and does not reflow for a phone. We don't block —
	// we warn, and let the user load anyway after a short countdown.
	//
	// The app is not rendered behind the warning: its wide layout would stretch a phone's
	// layout viewport and leave the warning zoomed out. The check runs once, at load (a
	// later resize or rotation never interrupts a running session), and a dismissal is
	// remembered so the warning is shown only on the first visit.
	import { t } from '#lib/i18n/t.js';

	let { children } = $props();

	const QUERY = '(max-width: 760px), (max-height: 520px) and (pointer: coarse)';
	const KEY = 'urnaemu:aviso-celular';
	const WAIT = 5;

	function alreadyDismissed() {
		try {
			return localStorage.getItem(KEY) === '1';
		} catch {
			return false;
		}
	}

	let visible = $state(window.matchMedia(QUERY).matches && !alreadyDismissed());
	let remaining = $state(WAIT);

	function proceed() {
		try {
			localStorage.setItem(KEY, '1');
		} catch {}
		visible = false;
	}

	// Count down only while the overlay is actually showing.
	$effect(() => {
		if (!visible || remaining <= 0) return;
		const id = setTimeout(() => (remaining -= 1), 1000);
		return () => clearTimeout(id);
	});
</script>

{#if visible}
	<div class="gate" role="alertdialog" aria-modal="true" aria-labelledby="mg-title" aria-describedby="mg-body">
		<div class="card">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect width="20" height="14" x="2" y="3" rx="2" />
				<line x1="8" x2="16" y1="21" y2="21" />
				<line x1="12" x2="12" y1="17" y2="21" />
			</svg>
			<h1 id="mg-title">{t('mobile.title')}</h1>
			<p id="mg-body">{t('mobile.body')}</p>
			<button class="load" disabled={remaining > 0} onclick={proceed}>
				{remaining > 0 ? t('mobile.waiting', { n: remaining }) : t('mobile.loadAnyway')}
			</button>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.gate {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		background: var(--bg);
		overflow-y: auto;
	}
	.card {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		width: 100%;
		max-width: 420px;
		margin: auto;
		text-align: center;
		overflow-wrap: anywhere;
	}
	.icon {
		width: 56px;
		height: 56px;
		color: var(--accent);
	}
	h1 {
		margin: 0;
		font: 600 22px var(--font-display);
		color: var(--text);
	}
	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.55;
	}
	.load {
		margin-top: var(--space-2);
		padding: 10px 18px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--on-accent);
		font: 600 14px var(--font-body);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.load:disabled {
		background: var(--surface-alt);
		color: var(--faint);
		border-color: var(--border);
		cursor: default;
	}
</style>
