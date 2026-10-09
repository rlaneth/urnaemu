<script>
	// Urna eletrônica modelo UE2022: screen in a slim black frame on top; below it, right
	// of center, the telephone-layout digit keys and the BRANCO/CORRIGE/CONFIRMA column.
	import ScreenHost from './ScreenHost.svelte';
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();

	// Braille cells (dots 1–6). Digit keys carry the number sign (⠼) followed by the
	// digit's letter cell (a–j); the word keys spell the whole word.
	const CELLS = {
		'#': [3, 4, 5, 6],
		a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
		m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], r: [1, 2, 3, 5]
	};
	const DIGIT_LETTER = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f', 7: 'g', 8: 'h', 9: 'i', 0: 'j' };
	// Dot centers in a cell, in braille units (dot pitch 2.5, as in standard braille).
	const DOT = { 1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [1, 0], 5: [1, 1], 6: [1, 2] };
	const PITCH = 2.5, CELL = 6, RADIUS = 0.72;
	const rows = [
		['1', '2', '3'],
		['4', '5', '6'],
		['7', '8', '9']
	];

	// Keys can always be pressed, as on the device; VOTA reads them or ignores them.
	// `listening` only reports whether VOTA's urna side is reading the keypad (tests use it).
	const listening = $derived($engine?.keypads.voter ?? false);

	function press(key) {
		app.submitKey(key, 'voter').catch(() => {});
	}
	function dots(word) {
		return [...word].flatMap((letter, i) => CELLS[letter].map((d) => ({ x: 1 + i * CELL + DOT[d][0] * PITCH, y: 1 + DOT[d][1] * PITCH })));
	}
</script>

