// Guided tours, as a user would take them: start from the Ajuda menu in a simple session (the
// tour asks for a new training session and resumes after the restart), then go through the
// opening, a voter and the closing using "Próximo" and "Fazer por mim". Each step must advance
// by itself once the session gets there, and the session must end closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connect, evidencePath } from '../tools/screen-session.mjs';

const b = await connect({ evaluationTimeoutMs: 400000 });
const card = () => b.evaluate(`(()=>{const c=document.querySelector('[data-testid=tour]');return c&&{tour:c.dataset.tourId,step:c.dataset.step,text:c.querySelector('h3')?.textContent??'',error:c.querySelector('.error')?.textContent??null}})()`);
const click = (selector) => b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing ${selector}');e.click();return true})()`);
const menu = (label) =>
	b.evaluate(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const m=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ajuda');m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));await sleep(300);if(!document.querySelector('[role=menuitem]')){m.click();await sleep(300)}
		const it=[...document.querySelectorAll('[role=menuitem]')].find(i=>i.textContent.includes(${JSON.stringify(label)}));if(!it)throw Error('menu item');it.click();await sleep(300);return true})()`);
async function waitStep(step, timeout = 120000) {
	const deadline = Date.now() + timeout;
	let c;
	while (Date.now() < deadline) {
		c = await card().catch(() => null);
		if (c?.error) throw Error(`tour error at ${c.step}: ${c.error}`);
		if (c?.step === step) return c;
		await b.delay(250);
	}
	throw Error(`step ${step} not reached (at ${JSON.stringify(c)})`);
}
let shots = 0;
async function shot(name) {
	const { data } = await b.call('Page.captureScreenshot', { format: 'png' });
	fs.writeFileSync(evidencePath(`tours/${String(++shots).padStart(2, '0')}-${name}.png`), Buffer.from(data, 'base64'));
}
try {
	await b.load('municipal-t1');
	await menu('Abertura da seção');
	await waitStep('bloqueado');
	await shot('bloqueado');
	await click('[data-testid=tour-restart]');
	await b.delay(1500);
	await b.ready();
	await b.evaluate("urnaEmu.printer.setSpeed('instant')");

	// Opening: two introduction steps, then the procedures.
	await waitStep('urna', 60000);
	await shot('urna');
	await click('[data-testid=tour-next]');
	await waitStep('terminal');
	await click('[data-testid=tour-next]');
	await waitStep('teste-teclado');
	await shot('teste-teclado');
	await click('[data-testid=tour-do]');
	await waitStep('zeresima');
	await shot('zeresima');
	await click('[data-testid=tour-do]');
	const afterZeresima = await waitStepOneOf(['inicio', 'aberta']);
	if (afterZeresima === 'inicio') {
		await shot('inicio');
		await click('[data-testid=tour-do]');
		await waitStep('aberta');
	}
	await shot('aberta');
	await click('[data-testid=tour-next]');
	assert.equal(await card(), null, 'the tour closes at the end');

	// A voter: the opening step is skipped (already open).
	await menu('Um eleitor vota');
	await waitStep('liberar');
	await shot('liberar');
	await click('[data-testid=tour-do]');
	await waitStep('votar');
	await shot('votar');
	await click('[data-testid=tour-do]');
	await waitStep('votou');
	await click('[data-testid=tour-next]');

	// Closing.
	await menu('Encerramento e boletim de urna');
	await waitStep('horario');
	await click('[data-testid=tour-do]');
	await waitStep('opcoes');
	await shot('opcoes');
	await click('[data-testid=tour-do]');
	await waitStep('encerrar');
	await shot('encerrar');
	await click('[data-testid=tour-do]');
	await waitStepOneOf(['bu', 'encerrada'], 300000);
	if ((await card()).step === 'bu') await click('[data-testid=tour-do]');
	await waitStep('encerrada', 300000);
	await shot('encerrada');
	const closed = await b.evaluate('({closed:urnaEmu.session.closed,error:urnaEmu.error})');
	assert.equal(closed.closed, true);
	assert.equal(closed.error, null);
	console.log('PASS: the three tours run from the Ajuda menu; each step advances when the session gets there; the session ends closed.');
} finally {
	b.close();
}
async function waitStepOneOf(steps, timeout = 120000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const c = await card().catch(() => null);
		if (c?.error) throw Error(`tour error at ${c.step}: ${c.error}`);
		if (steps.includes(c?.step)) return c.step;
		await b.delay(250);
	}
	throw Error(`none of ${steps} reached`);
}
