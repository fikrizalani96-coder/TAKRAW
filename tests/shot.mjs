// Usage: node tests/shot.mjs "<url path+query>" out.png [w] [h]  (expects vite dev server on :5173)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, url, out, w = '900', h = '1100'] = process.argv;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const sep = url.includes('?') ? '&' : '?';
await p.goto(`http://localhost:5173${url}${sep}w=${w}&h=${h}`);
try { await p.waitForFunction('window.__ready === true', null, { timeout: 120000 }); } catch (e) { errs.push('TIMEOUT waiting for __ready'); }
console.log(await p.evaluate(() => window.__info || ''));
await p.screenshot({ path: out });
if (errs.length) console.log(errs.join('\n'));
await b.close();
