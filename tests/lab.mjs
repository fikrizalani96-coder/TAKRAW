// Screenshot the Animation Lab. Usage: node tests/lab.mjs <w> <h> <clipId|search> <out.png> [mirror]
import { chromium } from 'playwright-core';
const [,, w = '1280', h = '720', clip = 'atk.kuda', out = 'tests/out/lab.png', mirror = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
await p.goto(`http://localhost:5173/?lab=1&quality=${process.env.Q || 'low'}&shot=1`);
await p.waitForFunction('window.__lab && document.querySelector("#lab-status") && document.querySelector("#lab-status").style.display === "none"', null, { timeout: 240000 });
await p.evaluate((y) => { window.__yaw = y; }, process.env.YAW || '0.0');
await p.evaluate(({ clip, mirror }) => {
  const L = window.__lab; if (mirror === 'm') document.querySelector('[data-a="mirror"]').click(); if (mirror === 'face') { document.querySelector('[data-a="face"]').click(); L.S.yaw = +(window.__yaw ?? 0.25); L.S.pitch = 0.0; }
  const q = document.querySelector('#lab-q'); q.value = clip; q.dispatchEvent(new Event('input'));
  const first = document.querySelector('.lab-item'); if (first) first.click();
  L.S.playing = false;
}, { clip, mirror });
// scrub to the contact moment
await p.evaluate(() => { const sc = document.querySelector('#lab-scrub'); sc.value = 500; sc.dispatchEvent(new Event('input')); });
await p.waitForTimeout(1500);
await p.screenshot({ path: out });
console.log(await p.evaluate(() => document.querySelector('#lab-info').innerText.replace(/\n/g, ' | ')));
console.log(await p.evaluate(() => document.querySelectorAll('.lab-item').length + ' items listed'));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
await b.close();
