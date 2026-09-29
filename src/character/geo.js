// Turn a meshed SDF scene into a skinned THREE.BufferGeometry with baked AO and per-vertex tags.
import * as THREE from 'three';
import { meshScene, bakeAO, computeSkin } from './mesher.js';

/** Laplacian smoothing of a per-vertex scalar over the mesh edges (kills speckle in baked AO). */
function smoothOverMesh(vals, idx, n, iters) {
  if (!iters) return;
  const sum = new Float32Array(n), cnt = new Uint16Array(n);
  for (let it = 0; it < iters; it++) {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      sum[a] += vals[b] + vals[c]; cnt[a] += 2; sum[b] += vals[a] + vals[c]; cnt[b] += 2; sum[c] += vals[a] + vals[b]; cnt[c] += 2;
    }
    for (let i = 0; i < n; i++) if (cnt[i]) vals[i] = vals[i] * 0.5 + 0.5 * sum[i] / cnt[i];
  }
}

export function buildSkinnedGeometry(sc, bounds, h, bind, rig, opts = {}) {
  const mesh = meshScene(sc, bounds, h, { clip: opts.clip, wide: opts.wide });
  const { skinIndex, skinWeight } = computeSkin(mesh, bind.segs, rig.index, opts.kw ?? 0.014, opts.exponent ?? 2.0);
  const n = mesh.nV;
  const ao = opts.ao === false ? null : bakeAO(sc, mesh, opts.aoStrength ?? 1.0, opts.aoRadius ?? 0.03);
  if (ao) smoothOverMesh(ao, mesh.indices, n, opts.aoSmooth ?? 2);
  const aoAttr = new Float32Array(n);
  for (let i = 0; i < n; i++) aoAttr[i] = ao ? 0.35 + 0.65 * ao[i] : 1;
  // Dominant primitive tag per vertex (used for tint: lips, brows, ears ...)
  let tags = null;
  if (opts.tint) {
    tags = new Array(n);
    for (let v = 0; v < n; v++) {
      const list = mesh.wide(mesh.cellBlock[v]);
      const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
      let best = 1e9, tag = null;
      for (const p of list) { if (p.op !== 'add') continue; const d = p.d(x, y, z) + (p.tag === 'skin' ? 0.0035 : 0); if (d < best) { best = d; tag = p.tag; } }
      tags[v] = tag;
    }
  }
  const tint = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = opts.tint ? opts.tint(tags[i], mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2], mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]) : [1, 1, 1];
    tint[i * 3] = t[0]; tint[i * 3 + 1] = t[1]; tint[i * 3 + 2] = t[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geo.setAttribute('ao', new THREE.BufferAttribute(aoAttr, 1));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = aoAttr[i]; color[i * 3] = tint[i * 3] * a; color[i * 3 + 1] = tint[i * 3 + 1] * a; color[i * 3 + 2] = tint[i * 3 + 2] * a; }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius *= 1.6; // skinned poses move outside the bind-pose bounds
  return geo;
}

/** Share geometry buffers but give a garment its own colour attribute (per kit). */
export function recolor(geo, colorFn) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight', 'ao']) g.setAttribute(k, geo.getAttribute(k));
  g.setIndex(geo.index);
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), ao = geo.getAttribute('ao');
  const n = pos.count;
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
    const a = ao.getX(i);
    color[i * 3] = c[0] * a; color[i * 3 + 1] = c[1] * a; color[i * 3 + 2] = c[2] * a;
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.boundingSphere = geo.boundingSphere;
  return g;
}

/** Body geometry variant with triangles hidden under garments removed (shares vertex buffers). */
export function hideCovered(geo, cloths, margin = 0.0025) {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const covered = new Uint8Array(n);
  const cs = cloths.filter(Boolean);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    for (const c of cs) if (c.eval(x, y, z) < -margin) { covered[v] = 1; break; }
  }
  const src = geo.index.array, out = [];
  for (let t = 0; t < src.length; t += 3) {
    if (covered[src[t]] && covered[src[t + 1]] && covered[src[t + 2]]) continue;
    out.push(src[t], src[t + 1], src[t + 2]);
  }
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight', 'color', 'ao']) if (geo.getAttribute(k)) g.setAttribute(k, geo.getAttribute(k));
  g.setIndex(out);
  g.boundingSphere = geo.boundingSphere;
  return g;
}
