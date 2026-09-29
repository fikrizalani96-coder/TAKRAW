// Play a quick match to the end in the real app and screenshot the results screen. Usage: node tests/results.mjs <w> <h> <out>
import { chromium } from 'playwright-core';
const [,, w = '1280', h = '720', out = 'tests/out/results.png'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('http://localhost:5173/?auto=1&quality=low&shot=1&format=quick');
await p.waitForFunction('window.__advance && window.__stgc', null, { timeout: 240000 });
const r = await p.evaluate(() => { const m = window.__stgc.match; for (let i = 0; i < 30 * 1500 && m.state !== 'matchend'; i++) window.__advance(1 / 30, 1 / 30); return { state: m.state, score: m.rules.points.join('-'), sets: m.rules.sets.join('-') }; });
console.log(JSON.stringify(r));
await p.waitForFunction('document.querySelector(".overlay")', null, { timeout: 60000 }).catch(() => errs.push('results overlay did not appear'));
await p.waitForTimeout(800);
await p.screenshot({ path: out });
console.log((await p.evaluate(() => document.querySelector('.menu') ? document.querySelector('.menu').innerText.slice(0, 400) : 'no menu')).replace(/\n+/g, ' | '));
const btns = await p.$$eval('[data-a]', (n) => n.map((e) => e.dataset.a)); console.log('buttons', btns.join(','));
if (btns.includes('again')) { await p.click('[data-a="again"]'); await p.waitForFunction('window.__stgc && window.__stgc.match && window.__stgc.match.time < 5', null, { timeout: 240000 }).catch(() => errs.push('rematch did not start')); console.log('rematch started'); }
if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
await b.close();
