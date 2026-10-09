<script>
	// Visual reconstruction of the modern touchscreen terminal do mesário.
	// VOTA supplies the text and the cabin occupancy flag; lamps follow the TSE mapping.
	import { useEngine } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();

	const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'D', '0', 'C'];

	// Keys can always be pressed, as on the device; VOTA reads them or ignores them.
	// `listening` only reports whether VOTA's terminal screens are reading the keypad.
	const listening = $derived($engine?.keypads.terminal ?? false);
	const lamps = $derived($engine?.terminal.lamps);
	const power = $derived($engine?.power);
	const scanner = $derived($engine?.scanner);
	const readerReady = $derived(!!scanner?.installed && scanner.capturing && scanner.prompt);

	// Reader simulation. 'correct' injects native acceptance; 'wrong' and
	// 'timeout' take VOTA's native rejection path (no biometric match either way).
	let touch = $state(null); // null | 'pressing' | 'accepted' | 'rejected'

	async function useReader(outcome) {
		if (!readerReady || touch === 'pressing') return;
		if (outcome !== 'timeout') {
			touch = 'pressing';
			await new Promise((r) => setTimeout(r, 650));
		}
		try {
			if (outcome === 'timeout') await app.scanner.timeout();
			else await app.scanner.place(outcome === 'correct');
			touch = outcome === 'correct' ? 'accepted' : 'rejected';
		} catch (error) {
			touch = null;
			app.fail(error);
			return;
		}
		setTimeout(() => (touch = null), 1400);
	}

	function press(key) {
		app.submitKey(key, 'mesario').catch(() => {});
	}
	function label(key) {
		return key === 'D' ? t('terminal.corrige') : key === 'C' ? t('terminal.confirma') : key;
	}
</script>