<!-- Vector braille: embossed dots drawn as soft rings, crisp at any size. -->
{#snippet braille(word)}
	<svg class="braille" viewBox="0 0 {word.length * CELL - CELL + PITCH + 2} {2 * PITCH + 2}" aria-hidden="true">
		{#each dots(word) as dot}
			<circle cx={dot.x} cy={dot.y} r={RADIUS} />
		{/each}
	</svg>
{/snippet}

{#snippet digit(key, column, row)}
	<button
		class="key digit"
		class:tactile={key === '5'}
		style:grid-column={column}
		style:grid-row={row}
		data-vota-key={key}
		onclick={() => press(key)}
		aria-label={key}
	>
		<span class="label">{key}</span>
		{@render braille('#' + DIGIT_LETTER[key])}
	</button>
{/snippet}

{#snippet word(key, label, letters, cls)}
	<button class="key action {cls}" data-vota-key={key} onclick={() => press(key)}>
		<span class="label">{label}</span>
		{@render braille(letters)}
	</button>
{/snippet}

<section class="urna" data-testid="urna" data-tour="urna" data-listening={listening ? 'true' : 'false'} aria-label={t('urna.title')}>
	<div class="case">
		<div class="frame">
			<div class="screen">
				<ScreenHost />
			</div>
		</div>

		<div class="lower">
			<div class="model" aria-hidden="true">UE2022</div>
			<div class="keypad" role="group" aria-label={t('urna.keypadLabel')} data-testid="voter-keypad" data-tour="voter-keypad">
				{#each rows as row, r}
					{#each row as key, c}{@render digit(key, c + 1, r + 1)}{/each}
				{/each}
				{@render digit('0', 2, 4)}
				{@render word('B', t('urna.branco'), 'branco', 'branco')}
				{@render word('D', t('urna.corrige'), 'corrige', 'corrige')}
				{@render word('C', t('urna.confirma'), 'confirma', 'confirma')}
			</div>
		</div>
	</div>
</section>

<style>
	.urna {
		/* Device chrome is not text: no selection when clicking keys or labels. */
		user-select: none;
		-webkit-user-select: none;
		display: grid;
		gap: var(--space-3);
		/* Fit the viewport height on normal screens (the device is ≈ as tall as it is wide),
		   but never below 560px: zooming in must enlarge the urna, not shrink it. */
		width: min(100%, 820px, max(470px, calc((100svh - var(--menubar-height) - 150px) * 0.94)));
		margin-inline: auto;
		container-type: inline-size;
	}
	/* Fixed, realistic casing colors: the device does not follow the page theme. */
	.case {
		position: relative;
		padding: 2.15cqw 0 6.57cqw;
		border-radius: 1.67cqw 1.67cqw 1.19cqw 1.19cqw;
		background: var(--urna-case);
		box-shadow:
			inset 0 1px 0 var(--urna-emboss),
			inset 0 -2px 0 #00000012,
			0 0 0 1px var(--urna-case-edge),
			var(--shadow-lg);
	}
	/* Slim side casing: the screen takes 86% of the case width (the real UE2022 has wider
	   margins), leaving room for a larger terminal do mesário. */
	.frame {
		width: 86%;
		margin-inline: auto;
		padding: 1.31cqw 1.91cqw 1.31cqw;
		background: #000;
	}
	.screen {
		overflow: hidden;
	}

	.lower {
		display: grid;
		grid-template-columns: 41% auto 1fr;
		align-items: end;
		margin-top: 7.76cqw;
	}
	.model {
		justify-self: center;
		width: 27.47cqw;
		margin-bottom: 0.48cqw;
		padding: 1.19cqw 0;
		border: 1.5px solid var(--urna-model-border);
		border-radius: 0.72cqw;
		box-shadow: 1px 1px 0 var(--urna-emboss);
		color: var(--urna-model);
		font: 600 3.11cqw/1 var(--font-body);
		letter-spacing: 0.02em;
		text-align: center;
		text-shadow: 1px 1px 0 var(--urna-emboss);
	}

	.keypad {
		display: grid;
		grid-template-columns: repeat(3, 8.24cqw) 12.42cqw;
		grid-template-rows: repeat(4, 6.57cqw);
		column-gap: 2.27cqw;
		row-gap: 1.91cqw;
	}
	.key {
		position: relative;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 0.84cqw;
		cursor: pointer;
		touch-action: manipulation;
		box-shadow:
			0 0.3cqw 0.42cqw #00000038,
			inset 0 0 0 1px #00000026;
		transition:
			transform 0.06s var(--ease),
			filter 0.15s var(--ease);
	}
	.key:active:not(:disabled) {
		transform: translateY(1px);
		filter: brightness(0.9);
	}
	.key:disabled {
		cursor: not-allowed;
	}
	.digit {
		background: linear-gradient(180deg, #47545e, #3a4650);
		color: #ffffff;
	}
	/* Number at the top-left; its braille (⠼ + letter) to the right, centered vertically. */
	.digit .label {
		position: absolute;
		top: 0.54cqw;
		left: 0.96cqw;
		font: 400 3.46cqw/1 var(--font-body);
	}
	.digit .braille {
		position: absolute;
		top: 50%;
		left: 3.46cqw;
		height: 2.63cqw;
		transform: translateY(-50%);
	}
	/* Raised bar on the 5 key, the tactile reference point. */
	.digit.tactile::after {
		content: '';
		position: absolute;
		left: 25%;
		right: 25%;
		bottom: 0.84cqw;
		height: 0.21cqw;
		border-radius: 0.12cqw;
		background: #5b6871;
		box-shadow: 0 1px 0 #2c353c;
	}
	.braille {
		display: block;
		width: auto;
		overflow: visible;
	}
	.braille circle {
		fill: #ffffff10;
		stroke: #22292f;
		stroke-width: 0.32;
	}
	.digit .braille circle {
		fill: #56636d;
		stroke: #2a333a;
	}

	.action {
		grid-column: 4;
		display: grid;
		align-content: start;
		justify-items: center;
		gap: 0.6cqw;
		padding-top: 0.6cqw;
		color: #111;
	}
	.action .label {
		font: 500 2.03cqw/1 var(--font-body);
		letter-spacing: -0.01em;
	}
	/* Words are long: fit the braille to the key width (cells keep their proportions). */
	.action .braille {
		width: 84%;
		height: auto;
	}
	.branco {
		grid-row: 1;
		background: linear-gradient(180deg, #ffffff, #ececec);
	}
	.branco .braille circle {
		fill: #ffffff;
		stroke: #6d6d6d;
	}
	.corrige {
		grid-row: 2;
		background: linear-gradient(180deg, #ff6516, #f05200);
	}
	.corrige .braille circle {
		fill: #ff7a35;
		stroke: #8a2e00;
	}
	.confirma {
		grid-row: 3 / span 2;
		padding-top: 1.91cqw;
		background: linear-gradient(180deg, #52b356, #47a54b);
		gap: 1.19cqw;
	}
	.confirma .label {
		font-size: 2.15cqw;
	}
	.confirma .braille circle {
		fill: #5cbd60;
		stroke: #1f5a22;
	}

</style>
