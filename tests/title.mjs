// Screenshot the title screen with its live 3D backdrop. Usage: node tests/title.mjs <w> <h> <out> [waitMs]
import { chromium } from 'playwright-core';
const [,, w = '1280', h = '720', out = 'tests/out/title.png', wait = '9000'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, hasTouch: +w < 700, isMobile: +w < 700 });
const errs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/404/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await p.goto('http://localhost:5173/?shot=1');
await p.waitForSelector('.menu');
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
await b.close();