<section class="terminal" data-testid="terminal" data-tour="terminal" aria-label={t('terminal.title')}>
	<div class="biometrics" class:ready={readerReady} role="group" aria-label={t('terminal.reader.title')} title={t('terminal.reader.note')}>
		<span class="eyebrow">{t('terminal.reader.title')}</span>
		<div class="actions">
			<button class="btn small" disabled={!readerReady} onclick={() => useReader('correct')} data-testid="finger-correct">✓ {t('terminal.reader.correct')}</button>
			<button class="btn small" disabled={!readerReady} onclick={() => useReader('wrong')} data-testid="finger-wrong">✗ {t('terminal.reader.wrong')}</button>
			<button class="btn small" disabled={!readerReady} onclick={() => useReader('timeout')} data-testid="finger-timeout">⏱ {t('terminal.reader.timeout')}</button>
		</div>
	</div>
	<div class="device">
		<button
			class="reader"
			class:ready={readerReady}
			data-touch={touch}
			disabled={!readerReady}
			onclick={() => useReader('correct')}
			data-testid="fingerprint-reader"
			data-tour="fingerprint-reader"
			aria-label={readerReady ? t('terminal.reader.place') : t('terminal.reader.idle')}
			title={readerReady ? t('terminal.reader.place') : t('terminal.reader.idle')}
		>
			<span class="glass"></span>
			<span class="finger" aria-hidden="true"></span>
		</button>
		<div class="touchscreen">
			<!-- VOTA writes a 4×40 character grid (including its own time and vote counter);
			     the terminal renders it across the full display width. -->
			<div class="display">
				<pre class="lcd" data-testid="terminal-lcd" aria-live="polite">{($engine?.terminal.lines ?? []).join('\n')}</pre>
				<div class="controls">
					<div class="battery" data-testid="terminal-battery" title={t('terminal.battery')}>
						{#if power?.image}
							<img src={power.image} alt="{t('terminal.battery')}: {t(`terminal.source.${power.source}`)}, {t(`terminal.level.${power.level}`)}" />
						{/if}
					</div>
					<div class="keys" role="group" aria-label={t('terminal.keypadLabel')} data-testid="terminal-keypad" data-tour="terminal-keypad" data-listening={listening ? 'true' : 'false'}>
						{#each keys as key}
							<button
								class="key"
								class:corrige={key === 'D'}
								class:zero={key === '0'}
								class:confirma={key === 'C'}
								data-terminal-key={key}
								onclick={() => press(key)}>{label(key)}</button
							>
						{/each}
					</div>
					<div class="lamps">
						<div
							class="lamp battery-lamp"
							class:lit={lamps?.bateria}
							class:blinking={lamps?.bateriaStatus === 'critical'}
							data-testid="lamp-bateria"
							data-lit={lamps?.bateria ? 'true' : 'false'}
							data-status={lamps?.bateriaStatus}
						>
							<span>{t('terminal.lamps.bateria')}</span><i></i>
						</div>
						<div class="lamp wait" class:lit={lamps?.aguarde} data-testid="lamp-aguarde" data-lit={lamps?.aguarde ? 'true' : 'false'}>
							<span>{t('terminal.lamps.aguarde')}</span><i></i>
						</div>
						<div class="lamp released" class:lit={lamps?.liberado} data-testid="lamp-liberado" data-lit={lamps?.liberado ? 'true' : 'false'}>
							<span>{t('terminal.lamps.liberado')}</span><i></i>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.terminal {
		/* Device chrome is not text: no selection when clicking keys or labels. */
		user-select: none;
		-webkit-user-select: none;
		display: grid;
		gap: var(--space-3);
		container-type: inline-size;
	}
	/* Fixed device colors, independent of the page theme. */
	/* Terminal do mesário (modelo atual): white wedge, black glass, fingerprint reader on top. */
	.device {
		position: relative;
		padding: clamp(28px, 8cqw, 44px) clamp(12px, 3.4cqw, 20px) clamp(14px, 4cqw, 22px);
		border-radius: 16px 16px 10px 10px;
		background: var(--terminal-case);
		box-shadow:
			inset 0 1px 0 #ffffff1f,
			inset 0 -3px 0 #00000014,
			0 0 0 1px var(--terminal-case-edge),
			var(--shadow-md);
	}
	/* Fingerprint reader, centered above the screen. */
	.reader {
		position: absolute;
		top: clamp(6px, 1.8cqw, 10px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		place-items: center;
		width: clamp(64px, 19cqw, 104px);
		height: clamp(18px, 5cqw, 26px);
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: var(--reader-housing);
		box-shadow: inset 0 1px 2px #00000033;
		cursor: default;
	}
	.reader .glass {
		width: 54%;
		height: 60%;
		border-radius: 3px;
		background: linear-gradient(180deg, #4a5560, #2a3138);
		box-shadow: inset 0 0 0 1px #1a1f24;
		transition:
			background 0.2s var(--ease),
			box-shadow 0.2s var(--ease);
	}
	.reader.ready {
		cursor: pointer;
	}
	/* Capture active: the sensor glows and invites a finger. */
	.reader.ready .glass {
		background: linear-gradient(180deg, #5fa8ff, #2f6fd1);
		box-shadow:
			inset 0 0 0 1px #1d4f9c,
			0 0 10px #5fa8ffaa;
		animation: invite 1.6s ease-in-out infinite;
	}
	.reader[data-touch='accepted'] .glass {
		background: linear-gradient(180deg, #6fe08a, #2f9a4e);
		box-shadow: 0 0 12px #6fe08aaa;
		animation: none;
	}
	.reader[data-touch='rejected'] .glass {
		background: linear-gradient(180deg, #ff8a7a, #d23b2b);
		box-shadow: 0 0 12px #ff8a7aaa;
		animation: none;
	}
	@keyframes invite {
		50% {
			box-shadow:
				inset 0 0 0 1px #1d4f9c,
				0 0 2px #5fa8ff55;
		}
	}
	.finger {
		position: absolute;
		left: 50%;
		bottom: 40%;
		width: 34%;
		height: 260%;
		/* Fingertip (rounded end) points down toward the sensor glass; the finger extends up. */
		border-radius: 40% 40% 999px 999px;
		background: linear-gradient(90deg, #d8a888, #e9c2a5 45%, #d4a283);
		box-shadow: inset 0 6px 8px #b5806155;
		opacity: 0;
		transform: translate(-50%, -60%);
		pointer-events: none;
		transition:
			opacity 0.2s var(--ease),
			transform 0.45s var(--ease);
	}
	.reader[data-touch='pressing'] .finger {
		opacity: 1;
		transform: translate(-50%, 30%);
	}
	.reader.ready:hover:not([data-touch]) .finger {
		opacity: 0.35;
		transform: translate(-50%, -30%);
	}
	/* Biometric controls sit beside the reader, above the terminal. */
	.biometrics {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		opacity: 0.6;
		transition: opacity 0.2s var(--ease);
	}
	.biometrics.ready {
		opacity: 1;
	}
	.biometrics .actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.touchscreen {
		border: clamp(10px, 3.4cqw, 18px) solid #121314;
		border-radius: 8px;
		background: #121314;
		box-shadow: 0 0 0 1px #2a2c2e;
	}
	/* Proportions measured from a photo of the display; units are % of display width. */
	.display {
		container-type: inline-size;
		padding: 0 0 1.8cqw;
		background: #fff;
		color: #1e1e1e;
	}
	.lcd {
		margin: 0;
		/* Only VOTA's text area is light gray; the rest of the display is white. */
		padding: 1cqw 3.7cqw 0.6cqw;
		/* Four text rows plus the vertical padding (border-box sizing). */
		height: calc(4 * 3.9cqw + 1.6cqw);
		background: #ededed;
		overflow: hidden;
		font: 3.3cqw / 3.9cqw 'DejaVu Sans Mono', Menlo, 'Liberation Mono', Consolas, monospace;
		/* Smaller glyphs in the same 40-column cell (2.28cqw per character), soft gray like the panel. */
		letter-spacing: calc(2.28cqw - 3.3cqw * 0.602);
		color: #4b4b4b;
		text-shadow: 0 0 0.6px #4b4b4b80;
		white-space: pre;
	}
	.controls {
		position: relative;
		height: 37.5cqw;
		margin-top: 2.8cqw;
	}
	.battery {
		position: absolute;
		left: 8.6cqw;
		top: 2.3cqw;
		width: 12.4cqw;
		height: 24.8cqw;
	}
	.battery img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.keys {
		position: absolute;
		left: 25.8cqw;
		top: 0;
		display: grid;
		grid-template-columns: 11.8cqw repeat(3, 8.3cqw) 11.8cqw;
		grid-auto-rows: 8.3cqw;
		gap: 1.2cqw 1.4cqw;
	}
	.key {
		min-width: 0;
		padding: 0;
		border: 1px solid #d6d6d6;
		border-radius: 2px;
		background: #f9f9f9;
		color: #4a4a4a;
		font: 3.1cqw / 1 'DejaVu Sans Mono', Menlo, 'Liberation Mono', Consolas, monospace;
		cursor: pointer;
		touch-action: manipulation;
	}
	.key:nth-child(3n + 1) {
		grid-column: 2;
	}
	.key:hover:not(:disabled) {
		filter: brightness(0.96);
	}
	.key:active:not(:disabled) {
		filter: brightness(0.88);
	}
	.key.corrige {
		grid-column: 1 / span 2;
		background: #f2553b;
		border-color: #d9452d;
		color: #8a1f12;
	}
	.key.zero {
		grid-column: 3;
	}
	.key.confirma {
		grid-column: 4 / span 2;
		background: #4fe14b;
		border-color: #3cc338;
		color: #17561a;
	}
	.lamps {
		position: absolute;
		right: 9.8cqw;
		top: 1.6cqw;
		display: grid;
		gap: 3.2cqw;
		justify-items: end;
	}
	.lamp {
		display: flex;
		align-items: center;
		gap: 1.2cqw;
		font: 2.25cqw / 1.2 'DejaVu Sans Mono', Menlo, 'Liberation Mono', Consolas, monospace;
		text-align: right;
		color: #4b4b4b;
	}
	.lamp span {
		max-width: 12cqw;
	}
	.lamp i {
		flex: none;
		width: 2.5cqw;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #5a5a5a, #1d1d1d 70%);
		box-shadow: 0 0 0 1px #9a9a9a;
	}
	.lamp.released.lit i {
		background: radial-gradient(circle at 35% 35%, #b6ffa8, #3cc73a 60%);
		box-shadow: 0 0 0 1px #9a9a9a, 0 0 4px #5fe05c;
	}
	.lamp.wait.lit i {
		background: radial-gradient(circle at 35% 35%, #fff2a8, #e0b828 60%);
		box-shadow: 0 0 0 1px #9a9a9a, 0 0 4px #f0cc40;
	}
	/* Steady red on internal battery; flashes only when the charge is critical. */
	.lamp.battery-lamp.lit i {
		background: radial-gradient(circle at 35% 35%, #ffb0a8, #e3332b 60%);
		box-shadow: 0 0 0 1px #9a9a9a, 0 0 4px #f0443a;
	}
	.lamp.battery-lamp.blinking i {
		animation: flash 1s steps(1, end) infinite;
	}
	@keyframes flash {
		50% {
			background: radial-gradient(circle at 35% 35%, #5a5a5a, #1d1d1d 70%);
			box-shadow: 0 0 0 1px #9a9a9a;
		}
	}
</style>
