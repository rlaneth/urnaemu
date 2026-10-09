<script>
	// Ajuda › Fidelidade e limitações: full-screen technical account of what VOTA does, what the
	// emulator does around it, and every patch (content in #lib/fidelidade.js).
	import { useEngine } from '#lib/context.js';
	import { ui } from '#lib/ui.svelte.js';
	import { SECOES, ADAPTACOES, TIPOS } from '#lib/fidelidade.js';

	const { app, engine } = useEngine();
	let article;

	// Re-evaluate the live status whenever the engine snapshot changes.
	const ativas = $derived.by(() => {
		$engine;
		return Object.fromEntries(ADAPTACOES.map((a) => [a.id, safe(() => a.ativa?.(app))]));
	});
	const patchSkips = $derived($engine && (app.wasmPatches?.skipped ?? []));
	function safe(f) {
		try {
			return !!f();
		} catch {
			return false;
		}
	}
	function close() {
		ui.dialog = null;
	}
	function go(id) {
		article?.querySelector('#fid-' + id)?.scrollIntoView({ block: 'start' });
	}
	function onkeydown(e) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window {onkeydown} />

<div class="screen" role="dialog" aria-modal="true" aria-labelledby="fid-title" data-testid="fidelity-screen">
	<header>
		<h1 id="fid-title">Fidelidade e limitações</h1>
		<button class="btn small" onclick={close}>Fechar</button>
	</header>
	<div class="layout">
		<nav aria-label="Seções">
			{#each SECOES as secao}
				<button class="toc" onclick={() => go(secao.id)}>{secao.titulo}</button>
			{/each}
		</nav>
		<article bind:this={article}>
			{#each SECOES as secao}
				<section id={'fid-' + secao.id}>
					<h2>{secao.titulo}</h2>
					{#each secao.blocos as bloco}
						{#if bloco.aviso}
							<p class="aviso">{bloco.aviso}</p>
						{:else if bloco.p}
							<p>{bloco.p}</p>
						{:else if bloco.lista}
							<ul>
								{#each bloco.lista as item}<li>{item}</li>{/each}
							</ul>
						{:else if bloco.codigo}
							<pre><code>{bloco.codigo}</code></pre>
						{:else if bloco.adaptacoes}
							{#each bloco.adaptacoes as tipo}
								{#if bloco.adaptacoes.length > 1}<h3>{TIPOS[tipo]}</h3>{/if}
								{#each ADAPTACOES.filter((a) => a.tipo === tipo) as a (a.id)}
									<div class="adaptacao" id={'fid-' + a.id} data-adaptation={a.id}>
										<div class="cabecalho">
											<h4>{a.titulo}</h4>
											<span class="state" class:success={ativas[a.id]}>{ativas[a.id] ? 'ativa nesta sessão' : 'inativa nesta sessão'}</span>
											{#if a.bugVota}<span class="state warning">defeito no VOTA</span>{/if}
										</div>
										<dl>
											<dt>Onde</dt>
											<dd class="mono">{a.onde}</dd>
											<dt>Por quê</dt>
											<dd>{a.problema}</dd>
											<dt>O que o emulador faz</dt>
											<dd>{a.mudanca}</dd>
											<dt>Efeito</dt>
											<dd>{a.efeito}</dd>
											<dt>Verificação</dt>
											<dd class="mono">{a.teste}</dd>
											{#if a.tipo === 'correcao'}
												<dt>Identificador</dt>
												<dd class="mono">{a.id}{#each patchSkips.filter((s) => s.id === a.id) as s} · não aplicada: {s.reason}{/each}</dd>
											{/if}
										</dl>
									</div>
								{/each}
							{/each}
						{/if}
					{/each}
				</section>
			{/each}
		</article>
	</div>
</div>

<style>
	.screen {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--text);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	h1 {
		margin: 0;
		font: 600 20px var(--font-display);
	}
	.layout {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
	}
	nav {
		display: grid;
		align-content: start;
		gap: 2px;
		padding: var(--space-4) var(--space-3);
		border-right: 1px solid var(--border);
		overflow: auto;
	}
	.toc {
		padding: 6px 10px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: 500 13.5px var(--font-body);
		text-align: left;
		cursor: pointer;
	}
	.toc:hover {
		background: var(--accent-soft);
		color: var(--accent);
	}
	article {
		overflow: auto;
		padding: var(--space-5) var(--space-6) var(--space-7, 64px);
	}
	section {
		max-width: 860px;
		margin: 0 auto var(--space-6);
	}
	h2 {
		font: 600 22px var(--font-display);
		margin: 0 0 var(--space-3);
	}
	h3 {
		font: 600 16px var(--font-display);
		margin: var(--space-5) 0 var(--space-2);
		color: var(--muted);
	}
	p,
	li,
	dd {
		font: 15.5px / 1.65 var(--font-editorial);
	}
	.aviso {
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
	}
	pre {
		overflow-x: auto;
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
		font-size: 13px;
	}
	.adaptacao {
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.cabecalho {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	h4 {
		margin: 0;
		margin-right: auto;
		font: 600 16px var(--font-display);
	}
	dl {
		display: grid;
		grid-template-columns: minmax(110px, max-content) minmax(0, 1fr);
		gap: 6px var(--space-3);
		margin: var(--space-3) 0 0;
	}
	dt {
		font: 600 12.5px var(--font-body);
		color: var(--muted);
		padding-top: 3px;
	}
	dd {
		margin: 0;
	}
	dd.mono {
		font: 13px / 1.5 var(--font-mono);
		overflow-wrap: anywhere;
	}
	@media (max-width: 760px) {
		.layout {
			grid-template-columns: 1fr;
		}
		nav {
			display: none;
		}
		dl {
			grid-template-columns: 1fr;
		}
	}
</style>
