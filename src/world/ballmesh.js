// Woven sepak takraw ball: 12 pentagonal holes / 20 intersections (dodecahedral weave) built from
// 30 curved rattan-like bands, with a dark inner shell so the holes read as depth.
import * as THREE from 'three';

export function buildBallMesh(radius = 0.0668, opts = {}) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const v = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a / phi, b * phi]); v.push([a / phi, b * phi, 0]); v.push([a * phi, 0, b / phi]); }
  const verts = v.map((p) => new THREE.Vector3(...p).normalize());
  // edges: pairs at the minimal distance
  let dmin = Infinity;
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) dmin = Math.min(dmin, verts[i].distanceTo(verts[j]));
  const edges = [];
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) if (Math.abs(verts[i].distanceTo(verts[j]) - dmin) < 1e-3) edges.push([i, j]);
  const geos = [];
  const seg = 12, band = radius * 0.19;
  edges.forEach(([i, j], k) => {
    const pts = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const p = verts[i].clone().lerp(verts[j], t).normalize();
      // weave: bands alternate slightly above/below the mean shell
      const lift = 1 + 0.045 * Math.sin(t * Math.PI) * ((k % 2) ? 1 : -1) + 0.02 * Math.sin(t * Math.PI * 2 + k);
      pts.push(p.multiplyScalar(radius * lift));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    geos.push(new THREE.TubeGeometry(curve, seg, band * 0.5, 6, false));
  });
  const merged = mergeTubes(geos);
  const weaveTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#c98a1e'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 4) { g.fillStyle = i % 8 ? 'rgba(255,215,120,0.5)' : 'rgba(110,60,0,0.45)'; g.fillRect(0, i, 64, 2); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xffc04a, map: weaveTex, roughness: 0.5, metalness: 0.05, emissive: 0x6a3a08, emissiveIntensity: 0.55 });
  const mesh = new THREE.Mesh(merged, mat);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.965, 20, 14), new THREE.MeshStandardMaterial({ color: opts.inner ?? 0x8a4f14, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x3a1c04, emissiveIntensity: 0.4 }));
  const g = new THREE.Group(); g.add(mesh); g.add(inner);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

function mergeTubes(list) {
  let n = 0, ni = 0;
  for (const g of list) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + o;
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
