// Clothing as offset shells of the body SDF, clipped by garment boundaries.
// Jersey, shorts, socks, knee/wrist bands, and shoes, all skinned with the same weights logic.
import * as THREE from 'three';
import { Prims, SDFScene, smin, BIG } from './sdf.js';

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** A cloth scene = groups of body primitives, each offset outward and clipped. */
export class ClothScene {
  constructor(bodyScene, groups) {
    this.groups = groups.map((g) => ({ k: 0.008, ...g, tagSet: new Set(g.tags) }));
    const tags = new Set(); this.groups.forEach((g) => g.tags.forEach((t) => tags.add(t)));
    const pad = Math.max(...this.groups.map((g) => g.maxOff ?? 0.03));
    this.prims = [];
    for (const p of bodyScene.prims) {
      if (p.op !== 'add' || !tags.has(p.tag)) continue;
      this.prims.push({ ...p, min: p.min.clone().addScalar(-pad), max: p.max.clone().addScalar(pad) });
    }
  }
  evalList(list, x, y, z) {
    let out = BIG;
    for (const g of this.groups) {
      let d = BIG, any = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (g.tagSet.has(p.tag)) { d = smin(d, p.d(x, y, z), p.k); any = true; }
      }
      if (!any) continue;
      d = Math.max(d - g.off(x, y, z), g.clip(x, y, z));
      out = smin(out, d, g.k);
    }
    return out;
  }
  eval(x, y, z) { return this.evalList(this.prims, x, y, z); }
  bounds() {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of this.prims) { min.min(p.min); max.max(p.max); }
    return { min, max };
  }
}

