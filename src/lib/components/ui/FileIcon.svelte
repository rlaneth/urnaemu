<script>
	// Line icons for the file browser (24×24, stroke-based, follow currentColor).
	let { kind = 'file' } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
	{#if kind === 'folder'}
		<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
	{:else}
		<path d="M6.5 3.5h7l4 4v11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
		<path d="M13.5 3.5v4h4" />
		{#if kind === 'log'}
			<path d="M8.5 12h7M8.5 15h7M8.5 18h4" />
		{:else if kind === 'signature'}
			<rect x="9" y="13" width="6" height="5" rx="1" />
			<path d="M10.2 13v-1.4a1.8 1.8 0 0 1 3.6 0V13" />
		{:else if kind === 'report'}
			<path d="M8.5 18v-3M12 18v-6M15.5 18v-4" />
		{:else if kind === 'archive'}
			<path d="M11 9h2M11 11h2M11 13h2" />
			<rect x="10" y="15" width="4" height="3" rx="0.8" />
		{:else if kind === 'data'}
			<path d="M8.5 12.5h1.5v5H8.5zM12 12.5h1.5v5H12zM15.5 12.5" />
			<circle cx="15.5" cy="15" r="1.2" />
		{/if}
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
