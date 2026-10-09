<script>
	// The printer window does not open by itself: while VOTA prints, a toast offers to open it.
	// Dismissed, it stays hidden until the next print job.
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { ui, showPanel } from '#lib/ui.svelte.js';

	const { engine } = useEngine();
	// Keep the toast up for at least this long: on instant feed, printing flips off in a frame
	// and the toast would only blink.
	const MIN_MS = 2600;

	let dismissed = $state(false);
	let hold = $state(false);
	let shownAt = 0;
	const printing = $derived(!!$engine?.printer?.printing);

	$effect(() => {
		if (printing) {
			dismissed = false;
			if (!shownAt) shownAt = Date.now();
			hold = true;
			return;
		}
		if (!hold) return;
		const remaining = Math.max(0, MIN_MS - (Date.now() - shownAt));
		const id = setTimeout(() => {
			hold = false;
			shownAt = 0;
		}, remaining);
		return () => clearTimeout(id);
	});
</script>

{#if (printing || hold) && !dismissed && !ui.open.bobina}
	<div class="toast" role="status" data-testid="printer-notice">
		<span class="dot" aria-hidden="true"></span>
		<span>{t('notice.printing')}</span>
		<button class="btn small primary" onclick={() => showPanel('bobina')} data-testid="printer-notice-open">{t('notice.openPrinter')}</button>
		<button class="close" aria-label={t('common.close')} title={t('common.close')} onclick={() => (dismissed = true)}>✕</button>
	</div>
{/if}

<style>
	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		max-width: min(640px, calc(100vw - 32px));
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		color: var(--text);
		font-size: 13.5px;
		animation: rise 0.25s var(--ease);
	}
	.close {
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.close:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
