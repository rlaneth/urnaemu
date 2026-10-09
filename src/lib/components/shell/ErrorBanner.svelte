<script>
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	const error = $derived($engine?.error);
	// Known native limitations get a plain-language explanation; the raw message stays below.
	const explanation = $derived(/thread constructor failed/.test(error ?? '') ? t('error.unsupportedThread') : null);

	function dismiss() {
		app.error = null;
		app.notify();
	}
</script>

{#if error}
	<div class="banner" role="alert" data-testid="error-banner">
		<div>
			<strong>{t('error.prefix')}</strong>
			{#if explanation}<p class="explain">{explanation}</p>{/if}
			<span class="mono">{error}</span>
		</div>
		<button class="btn small ghost" onclick={dismiss}>{t('error.dismiss')}</button>
	</div>
{/if}

<style>
	.banner {
		width: min(720px, calc(100vw - 32px));
		box-shadow: var(--shadow-lg);
		/* Opaque: a solid surface with a danger tint, not the translucent --danger-soft. */
		background: color-mix(in srgb, var(--surface) 90%, var(--danger));
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
		border-radius: var(--radius);
		color: var(--danger);
		font-size: 13.5px;
	}
	.banner .mono {
		display: block;
		margin-top: 2px;
		overflow-wrap: anywhere;
		font-size: 12.5px;
	}
	.explain {
		margin: 4px 0 2px;
		color: var(--text);
		line-height: 1.5;
	}
</style>
