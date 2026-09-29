// Sparse surface-nets mesher for SDFScene. Only blocks near primitives are sampled, so a full
// human at ~7 mm resolution meshes in a fraction of a second. Produces smooth positions,
// SDF-gradient normals, baked ambient occlusion and skin weights.
import * as THREE from 'three';
import { BIG } from './sdf.js';

const B = 8; // block edge in cells

function overlaps(p, x0, y0, z0, x1, y1, z1) {
  return !(p.max.x < x0 || p.min.x > x1 || p.max.y < y0 || p.min.y > y1 || p.max.z < z0 || p.min.z > z1);
}

/**
 * @param {SDFScene} sc
 * @param {{min:THREE.Vector3,max:THREE.Vector3}} bounds
 * @param {number} h cell size
 * @param {{clip?:(x,y,z)=>number}} opts optional extra field intersected with the scene (max)
 */
export function meshScene(sc, bounds, h, opts = {}) {
  const clip = opts.clip || null;
  const min = bounds.min, max = bounds.max;
  const nx = Math.ceil((max.x - min.x) / h) + 2, ny = Math.ceil((max.y - min.y) / h) + 2, nz = Math.ceil((max.z - min.z) / h) + 2;
  const val = new Float32Array(nx * ny * nz).fill(BIG);
  const sx = 1, sy = nx, sz = nx * ny;
  const bnx = Math.ceil((nx - 1) / B), bny = Math.ceil((ny - 1) / B), bnz = Math.ceil((nz - 1) / B);
  const blockNear = new Array(bnx * bny * bnz).fill(null);
  const blockWide = new Array(bnx * bny * bnz).fill(null);
  const active = [];
  const prims = sc.prims;
  const wideExtra = opts.wide ?? 0.10;

  for (let bz = 0; bz < bnz; bz++) for (let by = 0; by < bny; by++) for (let bx = 0; bx < bnx; bx++) {
    const x0 = min.x + bx * B * h, y0 = min.y + by * B * h, z0 = min.z + bz * B * h;
    const x1 = x0 + B * h, y1 = y0 + B * h, z1 = z0 + B * h;
    const pad = 2 * h;
    const near = [];
    for (const p of prims) if (overlaps(p, x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad)) near.push(p);
    if (!near.length) continue;
    const bi = bx + by * bnx + bz * bnx * bny;
    blockNear[bi] = near;
    active.push(bi);
    const i0 = bx * B, j0 = by * B, k0 = bz * B;
    for (let k = k0; k <= Math.min(k0 + B, nz - 1); k++) for (let j = j0; j <= Math.min(j0 + B, ny - 1); j++) for (let i = i0; i <= Math.min(i0 + B, nx - 1); i++) {
      const x = min.x + i * h, y = min.y + j * h, z = min.z + k * h;
      let d = sc.evalList(near, x, y, z);
      if (clip) d = Math.max(d, clip(x, y, z));
      val[i * sx + j * sy + k * sz] = d;
    }
  }

  // Vertex generation
  const cellIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cnx = nx - 1, cny = ny - 1;
  const pos = [], cellBlock = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (const bi of active) {
    const bx = bi % bnx, by = Math.floor(bi / bnx) % bny, bz = Math.floor(bi / (bnx * bny));
    const i0 = bx * B, j0 = by * B, k0 = bz * B;
    for (let k = k0; k < Math.min(k0 + B, nz - 1); k++) for (let j = j0; j < Math.min(j0 + B, ny - 1); j++) for (let i = i0; i < Math.min(i0 + B, nx - 1); i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        const v = val[(i + corner[c][0]) * sx + (j + corner[c][1]) * sy + (k + corner[c][2]) * sz];
        cv[c] = v;
        if (v < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let cnt = 0, px = 0, py = 0, pz = 0;
      for (let e = 0; e < 12; e++) {
        const a = edges[e][0], b = edges[e][1];
        if ((cv[a] < 0) === (cv[b] < 0)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        px += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
        py += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
        pz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
        cnt++;
      }
      const vi = pos.length / 3;
      pos.push(min.x + (i + px / cnt) * h, min.y + (j + py / cnt) * h, min.z + (k + pz / cnt) * h);
      cellBlock.push(bi);
      cellIdx[i + j * cnx + k * cnx * cny] = vi;
    }
  }

  // Faces (one quad per sign-changing grid edge)
  const idx = [];
  const ci = (i, j, k) => cellIdx[i + j * cnx + k * cnx * cny];
  for (let vi = 0; vi < cellBlock.length; vi++) { /* placeholder to keep structure explicit */ }
  for (const bi of active) {
    const bx = bi % bnx, by = Math.floor(bi / bnx) % bny, bz = Math.floor(bi / (bnx * bny));
    const i0 = bx * B, j0 = by * B, k0 = bz * B;
    for (let k = k0; k < Math.min(k0 + B, nz - 1); k++) for (let j = j0; j < Math.min(j0 + B, ny - 1); j++) for (let i = i0; i < Math.min(i0 + B, nx - 1); i++) {
      const v0 = val[i * sx + j * sy + k * sz];
      const in0 = v0 < 0;
      // x edge (i,j,k)-(i+1,j,k)
      if (j > 0 && k > 0) {
        const v1 = val[(i + 1) * sx + j * sy + k * sz];
        if (in0 !== (v1 < 0)) {
          const a = ci(i, j - 1, k - 1), b = ci(i, j, k - 1), c = ci(i, j, k), d = ci(i, j - 1, k);
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) { if (in0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
        }
      }
      if (i > 0 && k > 0) {
        const v1 = val[i * sx + (j + 1) * sy + k * sz];
        if (in0 !== (v1 < 0)) {
          const a = ci(i - 1, j, k - 1), b = ci(i, j, k - 1), c = ci(i, j, k), d = ci(i - 1, j, k);
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) { if (in0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); }
        }
      }
      if (i > 0 && j > 0) {
        const v1 = val[i * sx + j * sy + (k + 1) * sz];
        if (in0 !== (v1 < 0)) {
          const a = ci(i - 1, j - 1, k), b = ci(i, j - 1, k), c = ci(i, j, k), d = ci(i - 1, j, k);
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) { if (in0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
        }
      }
    }
  }

  // Wide-lists for AO / skinning are built lazily per block.
  const wide = (bi) => {
    let w = blockWide[bi];
    if (w) return w;
    const bx = bi % bnx, by = Math.floor(bi / bnx) % bny, bz = Math.floor(bi / (bnx * bny));
    const x0 = min.x + bx * B * h, y0 = min.y + by * B * h, z0 = min.z + bz * B * h;
    w = [];
    for (const p of prims) if (overlaps(p, x0 - wideExtra, y0 - wideExtra, z0 - wideExtra, x0 + B * h + wideExtra, y0 + B * h + wideExtra, z0 + B * h + wideExtra)) w.push(p);
    blockWide[bi] = w;
    return w;
  };

  const nV = pos.length / 3;
  const positions = Float32Array.from(pos);
  const normals = new Float32Array(nV * 3);
  const eps = h * 0.6;
  for (let v = 0; v < nV; v++) {
    const list = blockNear[cellBlock[v]];
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    const f = (a, b, c) => { let d = sc.evalList(list, a, b, c); if (clip) d = Math.max(d, clip(a, b, c)); return d; };
    let nxg = f(x + eps, y, z) - f(x - eps, y, z);
    let nyg = f(x, y + eps, z) - f(x, y - eps, z);
    let nzg = f(x, y, z + eps) - f(x, y, z - eps);
    const l = Math.hypot(nxg, nyg, nzg) || 1;
    normals[v * 3] = nxg / l; normals[v * 3 + 1] = nyg / l; normals[v * 3 + 2] = nzg / l;
    // project vertex onto the surface (one Newton step) for crisper silhouettes
    const d0 = f(x, y, z);
    const step = Math.max(-h * 0.5, Math.min(h * 0.5, d0));
    positions[v * 3] = x - normals[v * 3] * step;
    positions[v * 3 + 1] = y - normals[v * 3 + 1] * step;
    positions[v * 3 + 2] = z - normals[v * 3 + 2] * step;
  }
  return { positions, normals, indices: Uint32Array.from(idx), cellBlock, wide, nV };
}

/** Ambient occlusion from the SDF along the normal (cheap, baked into vertex colour). */
export function bakeAO(sc, mesh, strength = 1.0, radius = 0.03) {
  const ao = new Float32Array(mesh.nV);
  for (let v = 0; v < mesh.nV; v++) {
    const list = mesh.wide(mesh.cellBlock[v]);
    const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
    const nx = mesh.normals[v * 3], ny = mesh.normals[v * 3 + 1], nz = mesh.normals[v * 3 + 2];
    let occ = 0, w = 1;
    for (let i = 1; i <= 4; i++) {
      const s = radius * i / 4;
      const d = sc.evalList(list, x + nx * s, y + ny * s, z + nz * s);
      occ += (s - d) * w;
      w *= 0.65;
    }
    ao[v] = Math.max(0, Math.min(1, 1 - occ / radius * strength * 0.9));
  }
  return ao;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
export function distToSegment(px, py, pz, a, b) {
  _a.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const l2 = _a.lengthSq();
  let t = l2 > 1e-12 ? ((px - a.x) * _a.x + (py - a.y) * _a.y + (pz - a.z) * _a.z) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (a.x + _a.x * t), dy = py - (a.y + _a.y * t), dz = pz - (a.z + _a.z * t);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute 4-bone skin weights per vertex from primitive skin lists.
 * segs: name -> {a:Vector3,b:Vector3}; boneIndex: name -> skeleton index.
 */
export function computeSkin(mesh, segs, boneIndex, kw = 0.014, exponent = 2.0) {
  const skinIndex = new Uint16Array(mesh.nV * 4);
  const skinWeight = new Float32Array(mesh.nV * 4);
  const acc = new Map();
  for (let v = 0; v < mesh.nV; v++) {
    const list = mesh.wide(mesh.cellBlock[v]);
    const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
    let dmin = 1e9;
    const ds = [];
    for (const p of list) {
      if (p.op !== 'add') { ds.push(1e9); continue; }
      const d = p.d(x, y, z);
      ds.push(d);
      if (d < dmin) dmin = d;
    }
    acc.clear();
    let li = 0;
    for (const p of list) {
      const d = ds[li++];
      if (p.op !== 'add') continue;
      const wp = Math.exp(-(d - dmin) / kw);
      if (wp < 0.03) continue;
      // bone weights inside this primitive
      let sum = 0;
      const tmp = [];
      for (const bn of p.skin) {
        const seg = segs[bn];
        if (!seg) continue;
        const dist = distToSegment(x, y, z, seg.a, seg.b);
        const w = 1 / Math.pow(dist * dist + 1e-5, exponent);
        tmp.push([bn, w]); sum += w;
      }
      if (!sum) continue;
      for (const [bn, w] of tmp) acc.set(bn, (acc.get(bn) || 0) + wp * w / sum);
    }
    const arr = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tot = 0; for (const e of arr) tot += e[1];
    if (!tot) { arr.push(['pelvis', 1]); tot = 1; }
    for (let i = 0; i < 4; i++) {
      if (i < arr.length) { skinIndex[v * 4 + i] = boneIndex[arr[i][0]]; skinWeight[v * 4 + i] = arr[i][1] / tot; }
    }
  }
  return { skinIndex, skinWeight };
}
