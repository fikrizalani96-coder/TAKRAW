// Captures frame sequences around key game moments in the real app. Usage: node tests/moments.mjs <moment> [quality] [w] [h]
// moment: serve | spike | set | block | any
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, moment = 'spike', quality = 'low', w = '720', h = '1280', seed = ''] = process.argv;
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
await p.goto(`http://localhost:5173/?auto=1&quality=${quality}&shot=1&format=istaf&env=${process.env.ENV || "official"}`);
await p.waitForFunction('window.__advance && window.__stgc', null, { timeout: 240000 });
// advance to the moment
const found = await p.evaluate((moment) => {
  const g = window.__stgc, m = g.match; let hit = null;
  m.on('skill-start', (e) => { if (!hit && (moment === 'any' || e.skill.startsWith(moment) || (moment === 'spike' && e.skill.startsWith('spike')))) hit = e.skill + ' by ' + e.player.role + ' team ' + e.player.team; });
  m.on('serve-start', () => { if (moment === 'serve' && !hit) hit = 'serve'; });
  for (let i = 0; i < 30 * 600 && !hit; i++) window.__advance(1 / 30, 1 / 30);
  return hit;
}, moment);
console.log('moment:', found);
const frames = 8; const files = [];
for (let i = 0; i < frames; i++) {
  await p.evaluate((dt) => window.__advance(dt, 1 / 60), i === 0 ? 0.0 : 0.11);
  const f = `tests/out/mom_${moment}_${i}.png`; await p.screenshot({ path: f }); files.push(f);
}
console.log(files.join(' '));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
