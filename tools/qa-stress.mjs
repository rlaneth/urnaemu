// Stress QA: drive many varied sessions through the live UrnaEmu page and report every
// native state reached, highlighting states outside the verified allowlist.
//
//   CDP_PORT=9224 node emulator/tools/qa-stress.mjs [--discover] [--scenarios a,b] [--voters 4] [--speed 5]
//
// --discover temporarily teaches the page every catalogued vtable (each still passes the
// harness slot-signature checks) so a run is not stopped by the first unknown state; the
// report then lists which states the allowlist is missing. Without it, the run is strict
// and an unverified state ends that scenario, as it would for a user.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { connect } from './screen-session.mjs';
import { QA_PAGE as PAGE } from './qa-page.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : fallback;
};
const discover = flag('--discover');
// Random key presses on whichever device accepts input, after the scripted flow.
const fuzz = Number(option('--fuzz', 0));
const seed0 = Number(option('--seed', 1));
const voters = Number(option('--voters', 4));
const speed = option('--speed', '5');
// 'real' keeps the computer clock (as a user would); 'election' starts at 07:30 on election day.
const clockMode = option('--clock', 'real');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'static/vendor/wasm/bases/manifest.json'), 'utf8'));
const scenarios = option('--scenarios', manifest.scenarios.map((s) => s.id).join(',')).split(',');
// The named-state vtable catalog ships in the engine (each entry is [address, RTTI name]).
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/engine/session/vtable-catalog.json'), 'utf8')).states;


const b = await connect({ evaluationTimeoutMs: 600000 });
const base = process.env.EMULATOR_URL || 'http://127.0.0.1:8766/urnaemu/';
const results = [];
const officialFixtures = {
	'municipal-t1': { title: '010309782003', birth: '1960', closeTime: '2026-10-04T20:05:00.000Z' },
	'municipal-t2': { title: '010320642046', birth: '1965', closeTime: '2026-10-25T20:05:00.000Z' }
};
const modes = flag('--official') ? ['official'] : flag('--both') ? ['training', 'official'] : ['training'];

