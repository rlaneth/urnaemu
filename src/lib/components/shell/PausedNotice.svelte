<script>
	// Paused emulation looks like a hang: key presses still advance VOTA one step each,
	// but screens that progress on their own (such as "Gravando") stop. Say so, and offer
	// to resume, whenever something (the Sessão menu, a test tool) has paused execution.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	const paused = $derived(!!$engine?.initialized && $engine?.autoRun === false && !$engine?.error);
	const resume = action(app, () => app.run());
</script>

{#if paused}
	<div class="toast" role="status" data-testid="paused-notice">
		<span>{t('notice.paused')}</span>
		<button class="btn small primary" onclick={resume}>{t('notice.resume')}</button>
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
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
