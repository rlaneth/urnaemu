<script>
	// Emulator signing identity and media signatures, each action explained.
	import { useEngine, action } from '#lib/context.js';
	import { t } from '#lib/i18n/t.js';

	const { app, engine } = useEngine();
	const editor = app.loadEditor;
	const load = $derived($engine?.load);
	const run = (fn) => action(app, fn);
	const file = (fn) =>
		run(async (event) => {
			const input = event.currentTarget, f = input.files?.[0];
			input.value = '';
			if (f) await fn(f);
		});
	const steps = $derived([
		{ id: 'key', title: t('loadui.signature.key'), body: t('loadui.signature.keyBody'), done: !!load?.provider },
		{ id: 'inputs', title: t('loadui.signature.inputs'), body: t('loadui.signature.inputsBody') },
		{ id: 'media', title: t('loadui.signature.media'), body: t('loadui.signature.mediaBody'), done: !!load?.signed }
	]);
</script>

<div class="signature">
	<p class="muted small">{t('loadui.signature.intro')}</p>
	<p class="state" class:success={!!load?.provider}>{load?.provider ? t('loadui.signature.identity', { alg: load.provider }) : t('loadui.signature.noIdentity')}</p>

	{#each steps as step}
		<section class="card">
			<div class="head">
				<h3>{step.title}</h3>
				{#if step.done}<span class="state success">✓</span>{/if}
			</div>
			<p class="small muted">{step.body}</p>
			<div class="row">
				{#if step.id === 'key'}
					<span class="small">{load?.identity ? `Em uso: ${load.identity.name}` : load?.provider ? `Chave de teste ${load.provider} (Avançado)` : 'Nenhuma identidade: crie ou escolha uma na seção Identidade.'}</span>
				{:else if step.id === 'inputs'}
					<button class="btn small" disabled={!load?.provider} onclick={run(() => editor.signInputs())}>{t('load.signInputs')}</button>
				{:else}
					<button class="btn small" disabled={!load?.provider} onclick={run(() => editor.sign())}>{t('load.sign')}</button>
					<button class="btn small ghost" onclick={run(() => editor.verify())}>{t('load.verify')}</button>
					<label class="btn small ghost">{t('load.trust')}<input type="file" hidden onchange={file(async (f) => editor.trustPublicKey(await f.arrayBuffer()))} /></label>
				{/if}
			</div>
		</section>
	{/each}
	<p class="note small">{t('loadui.signature.note')}</p>
</div>

<style>
	.signature {
		display: grid;
		gap: var(--space-3);
		max-width: 720px;
	}
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h3 {
		font-size: 14px;
	}
	.note {
		padding: var(--space-3);
		border-left: 3px solid var(--warning);
		background: var(--warning-soft);
		line-height: 1.55;
	}
</style>
