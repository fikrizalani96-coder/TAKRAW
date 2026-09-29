// Drive a match until an instant replay starts, capture it, and verify the game resumes afterwards.
// Usage: node tests/replay.mjs [w] [h] [env]
import { chromium } from 'playwright-core';
const [,, w = '1280', h = '720', env = 'official'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await p.goto(`http://localhost:5173/?auto=1&quality=low&shot=1&format=istaf&env=${env}`);
await p.waitForFunction('window.__advance && window.__stgc && window.__stgc.view.replay', null, { timeout: 240000 });
const started = await p.evaluate(() => { const g = window.__stgc; for (let i = 0; i < 30 * 1500; i++) { window.__advance(1 / 30, 1 / 30); if (g.view.replay.active) return { t: g.match.time.toFixed(1), frames: g.view.replay.clip.length, dur: (g.view.replay.t1 - g.view.replay.t0).toFixed(2) }; } return null; });
console.log('replay started:', JSON.stringify(started));
if (!started) { console.log('NO REPLAY'); await b.close(); process.exit(1); }
const files = [];
for (let i = 0; i < 6; i++) {
  await p.evaluate((n) => { window.__advance(n, 1 / 30); const cr = window.__camRig, rp = window.__stgc.view.replay; if (rp.active && cr.override) { window.__camera.position.copy(cr.override.pos); window.__camera.lookAt(cr.override.look); window.__camera.fov = cr.override.fov; window.__camera.updateProjectionMatrix(); } }, i === 0 ? 0.1 : 0.7);
  await p.waitForTimeout(500);
  const f = `tests/out/replay_${i}.png`; await p.screenshot({ path: f }); files.push(f);
}
const active = await p.evaluate(() => window.__stgc.view.replay.active);
// finish the replay and make sure play resumes
const after = await p.evaluate(() => { const g = window.__stgc; for (let i = 0; i < 30 * 30 && g.view.replay.active; i++) window.__advance(1 / 30, 1 / 30); const st0 = g.match.state; window.__advance(6, 1 / 30); return { activeAfter: g.view.replay.active, stateBefore: st0, stateAfter: g.match.state, override: !!window.__camRig.override }; });
console.log('replay still active after 6 frames of capture:', active, ' after finishing:', JSON.stringify(after));
console.log(files.join(' '));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
await b.close();
