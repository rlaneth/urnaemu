// Regenerates static/og-image.png (1200×630) for Open Graph / social cards. Renders a small HTML
// card in the already-open test Chrome (a throwaway CDP target, so your app tab is untouched) and
// screenshots it — no image libraries needed. Run with the test Chrome open:
//   google-chrome --remote-debugging-port=9224 …   then:  node tools/og-image.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CDP_PORT || 9224;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static', 'og-image.png');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#f6f7fb;--text:#171b2b;--muted:#565e73;--accent:#1a3a8f;--border:#1f2a4424;--warning:#8a5a00;--warning-soft:#b4780018}
  *{margin:0;box-sizing:border-box;user-select:none}::selection{background:transparent}
  html,body{width:1200px;height:630px}
  body{background:radial-gradient(1200px 630px at 78% -10%, #e9edf8 0%, var(--bg) 55%);font-family:Inter,system-ui,sans-serif;color:var(--text);padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:28px}
  .mark{width:132px;height:132px;border-radius:30px;background:linear-gradient(160deg,#214aa8,#15306f);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px #1a3a8f33}
  .mark svg{width:78px;height:78px;stroke:#fff}
  h1{font-family:Manrope,sans-serif;font-weight:800;font-size:108px;letter-spacing:-.03em;line-height:1}
  .beta{font-family:Manrope;font-weight:800;font-size:26px;letter-spacing:.1em;color:var(--warning);background:var(--warning-soft);border-radius:999px;padding:8px 18px;vertical-align:middle;margin-left:22px}
  .tag{font-size:44px;color:var(--text);font-weight:600;margin-top:10px;max-width:980px;line-height:1.18}
  .sub{font-size:30px;color:var(--muted);margin-top:22px;max-width:1000px;line-height:1.4}
  .foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:28px}
  .url{font-family:Manrope;font-weight:500;font-size:30px;color:var(--accent)}
  .note{font-size:24px;color:var(--muted)}
</style></head>
<body>
  <div>
    <div class="top">
      <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"/><path d="M22 19H2"/></svg></div>
      <h1>UrnaEmu<span class="beta">BETA</span></h1>
    </div>
    <div class="tag">Emulador da urna eletrônica brasileira</div>
    <div class="sub">Executa o VOTA original — a versão WebAssembly do Simulador de Votação do TSE — no navegador, e reconstrói o resto: um dia de eleição completo, do teste de teclado ao boletim de urna.</div>
  </div>
  <div class="foot"><span class="url">eleicoes.rlaneth.com/urnaemu</span><span class="note">Sem vínculo com o TSE</span></div>
</body></html>`;

const rpc = (ws, method, params = {}, sessionId) =>
	new Promise((res, rej) => {
		const id = (rpc._id = (rpc._id || 0) + 1);
		const h = (e) => {
			const m = JSON.parse(e.data);
			if (m.id === id) {
				ws.removeEventListener('message', h);
				m.error ? rej(Error(JSON.stringify(m.error))) : res(m.result);
			}
		};
		ws.addEventListener('message', h);
		ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
	});

const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });
await rpc(ws, 'Page.enable', {}, sessionId);
await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false }, sessionId);
await rpc(ws, 'Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }, sessionId);
await new Promise((r) => setTimeout(r, 2500)); // let the web fonts load
const { data } = await rpc(ws, 'Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } }, sessionId);
fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
await rpc(ws, 'Target.closeTarget', { targetId });
ws.close();
console.log('wrote', OUT, Buffer.from(data, 'base64').length, 'bytes');
