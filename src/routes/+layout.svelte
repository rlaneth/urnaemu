<script>
	import '@fontsource-variable/inter';
	import '@fontsource-variable/manrope';
	import '@fontsource-variable/source-serif-4';
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';
	import '#lib/styles/devices.css';
	import MobileGate from '#lib/components/shell/MobileGate.svelte';

	let { children } = $props();
</script>

<MobileGate>
	{@render children()}
</MobileGate>
