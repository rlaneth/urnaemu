<script>
	// Date in the Brazilian convention (DD/MM/AAAA) for a value stored as AAAAMMDD, the format
	// of the load media (voter and candidate birth dates). Digits are masked as they are typed.
	let { value = $bindable(''), oninput = null, class: className = 'input mono', ...rest } = $props();

	const toDisplay = (v) => (/^\d{8}$/.test(v ?? '') ? `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}` : (v ?? ''));
	let text = $state(toDisplay(value));
	// Follow outside changes (another row, a reload of the draft) without fighting the typing.
	$effect(() => {
		const shown = toDisplay(value);
		if (digits(text).length === 8 || !text) text = shown;
	});

	function digits(s) {
		return String(s).replace(/\D/g, '').slice(0, 8);
	}
	function mask(d) {
		return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
	}
	const valid = $derived.by(() => {
		if (!/^\d{8}$/.test(value ?? '')) return false;
		const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T12:00:00Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10).replace(/-/g, '') === value;
	});

	function input(event) {
		const d = digits(event.currentTarget.value);
		text = mask(d);
		event.currentTarget.value = text;
		// Stored as AAAAMMDD once complete; partial input is kept as typed so validation reports it.
		value = d.length === 8 ? `${d.slice(4, 8)}${d.slice(2, 4)}${d.slice(0, 2)}` : text;
		oninput?.(event);
	}
</script>

<input {...rest} class={className} class:invalid={!!value && !valid} value={text} oninput={input} inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" />

<style>
	.invalid {
		border-color: color-mix(in srgb, var(--danger) 60%, transparent);
	}
</style>
