// Runs dist/sepak-takraw.html the way the Artifact viewer does: wrapped in a skeleton, inside a cross-origin
// sandboxed iframe (opaque origin -> storage throws, no gamepad permission) under a strict CSP.
import http from 'node:http';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const [,, w = '1280', h = '720', out = 'tests/out/artifact'] = process.argv;
const page = fs.readFileSync('dist/sepak-takraw.html', 'utf8');
const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;
const csp = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob:; media-src data: blob:; connect-src 'none'; worker-src blob:";
const inner = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': csp }); r.end(doc); }).listen(8790);
const outer = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<body style="margin:0"><iframe src="http://127.0.0.1:8790/" sandbox="allow-scripts allow-pointer-lock" style="border:0;width:100vw;height:100vh"></iframe></body>`); }).listen(8791);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text().slice(0, 240)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('http://localhost:8791/');
const f = () => p.frames().find((x) => x.url().startsWith('http://127.0.0.1:8790'));
await p.waitForTimeout(1500);
await f().waitForSelector('[data-a="play"]', { timeout: 60000 });
await p.waitForTimeout(12000);
await p.screenshot({ path: `${out}_title.png` });
await f().click('[data-a="play"]'); await p.waitForTimeout(300);
await f().click('[data-a="start"]');
for (let i = 0; i < 360 && !(await f().evaluate(() => !!(window.__stgc && window.__stgc.match))); i++) await p.waitForTimeout(500);   // (CSP forbids waitForFunction's eval)
await p.waitForTimeout(2500);
// press keys like a player: serve with J when it's our serve, otherwise just let it run
for (let i = 0; i < 16; i++) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(80); await p.keyboard.up('KeyJ'); await p.waitForTimeout(700); }
const st = await f().evaluate(() => { const m = window.__stgc.match; return { t: m.time.toFixed(1), state: m.state, pts: m.rules.points.join('-'), touches: m.longestRally }; });
console.log('in-frame match:', JSON.stringify(st));
await p.screenshot({ path: `${out}_game.png` });
console.log(errs.length ? 'CONSOLE:\n' + errs.join('\n') : 'no console errors or warnings');
await b.close(); inner.close(); outer.close();
