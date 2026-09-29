// Renderer statistics (draw calls / triangles / geometries / textures) for a venue + quality. Usage: node tests/perf.mjs <env> <quality>
import { chromium } from 'playwright-core';
const [,, env = 'official', quality = 'low'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
await p.goto(`http://localhost:5173/?auto=1&env=${env}&quality=${quality}&shot=1`);
await p.waitForFunction('window.__stgc && window.__stgc.match', null, { timeout: 240000 });
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const r = window.__stgc.view.app.renderer; const i = r.info;
  let skinned = 0, tris = 0, verts = 0;
  window.__stgc.view.scene.traverse((o) => { if (o.isSkinnedMesh) { skinned++; verts += o.geometry.attributes.position.count; } });
  return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, skinnedMeshes: skinned, skinnedVerts: verts, programs: i.programs.length };
});
console.log(env, quality, JSON.stringify(info));
await b.close();
