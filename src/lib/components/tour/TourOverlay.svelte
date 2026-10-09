<script>
	// Guided tour: highlights a part of the workspace and explains the step in a card beside it.
	// Never blocks the devices: the user presses the keys; the step advances when the session
	// gets there. "Fazer por mim" runs the step's procedure.
	import { onMount } from 'svelte';
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';
	import { ui, showPanel } from '#lib/ui.svelte.js';
	import { tourById, sessionProblem } from '#lib/tours/index.js';
	import { tour, stopTour, restartForTour, takePendingTour, startTour } from '#lib/tours/runner.svelte.js';

	const { app, engine } = useEngine();
	const s = $derived($engine);
	const current = $derived(tour.id ? tourById(tour.id) : null);
	const ready = $derived(s?.bootStep === 'ready');
	// The session is checked once, when the tour starts: its own steps change what it checks.
	$effect(() => {
		if (current && ready && tour.problem === undefined) tour.problem = sessionProblem(s) ?? current.requer?.(s) ?? null;
	});
	const problem = $derived(tour.problem ?? null);
	const step = $derived(current && tour.problem === null ? current.passos[tour.step] : null);
	const last = $derived(current ? tour.step >= current.passos.length - 1 : false);

	// Resume a tour after the restart it asked for.
	let pending = takePendingTour();
	$effect(() => {
		if (pending && ready) {
			startTour(pending);
			pending = null;
		}
	});

	// Advance past every step the session has already reached (steps with a condition only).
	$effect(() => {
		if (!current || !ready || tour.problem !== null || tour.busy) return;
		let i = tour.step;
		while (i < current.passos.length - 1 && current.passos[i].concluido?.(s, app)) i++;
		if (i !== tour.step) {
			tour.step = i;
			tour.error = null;
		}
	});
	// Open what the step talks about (e.g. the printer window).
	// A window the tour opened closes again when the tour moves on, so it does not cover the devices.
	let opened = null, openedWindow = null;
	$effect(() => {
		const key = step && `${tour.id}:${step.id}`;
		if (opened === key) return;
		if (openedWindow === 'bobina' && !s?.printer?.printing) ui.open.bobina = false;
		openedWindow = null;
		if (step?.abrir) {
			showPanel(step.abrir);
			openedWindow = step.abrir;
		}
		opened = key;
	});

	async function doIt() {
		const fazer = step?.fazer;
		if (!fazer) return;
		tour.busy = true;
		tour.error = null;
		try {
			await app.procedures.run(fazer.procedimento);
		} catch (error) {
			if (error?.message !== 'stopped') tour.error = String(error?.message ?? error);
		} finally {
			tour.busy = false;
		}
	}
	function next() {
		if (last) return close();
		tour.step++;
		tour.error = null;
	}
	function back() {
		if (tour.step > 0) tour.step--;
		tour.error = null;
	}
	function close() {
		app.procedures?.stop();
		stopTour();
	}

	// Highlight and card placement, following the target as the layout changes.
	let target = $state(null);
	let card = $state(null);
	let cardSize = $state({ width: 360, height: 240 });
	let frame;
	function measure() {
		const el = step?.alvo ? document.querySelector(`[data-tour="${step.alvo}"]`) : null;
		const r = el?.getBoundingClientRect();
		const next = r && r.width ? { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null;
		if (JSON.stringify(next) !== JSON.stringify(target)) target = next;
		if (card && (card.offsetWidth !== cardSize.width || card.offsetHeight !== cardSize.height)) cardSize = { width: card.offsetWidth, height: card.offsetHeight };
		frame = requestAnimationFrame(measure);
	}
	onMount(() => {
		frame = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(frame);
	});
	const placement = $derived.by(() => {
		const vw = innerWidth, vh = innerHeight, gap = 16, { width: w, height: h } = cardSize;
		const clampX = (x) => Math.max(gap, Math.min(vw - w - gap, x));
		const clampY = (y) => Math.max(72, Math.min(vh - h - gap, y));
		if (!target) return { left: clampX((vw - w) / 2), top: clampY(vh - h - 32) };
		const spaces = { right: vw - (target.x + target.width), left: target.x, below: vh - (target.y + target.height), above: target.y };
		if (spaces.right >= w + gap * 2) return { left: target.x + target.width + gap, top: clampY(target.y) };
		if (spaces.left >= w + gap * 2) return { left: target.x - w - gap, top: clampY(target.y) };
		if (spaces.below >= h + gap * 2) return { left: clampX(target.x), top: target.y + target.height + gap };
		if (spaces.above >= h + gap * 2 + 64) return { left: clampX(target.x), top: target.y - h - gap };
		return { left: clampX(vw - w - gap), top: clampY(vh - h - gap) };
	});
</script>

<svelte:window onkeydown={(e) => current && e.key === 'Escape' && e.target === document.body && close()} />

{#if current && !ui.dialog && !ui.launcher}
	{#if step && target}
		<div class="ring" style:left="{target.x - 6}px" style:top="{target.y - 6}px" style:width="{target.width + 12}px" style:height="{target.height + 12}px" aria-hidden="true"></div>
	{/if}
	<aside
		class="card"
		bind:this={card}
		style:left="{placement.left}px"
		style:top="{placement.top}px"
		aria-label={current.titulo}
		data-testid="tour"
		data-tour-id={current.id}
		data-step={step?.id ?? (problem ? 'bloqueado' : 'carregando')}
	>
		<header>
			<span class="eyebrow">{t('tour.label')} · {current.titulo}</span>
			<button class="close" aria-label={t('tour.exit')} title={t('tour.exit')} onclick={close}>✕</button>
		</header>

		{#if !ready}
			<p class="muted small">{t('tour.waiting')}</p>
		{:else if problem}
			<h3>{t('tour.newSessionTitle')}</h3>
			<p>{problem}</p>
			<p class="muted small">{t('tour.newSessionBody')}</p>
			<div class="actions">
				<button class="btn small ghost" onclick={close}>{t('tour.cancel')}</button>
				<button class="btn small primary" onclick={() => restartForTour(current.id, s.scenario?.id)} data-testid="tour-restart">{t('tour.newSession')}</button>
			</div>
		{:else if step}
			<h3>{step.titulo}</h3>
			<p>{step.texto}</p>
			{#if step.teclas?.length}
				<ul class="keys">
					{#each step.teclas as k}<li><span class="device">{k.aparelho}</span><kbd>{k.tecla}</kbd></li>{/each}
				</ul>
			{/if}
			{#if step.concluido && !tour.busy}<p class="hint small">{t('tour.autoAdvance')}</p>{/if}
			{#if tour.error}<p class="error small">{tour.error}</p>{/if}
			<div class="actions">
				<span class="count small muted">{tour.step + 1} / {current.passos.length}</span>
				{#if tour.step > 0}<button class="btn small ghost" onclick={back} disabled={tour.busy}>{t('tour.back')}</button>{/if}
				{#if step.fazer}
					<button class="btn small" onclick={doIt} disabled={tour.busy} data-testid="tour-do">{tour.busy ? t('tour.doing') : step.fazer.rotulo}</button>
				{/if}
				{#if !step.concluido}
					<button class="btn small primary" onclick={next} data-testid="tour-next">{last ? t('tour.finish') : t('tour.next')}</button>
				{:else}
					<button class="btn small ghost" onclick={next} disabled={tour.busy} title={t('tour.skipHint')}>{t('tour.skip')}</button>
				{/if}
			</div>
		{/if}
	</aside>
{/if}

<style>
	.ring {
		position: fixed;
		/* Above the floating windows (whose stacking order keeps growing), below dialogs (hidden then). */
		z-index: 1000;
		border: 2px solid var(--accent);
		border-radius: 14px;
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
		pointer-events: none;
		transition:
			left 0.2s var(--ease),
			top 0.2s var(--ease),
			width 0.2s var(--ease),
			height 0.2s var(--ease);
	}
	.card {
		position: fixed;
		z-index: 1001;
		display: grid;
		gap: var(--space-2);
		width: min(360px, calc(100vw - 32px));
		padding: var(--space-3) var(--space-4) var(--space-4);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		color: var(--text);
		transition:
			left 0.2s var(--ease),
			top 0.2s var(--ease);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.eyebrow {
		color: var(--accent);
	}
	h3 {
		margin: 0;
		font-size: 16px;
	}
	p {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.keys li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}
	.device {
		color: var(--muted);
	}
	kbd {
		padding: 1px 6px;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--surface-alt);
		font: 600 11.5px var(--font-display);
	}
	.hint {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.count {
		margin-right: auto;
	}
	.close {
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	.close:hover {
		background: var(--surface-alt);
	}
</style>
