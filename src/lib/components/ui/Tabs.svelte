<script>
	// Tab strip whose panels stay mounted (hidden when inactive), so the printer
	// keeps feeding and the log keeps its scroll position.
	let { tabs, active = $bindable(), label, panel } = $props();
</script>

<div class="tabs">
	<div class="strip" role="tablist" aria-label={label}>
		{#each tabs as tab (tab.id)}
			<button
				role="tab"
				class="tab"
				class:active={active === tab.id}
				aria-selected={active === tab.id}
				data-testid="tab-{tab.id}"
				onclick={() => (active = tab.id)}
			>
				{tab.label}
				{#if tab.badge}<span class="badge">{tab.badge}</span>{/if}
			</button>
		{/each}
	</div>
	{#each tabs as tab (tab.id)}
		<div class="panel" role="tabpanel" hidden={active !== tab.id} data-panel={tab.id}>
			{@render panel(tab.id)}
		</div>
	{/each}
</div>

<style>
	.tabs {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	.strip {
		display: flex;
		gap: 2px;
		padding: 6px 8px 0;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 14px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: 600 13px var(--font-display);
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
		left: 10px;
		right: 10px;
		bottom: 0;
		height: 2px;
		border-radius: 2px;
		background: var(--accent);
	}
	.badge {
		min-width: 18px;
		padding: 0 5px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
		font: 600 11px/18px var(--font-body);
		text-align: center;
	}
	.panel {
		min-width: 0;
		padding: var(--space-5);
	}
</style>