function localFn(frame) {
  const e = frame.inv.elements;
  return (x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
}

export function jerseyScene(rig, bind, body, opt = {}) {
  const K = rig.dims.scale;
  const pelvisY = rig.bones.pelvis.matrixWorld.elements[13];
  const hemJ = opt.hem ?? (pelvisY - 0.030 * K);
  const sleeveLen = (opt.sleeve ?? 0.50) * 0.31 * K * rig.dims.arm;
  const waistLoose = opt.waistLoose ?? 0.010;
  const neckY = new THREE.Vector3().setFromMatrixPosition(rig.bones.neck_01.matrixWorld).y;
  const loose = opt.loose ?? 1;
  const groups = [];
  const neckEll = (x, y, z) => {
    // oval neck opening, lower at the front (crew/round neck)
    const cx = 0, cy = neckY + 0.015 * K, cz = 0.040 * K;
    const dx = x / (0.070 * K), dy = (y - cy) / (0.062 * K), dz = (z - cz) / (0.115 * K);
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - 1;
  };
  groups.push({
    tags: ['torso', 'pelvis'], maxOff: 0.03,
    off: (x, y) => (0.011 + waistLoose * (1 - sstep(pelvisY, neckY - 0.25, y))) * loose,
    clip: (x, y, z) => Math.max(hemJ - y, -neckEll(x, y, z) * 0.06),
    k: 0.006,
  });
  for (const [sd] of [['_l'], ['_r']]) {
    const lf = localFn(bind.frames['upperarm' + sd]);
    groups.push({
      tags: ['uarm' + sd], maxOff: 0.03,
      off: (x, y, z) => (0.0085 + 0.0045 * sstep(-sleeveLen * 0.4, -sleeveLen, lf(x, y, z)[1])) * loose,
      clip: (x, y, z) => -sleeveLen - lf(x, y, z)[1],
      k: 0.006,
    });
  }
  const cs = new ClothScene(body, groups);
  Object.assign(cs, { sleeveLen, neckEll, hemJ, neckY });
  return cs;
}

export function shortsScene(rig, bind, body, opt = {}) {
  const K = rig.dims.scale;
  const pelvisY = rig.bones.pelvis.matrixWorld.elements[13];
  const waist = pelvisY + 0.045 * K;
  const hem = opt.hem ?? 0.535 * K * rig.dims.leg;
  const baggy = opt.baggy ?? 1;
  const cs = new ClothScene(body, [{
    tags: ['pelvis', 'glute_l', 'glute_r', 'thigh_l', 'thigh_r'], maxOff: 0.04,
    off: (x, y) => lerp(0.030, 0.008, sstep(hem, waist, y)) * baggy + 0.004,
    clip: (x, y) => Math.max(y - waist, hem - y),
    k: 0.02,
  }]);
  Object.assign(cs, { waist, hem });
  return cs;
}

export function socksScene(rig, bind, body, opt = {}) {
  const K = rig.dims.scale;
  const top = opt.top ?? 0.28 * K * rig.dims.leg;
  const bottom = 0.075 * K;
  return new ClothScene(body, [{
    tags: ['calf_l', 'calf_r', 'foot_l', 'foot_r'], maxOff: 0.01,
    off: () => 0.0045,
    clip: (x, y) => Math.max(y - top, bottom - y),
    k: 0.004,
  }]);
}

/** Knee guard / wrist band accessories (thin sleeves around a limb section). */
export function bandScene(rig, bind, body, kind) {
  const K = rig.dims.scale;
  if (kind === 'knee') {
    const ky = new THREE.Vector3().setFromMatrixPosition(rig.bones.calf_l.matrixWorld).y;
    return new ClothScene(body, [{
      tags: ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'], maxOff: 0.02,
      off: () => 0.008,
      clip: (x, y) => Math.abs(y - ky) - 0.048 * K,
      k: 0.004,
    }]);
  }
  // wristband (both wrists)
  const groups = [];
  for (const sd of ['_l', '_r']) {
    const lf = localFn(bind.frames['lowerarm' + sd]);
    const fa = 0.26 * K * rig.dims.arm;
    groups.push({
      tags: ['farm' + sd], maxOff: 0.02, off: () => 0.0055,
      clip: (x, y, z) => { const ly = lf(x, y, z)[1]; return Math.max(-fa * 0.80 - ly, ly + fa * 0.93); }, k: 0.003,
    });
  }
  return new ClothScene(body, groups);
}

/** Athletic shoe / boot for the sepak takraw (thin sole, cushioned upper, ankle collar). */
export function shoeScene(rig, bind, sd) {
  const K = rig.dims.scale;
  const F = (n) => bind.frames[n + sd];
  const sc = new SDFScene();
  const SK = ['foot' + sd, 'ball' + sd, 'calf_twist_02' + sd, 'toe_big' + sd, 'toe_small' + sd];
  const add = (p) => sc.add(p);
  // sole
  add(Prims.box(F('foot'), [0, -0.0715 * K, 0.058 * K], [0.0445 * K, 0.0105 * K, 0.128 * K], 0.010 * K, { k: 0.008, skin: SK, tag: 'sole' }));
  // upper
  add(Prims.ellipsoid(F('foot'), [0, -0.040 * K, 0.052 * K], [0.0455 * K, 0.043 * K, 0.118 * K], { k: 0.016, skin: SK, tag: 'upper' }));
  add(Prims.ellipsoid(F('foot'), [0, -0.050 * K, 0.135 * K], [0.048 * K, 0.031 * K, 0.058 * K], { k: 0.016, skin: SK, tag: 'upper' }));
  add(Prims.ellipsoid(F('foot'), [0, -0.036 * K, -0.030 * K], [0.041 * K, 0.046 * K, 0.052 * K], { k: 0.016, skin: SK, tag: 'upper' }));
  // ankle collar (padded)
  add(Prims.cone(F('foot'), [0, 0.030 * K, -0.005 * K], [0, -0.010 * K, 0], 0.0405 * K, 0.0455 * K, { k: 0.012, skin: SK, tag: 'collar' }));
  // tongue / laces ridge
  add(Prims.ellipsoid(F('foot'), [0, -0.006 * K, 0.052 * K], [0.017 * K, 0.010 * K, 0.058 * K], { k: 0.008, skin: SK, tag: 'lace' }));
  return sc;
}

// ---------- decals ----------
/**
 * Extract a decal patch from a skinned garment geometry: triangles whose centroid lies in `box`
 * and whose normal satisfies `nPred`. UVs come from `uvOf(x,y,z)`; vertices are nudged out along
 * normals to avoid z-fighting. Skin data is copied so the decal deforms with the garment.
 */
export function extractDecal(geo, box, nPred, uvOf, lift = 0.0009) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const idx = geo.index.array;
  const P = [], N = [], SI = [], SW = [], UV = [], I = [];
  const map = new Map();
  const vtx = (v) => {
    let m = map.get(v);
    if (m !== undefined) return m;
    m = P.length / 3; map.set(v, m);
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);
    P.push(x + nx * lift, y + ny * lift, z + nz * lift); N.push(nx, ny, nz);
    SI.push(si.getX(v), si.getY(v), si.getZ(v), si.getW(v)); SW.push(sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v));
    const uv = uvOf(x, y, z, nx, ny, nz); UV.push(uv[0], uv[1]);
    return m;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (cx < box.min.x || cx > box.max.x || cy < box.min.y || cy > box.max.y || cz < box.min.z || cz > box.max.z) continue;
    const nx = (nor.getX(a) + nor.getX(b) + nor.getX(c)) / 3, ny = (nor.getY(a) + nor.getY(b) + nor.getY(c)) / 3, nz = (nor.getZ(a) + nor.getZ(b) + nor.getZ(c)) / 3;
    if (!nPred(nx, ny, nz)) continue;
    I.push(vtx(a), vtx(b), vtx(c));
  }
  if (!I.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}
