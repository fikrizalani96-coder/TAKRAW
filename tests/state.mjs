// Advance a human-mode match to a given state and screenshot it. Usage: node tests/state.mjs <w> <h> <out> <state> [servingTeam]
// state: serve-ready | toss | rally-ours (ball coming to the human team)
import { chromium } from 'playwright-core';
const [,, w = '390', h = '844', out = 'tests/out/state.png', state = 'serve-ready', st = '0'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, hasTouch: +w < 700, isMobile: +w < 700 });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto(`http://localhost:5173/?auto=1&human=1&quality=low&shot=1&format=quick&touch=${+w < 700 ? 1 : 0}`);
await p.waitForFunction('window.__stgc && window.__stgc.hc', null, { timeout: 240000 });
const r = await p.evaluate(({ state, st }) => {
  const g = window.__stgc, m = g.match, hc = g.hc;
  const z = { A: false, B: false, C: false, D: false, switch: false };
  const cond = () => state === 'serve-ready' ? (m.state === 'serve-ready' && m.rules.serving === +st) : state === 'toss' ? (m.state === 'toss' && m.rules.serving === +st && m.serve && m.serve.released) : (m.state === 'rally' && hc.context !== 'defend' && hc.context !== 'idle' && m.ball.z * hc.side > 0.5);
  for (let i = 0; i < 60 * 900; i++) {
    hc.setInput(0, 0, z, z); hc.update(1 / 60); m.update(1 / 60); g.view.update(1 / 60);
    if (cond()) { for (let k = 0; k < 20; k++) { hc.setInput(0, 0, z, z); hc.update(1 / 60); m.update(1 / 60); g.view.update(1 / 60); } return { ok: true, t: m.time.toFixed(1), state: m.state, ctx: hc.context, labels: hc.labels }; }
    if (m.state === 'serve-ready' && m.rules.serving === 0 && state !== 'serve-ready') { hc.setInput(0, 0, { ...z, A: true }, z); hc.update(1 / 60); }
  }
  return { ok: false };
}, { state, st });
console.log(JSON.stringify(r));
await p.evaluate(() => window.__advance(0.02, 0.02));
await p.waitForTimeout(1200);
await p.screenshot({ path: out });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
