// Close-up frame sequence of a chosen skill in the live app. Usage: node tests/closeup.mjs <skillPrefix> [nFrames] [dtBetween] [w] [h]
import { chromium } from 'playwright-core';
const [,, skill = 'spike', nF = '8', gap = '0.09', w = '900', h = '700', quality = 'low'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto(`http://localhost:5173/?auto=1&quality=${quality}&shot=1&format=istaf`);
await p.waitForFunction('window.__advance && window.__stgc', null, { timeout: 240000 });
const info = await p.evaluate((skill) => {
  const g = window.__stgc, m = g.match; let hit = null;
  m.on('skill-start', (e) => { if (!hit && e.skill.startsWith(skill)) hit = { skill: e.skill, id: e.player.id, entry: e.entry.id }; });
  for (let i = 0; i < 30 * 900 && !hit; i++) window.__advance(1 / 30, 1 / 30);
  window.__hit = hit; return hit;
}, skill);
console.log('skill:', JSON.stringify(info));
// dolly the camera onto the player
const files = [];
for (let i = 0; i < +nF; i++) {
  await p.evaluate(({ dt, first }) => {
    const g = window.__stgc, m = g.match, pl = m.players[Math.floor(window.__hit.id / 3)][window.__hit.id % 3];
    if (!first) window.__advance(dt, 1 / 60);
    const s = pl.side, cam = window.__camRig;
    const T = { x: pl.x, y: 1.2 + Math.min(1.2, pl.y || 0), z: pl.z };
    const V = (x, y, z) => ({ x, y, z });
    cam.override = { pos: new (window.__camera.position.constructor)(pl.x + 3.4, 1.7 + 0.6, pl.z + (s > 0 ? 1 : -1) * 4.2), look: new (window.__camera.position.constructor)(T.x, T.y, T.z), fov: 34 };
    cam.pos.copy(cam.override.pos); cam.target.copy(cam.override.look); cam._tmp.copy(cam.override.look);
    window.__camera.position.copy(cam.override.pos); window.__camera.lookAt(cam.override.look); window.__camera.fov = 34; window.__camera.updateProjectionMatrix();
  }, { dt: +gap, first: i === 0 });
  const f = `tests/out/cu_${skill.replace(/\W/g, '_')}_${i}.png`; await p.screenshot({ path: f }); files.push(f);
}
console.log(files.join(' '));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
