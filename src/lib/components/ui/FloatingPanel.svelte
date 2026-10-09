<script>
	// Floating, draggable, resizable and closeable window with tabs. Panels stay mounted
	// while hidden, so logs keep scrolling and editors keep their drafts.
	import { onMount } from 'svelte';
	import { nextZ } from './stacking.js';

	let { tabs, active = $bindable(), open = $bindable(), label, panel, storageKey = 'urnaemu:painel:v1', initial = {}, minWidth = 360, minHeight = 220 } = $props();

	let box;
	let z = $state(nextZ());
	// A window that opens comes to the front.
	$effect(() => {
		if (open) {
			z = nextZ();
			fit();
		}
	});
	// Initial geometry only; later changes come from dragging and resizing.
	// svelte-ignore state_referenced_locally
	const start = { width: 640, height: 440, anchor: 'right', ...initial };
	let rect = $state({ x: null, y: null, width: start.width, height: start.height });

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
			if (saved) rect = { ...rect, ...saved };
		} catch {}
		if (rect.x === null) place();
		const save = new ResizeObserver(() => {
			if (!box || box.hidden) return;
			rect.width = box.offsetWidth;
			rect.height = box.offsetHeight;
			persist();
		});
		save.observe(box);
		return () => save.disconnect();
	});

	// `initial.cascade` (0, 1, 2…) shifts windows that share a corner so they do not cover each other exactly.
	function place() {
		const shift = (start.cascade ?? 0) * 32;
		rect.x = start.anchor === 'left' ? 24 + shift : Math.max(16, innerWidth - rect.width - 24 - shift);
		rect.y = Math.max(72, innerHeight - rect.height - 24 - shift);
	}
	// A window opened on a smaller screen (or saved further right) is pulled back into view.
	function fit() {
		if (rect.x === null) return;
		rect.width = Math.min(rect.width, innerWidth - 16);
		rect.height = Math.min(rect.height, innerHeight - 64);
		rect.x = Math.min(Math.max(8, rect.x), innerWidth - rect.width - 8);
		rect.y = Math.min(Math.max(56, rect.y), Math.max(56, innerHeight - rect.height - 8));
	}
	function clamp() {
		rect.x = Math.min(Math.max(0, rect.x), Math.max(0, innerWidth - 120));
		rect.y = Math.min(Math.max(56, rect.y), Math.max(56, innerHeight - 48));
	}
	function persist() {
		try {
			localStorage.setItem(storageKey, JSON.stringify(rect));
		} catch {}
	}

	function startDrag(event) {
		if (event.button !== 0 || event.target.closest('button')) return;
		const startX = event.clientX - rect.x, startY = event.clientY - rect.y;
		const move = (e) => {
			rect.x = e.clientX - startX;
			rect.y = e.clientY - startY;
			clamp();
		};
		const up = () => {
			removeEventListener('pointermove', move);
			removeEventListener('pointerup', up);
			persist();
		};
		addEventListener('pointermove', move);
		addEventListener('pointerup', up);
		event.preventDefault();
	}

	// Custom corner grip: the native `resize: both` handle sits under the scrollbar and is
	// hard to grab. This one stays on top and clamps the window to the viewport.
	function startResize(event) {
		if (event.button !== 0) return;
		const startX = event.clientX, startY = event.clientY;
		const w0 = rect.width, h0 = rect.height;
		const move = (e) => {
			rect.width = Math.max(minWidth, Math.min(w0 + (e.clientX - startX), innerWidth - rect.x - 8));
			rect.height = Math.max(minHeight, Math.min(h0 + (e.clientY - startY), innerHeight - rect.y - 8));
		};
		const up = () => {
			removeEventListener('pointermove', move);
			removeEventListener('pointerup', up);
			persist();
		};
		addEventListener('pointermove', move);
		addEventListener('pointerup', up);
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<svelte:window onresize={clamp} />

<section
	class="floating"
	bind:this={box}
	hidden={!open}
	aria-label={label}
	style:left="{rect.x ?? 0}px"
	style:top="{rect.y ?? 0}px"
	style:width="{rect.width}px"
	style:height="{rect.height}px"
	style:min-width="{minWidth}px"
	style:z-index={z}
	onpointerdown={() => (z = nextZ())}
	style:min-height="{minHeight}px"
	data-testid="floating-panel"
>
	<!-- Drag handle; keyboard users reach every control through the tabs and close button. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<header class="bar" onpointerdown={startDrag}>
		<div class="strip" role="tablist">
			{#each tabs as tab (tab.id)}
				<button role="tab" class="tab" class:active={active === tab.id} aria-selected={active === tab.id} data-testid="tab-{tab.id}" onclick={() => (active = tab.id)}>
					{tab.label}
				</button>
			{/each}
		</div>
		<button class="close" aria-label="Fechar" title="Fechar" onclick={() => (open = false)}>✕</button>
	</header>
	<div class="body">
		{#each tabs as tab (tab.id)}
			<div class="panel" role="tabpanel" hidden={active !== tab.id} data-panel={tab.id}>
				{@render panel(tab.id)}
			</div>
		{/each}
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resizer" onpointerdown={startResize} aria-hidden="true"></div>
</section>

<style>
	.floating {
		position: fixed;
		display: flex;
		flex-direction: column;
		max-width: calc(100vw - 16px);
		max-height: calc(100svh - 64px);
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 6px 8px 0 10px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-alt);
		cursor: grab;
		user-select: none;
		touch-action: none;
	}
	.bar:active {
		cursor: grabbing;
	}
	.strip {
		display: flex;
		flex: 1;
		gap: 2px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tab {
		position: relative;
		height: 34px;
		padding: 0 12px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: 600 12.5px var(--font-display);
		cursor: pointer;
		white-space: nowrap;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab.active {
		color: var(--accent);
	}
	.tab.active::after {
		content: '';
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 0;
		height: 2px;
		border-radius: 2px;
		background: var(--accent);
	}
	.close {
		width: 32px;
		height: 32px;
		margin-bottom: 4px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		font-size: 13px;
		cursor: pointer;
	}
	.close:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.panel {
		height: 100%;
		padding: var(--space-4) var(--space-5);
	}
	.resizer {
		position: absolute;
		right: 0;
		bottom: 0;
		z-index: 3;
		width: 18px;
		height: 18px;
		cursor: nwse-resize;
		touch-action: none;
	}
	.resizer::after {
		content: '';
		position: absolute;
		right: 3px;
		bottom: 3px;
		width: 8px;
		height: 8px;
		border-right: 2px solid var(--border-strong);
		border-bottom: 2px solid var(--border-strong);
		border-bottom-right-radius: 4px;
	}
</style>