for (const mode of modes)
	for (const scenario of scenarios) {
		if (mode === 'official' && !officialFixtures[scenario]) continue;
		const label = `${scenario} (${mode})`;
		console.log(`\n=== ${label}`);
		const started = Date.now();
		try {
			if (mode === 'training') {
				await b.call('Page.navigate', { url: `${base}?scenario=${scenario}&session=1&testgap=1&persist=1&crypto=1&testkey=1` });
			} else {
				await b.call('Page.navigate', { url: `${base}?scenario=${scenario}` });
				await b.ready();
				await b.evaluate('(async()=>{if(!urnaEmu.loadEditor.provider)await urnaEmu.loadEditor.useKey();return urnaEmu.loadEditor.generateOfficial()})()');
				await b.evaluate('void urnaEmu.loadEditor.apply().catch(e=>urnaEmu.fail(e))');
				await b.delay(1200);
			}
			await b.ready();
			await b.evaluate(`urnaEmu.printer.setSpeed(${JSON.stringify(speed)})`);
			if (clockMode === 'election' && mode === 'training') {
				// The clock applies from boot, so set it and reload once.
				const reloaded = await b.evaluate(`(()=>{const p=urnaEmu.clock.electionDayPreset(),iso=new Date(p.local.replace('T08:00:00','T07:59:30')).toISOString();if(urnaEmu.clock.settings.mode==='running'&&Math.abs(Date.parse(urnaEmu.clock.settings.iso)-Date.parse(iso))<1000)return false;urnaEmu.clock.configure({mode:'running',iso});location.reload();return true})()`).catch(() => true);
				if (reloaded) { await b.delay(800); await b.ready(); }
			} else if (clockMode === 'real' && mode === 'training') {
				const reloaded = await b.evaluate(`(()=>{if(urnaEmu.clock.settings.mode==='real')return false;urnaEmu.clock.configure({mode:'real',iso:new Date().toISOString()});location.reload();return true})()`).catch(() => true);
				if (reloaded) { await b.delay(800); await b.ready(); }
			}
			const baseline = await b.evaluate('[...urnaEmu.experiments.knownVtables.keys()]');
			if (discover) await b.evaluate(`for (const [v, n] of ${JSON.stringify(catalog)}) if (!urnaEmu.experiments.knownVtables.has(v)) urnaEmu.experiments.knownVtables.set(v, n)`);
			await b.evaluate(PAGE);
			const official = mode === 'official' ? JSON.stringify(officialFixtures[scenario]) : 'null';
			const run = async (step, expr) => {
				process.stdout.write(`  ${step}… `);
				try {
					// Never hang: abort a step after 4 minutes or as soon as the engine reports an error.
					let settled = false;
					const watchdog = (async () => {
						for (let s = 0; s < 240; s++) {
							await b.delay(1000);
							if (settled) return;
							const error = await b.evaluate('urnaEmu.error').catch(() => null);
							if (error) throw Error('engine error: ' + error);
						}
						throw Error('step timed out after 4 minutes');
					})();
					watchdog.catch(() => {});
					const value = await Promise.race([b.evaluate(expr), watchdog]).finally(() => (settled = true));
					console.log('ok');
					return value;
				} catch (error) {
					const message = String(error.message).match(/"description":"([^"]{0,300})/)?.[1] ?? String(error.message).slice(0, 300);
					console.log('FAILED: ' + message);
					throw Error(`${step}: ${message}`);
				}
			};
			let failure = null;
			try {
				await run('boot', 'qa.boot()');
				if (mode === 'official') {
					// Mesário registration: wrong finger first, then the session ends registration.
					await run('registration (wrong, then correct finger)', `qa.register(${official},[false,true])`);
				}
				const options = await run('terminal options', 'qa.exploreOptions()');
				console.log('    options: ' + JSON.stringify(options).slice(0, 200));
				await run('audio option', 'qa.audioOption()');
				await run('early closing attempt', 'qa.earlyClose()');
				// Official fixtures register a single voter; a second ballot would be refused as "já votou".
				for (let v = 0; v < (mode === 'official' ? 1 : voters); v++) {
					await run(`voter ${v + 1}`, `qa.authorize(${official}).then(()=>qa.vote(${v}))`);
				}
				if (fuzz) {
					const actions = await run(`fuzz ${fuzz} keys`, `qa.fuzzKeys(${fuzz}, ${seed0 + scenarios.indexOf(scenario)})`);
					console.log('    fuzz tail: ' + JSON.stringify(actions.slice(-6)));
				}
				await run('closing', `qa.close(${official})`);
			} catch (error) {
				failure = error.message;
			}
			const summary = await b.evaluate(`(()=>{
				const transitions=urnaEmu.logger.entries.filter(e=>e.kind==='experimental-transition').map(e=>{try{const x=JSON.parse(e.text);return {name:x.name,vtable:x.vtable}}catch{return null}}).filter(Boolean);
				return {transitions,report:qa.report,closed:urnaEmu.session.closed,error:urnaEmu.error,reason:urnaEmu.experiments.state.reason,logd:urnaEmu.logd.entries.length};
			})()`);
			const seen = new Map(summary.transitions.map((t) => [t.vtable, t.name]));
			const unverified = [...seen].filter(([v]) => !baseline.includes(v)).map(([v, n]) => ({ vtable: '0x' + v.toString(16), name: n }));
			const strictStop = String(failure ?? summary.reason ?? '').match(/Unverified state vtable (0x[0-9a-f]+)/)?.[1];
			const entry = {
				scenario,
				mode,
				seconds: Math.round((Date.now() - started) / 1000),
				failure,
				closed: summary.closed,
				votes: summary.report.votes.length,
				states: [...new Set(summary.transitions.map((t) => t.name))],
				unverified,
				strictStop: strictStop ? { vtable: strictStop, name: catalog.find(([v]) => v === parseInt(strictStop, 16))?.[1] ?? null } : null,
				logdLines: summary.logd,
				steps: summary.report.steps
			};
			results.push(entry);
			console.log(`  → closed=${entry.closed} votes=${entry.votes} states=${entry.states.length} unverified=${JSON.stringify(unverified.map((u) => u.name))}${entry.strictStop ? ' strictStop=' + JSON.stringify(entry.strictStop) : ''}`);
		} catch (error) {
			results.push({ scenario, mode, failure: 'setup: ' + String(error.message).slice(0, 300) });
			console.log('  setup failed: ' + String(error.message).slice(0, 300));
		}
	}

const missing = new Map();
for (const r of results) for (const u of r.unverified ?? []) missing.set(u.vtable, u.name);
for (const r of results) if (r.strictStop) missing.set(r.strictStop.vtable, r.strictStop.name);
const out = path.join(os.tmpdir(), 'urnaemu-evidence', `qa-stress-${Date.now()}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ discover, voters, clock: clockMode, results, missing: Object.fromEntries(missing) }, null, 2) + '\n');
console.log(`\nStates outside the allowlist: ${JSON.stringify(Object.fromEntries(missing), null, 1)}`);
console.log(`Report: ${out}`);
b.close();
