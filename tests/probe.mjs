import { chromium } from 'playwright-core';
import path from 'node:path';
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
import fs from 'node:fs';
let executablePath;
for (const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome','/opt/pw-browsers/chromium']) { if (fs.existsSync(c) && fs.statSync(c).isFile()) { executablePath = c; break; } }
console.log('exe', executablePath);
const b = await chromium.launch({ executablePath, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.goto('file://' + path.resolve('tests/probe.html'));
console.log(JSON.stringify(await p.evaluate(() => window.__probe)));
await b.close();
