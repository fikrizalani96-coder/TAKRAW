// Launches the real app in headless Chromium, auto-starts a match and captures frames + errors.
// Usage: node tests/play.mjs "<query>" outPrefix [w] [h] [seconds] [everySec]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, query = 'auto=1&quality=low', out = 'tests/out/play', w = '720', h = '1280', secs = '30', every = '10'] = process.argv;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, hasTouch: query.includes('touch=1'), isMobile: query.includes('touch=1') });
const errs = [];
p.on('console', (m) => { const t = m.text(); if (['error'].includes(m.type()) && !/404/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
const base = process.env.BASE || 'http://localhost:5173/';
await p.goto(`${base}?${query}&shot=1`);
const t0 = Date.now();
try { await p.waitForFunction('window.__stgc && window.__stgc.match', null, { timeout: 180000 }); } catch (e) { errs.push('TIMEOUT waiting for game start'); }
console.log('game started after', ((Date.now() - t0) / 1000).toFixed(1), 's');
let n = 0;
const end = Date.now() + +secs * 1000;
while (Date.now() < end) {
  await p.waitForTimeout(+every * 1000);
  const info = await p.evaluate(() => { const g = window.__stgc; if (!g) return null; const m = g.match; return { t: m.time.toFixed(1), state: m.state, pts: m.rules.points.join('-'), sets: m.rules.sets.join('-'), touches: m.rallyTouches, fps: window.__fps || 0 }; });
  console.log(JSON.stringify(info));
  await p.screenshot({ path: `${out}_${n++}.png` });
}
if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
await b.close();
