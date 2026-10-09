<script>
	// VOTA only starts voting at 08:00 on election day. With the computer's clock (or a
	// second-round date weeks away) a session would wait indefinitely: offer to jump there.
	// Floating toast: it never shifts the workspace, and it can be dismissed.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	let dismissed = $state(false);
	const waiting = $derived(!!$engine?.waitingForStart);

	// Show again the next time VOTA starts waiting.
	$effect(() => {
		if (!waiting) dismissed = false;
	});

	const advance = action(app, () => {
		const preset = app.clock.electionDayPreset();
		app.clock.apply({ mode: 'running', iso: preset.iso });
	});
</script>

{#if waiting && !dismissed}
	<div class="toast" role="status" data-testid="start-time-notice">
		<span>{t('notice.waitingForStart')}</span>
		<button class="btn small primary" onclick={advance}>{t('notice.advanceClock')}</button>
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
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
