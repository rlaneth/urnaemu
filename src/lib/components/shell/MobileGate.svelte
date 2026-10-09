<script>
	// A soft gate for small screens: the layout (urna + terminal side by side, floating
	// windows) is built for a computer and does not reflow for a phone. We don't block —
	// we warn, and let the user load anyway after a short countdown.
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/t.js';

	const QUERY = '(max-width: 760px), (max-height: 520px) and (pointer: coarse)';
	const WAIT = 5;

	let small = $state(false);
	let dismissed = $state(false);
	let remaining = $state(WAIT);

	const visible = $derived(small && !dismissed);

	onMount(() => {
		const mq = window.matchMedia(QUERY);
		const sync = () => (small = mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

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
			<button class="load" disabled={remaining > 0} onclick={() => (dismissed = true)}>
				{remaining > 0 ? t('mobile.waiting', { n: remaining }) : t('mobile.loadAnyway')}
			</button>
		</div>
	</div>
{/if}

<style>
	.gate {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: var(--bg);
		overflow: auto;
	}
	.card {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		max-width: 420px;
		text-align: center;
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
