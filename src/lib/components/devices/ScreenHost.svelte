<script>
	// Adopts the persistent urna screen (canvas + GIF layer) from #urnaemu-parking.
	// The node is moved, never recreated, so the vendor runtime keeps drawing into it.
	import { onMount } from 'svelte';

	let slot;

	onMount(() => {
		const host = document.getElementById('urnaemu-screen');
		slot.append(host);
		return () => document.getElementById('urnaemu-parking')?.append(host);
	});
</script>

<div class="screen-slot" bind:this={slot}></div>

<style>
	.screen-slot {
		width: 100%;
	}
</style>
