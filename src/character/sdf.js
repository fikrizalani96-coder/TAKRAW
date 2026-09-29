// Signed-distance-field primitives used to sculpt humans. Each primitive lives in the local
// frame of a bone (so bodies automatically follow skeleton proportions) and is evaluated in
// bind-pose world space via the bone's inverse bind matrix.
//
// Inigo Quilez style distance functions; smooth union gives organic muscle blending.
import * as THREE from 'three';

const BIG = 1e3;

export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}
export function smax(a, b, k) {
  if (k <= 0) return a > b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a > b ? a : b) + h * h * k * 0.25;
}

function roundConeFn(ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (px, py, pz) => {
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const y = pax * bax + pay * bay + paz * baz;
    const z = y - l2;
    const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = y * y * l2;
    const z2 = z * z * l2;
    const k = (rr < 0 ? -1 : 1) * rr * rr * x2;
    if ((z < 0 ? -1 : 1) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if ((y < 0 ? -1 : 1) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  };
}

function ellipsoidFn(cx, cy, cz, rx, ry, rz) {
  const irx = 1 / rx, iry = 1 / ry, irz = 1 / rz;
  const irx2 = irx * irx, iry2 = iry * iry, irz2 = irz * irz;
  return (px, py, pz) => {
    const x = px - cx, y = py - cy, z = pz - cz;
    const k0 = Math.sqrt(x * x * irx2 + y * y * iry2 + z * z * irz2);
    const k1 = Math.sqrt(x * x * irx2 * irx2 + y * y * iry2 * iry2 + z * z * irz2 * irz2);
    if (k1 < 1e-9) return -Math.min(rx, ry, rz);
    return k0 * (k0 - 1) / k1;
  };
}

function boxFn(cx, cy, cz, hx, hy, hz, r) {
  return (px, py, pz) => {
    const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

/** A frame binds a bone's bind-pose world matrix and lets primitives be authored in bone space. */
export class Frame {
  constructor(bone) {
    this.bone = bone;
    this.m = bone.matrixWorld.clone();
    this.inv = this.m.clone().invert();
  }
  toWorld(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.m); }
}

const _v = new THREE.Vector3();

/** Wrap a local-space distance function into a world-space primitive with AABB and skinning info. */
function makePrim(frame, localFn, cornersLocal, opts) {
  const e = frame.inv.elements;
  const e0 = e[0], e1 = e[1], e2 = e[2], e4 = e[4], e5 = e[5], e6 = e[6], e8 = e[8], e9 = e[9], e10 = e[10], e12 = e[12], e13 = e[13], e14 = e[14];
  const d = (x, y, z) => localFn(e0 * x + e4 * y + e8 * z + e12, e1 * x + e5 * y + e9 * z + e13, e2 * x + e6 * y + e10 * z + e14);
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const c of cornersLocal) {
    _v.set(c[0], c[1], c[2]).applyMatrix4(frame.m);
    min.min(_v); max.max(_v);
  }
  const k = opts.k ?? 0.012;
  const pad = (opts.pad ?? 0) + k;
  min.addScalar(-pad); max.addScalar(pad);
  return {
    d, min, max, k,
    op: opts.op || 'add',
    skin: opts.skin || [],
    color: opts.color || null,      // optional colour tag (e.g. 'lip', 'brow') for vertex colouring
    tag: opts.tag || null,
    bone: frame.bone.name,
  };
}

const cornersOfBox = (c, h) => {
  const out = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push([c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]]);
  return out;
};

export const Prims = {
  /** Cone-capsule between local points a and b with radii r1, r2 (optionally squashed in x/z). */
  cone(frame, a, b, r1, r2, opts = {}) {
    const sx = opts.sx ?? 1, sz = opts.sz ?? 1;
    // Anisotropic squash: evaluate in scaled space, then rescale the distance conservatively.
    if (sx === 1 && sz === 1) {
      const fn = roundConeFn(a[0], a[1], a[2], b[0], b[1], b[2], r1, r2);
      const rm = Math.max(r1, r2);
      return makePrim(frame, fn, [[a[0] - rm, a[1] - rm, a[2] - rm], [a[0] + rm, a[1] + rm, a[2] + rm], [b[0] - rm, b[1] - rm, b[2] - rm], [b[0] + rm, b[1] + rm, b[2] + rm]], opts);
    }
    const fn0 = roundConeFn(a[0] / sx, a[1], a[2] / sz, b[0] / sx, b[1], b[2] / sz, r1, r2);
    const sm = Math.min(sx, sz);
    const fn = (x, y, z) => fn0(x / sx, y, z / sz) * sm;
    const rm = Math.max(r1, r2);
    const rx = rm * sx, rz = rm * sz;
    return makePrim(frame, fn, [[a[0] - rx, a[1] - rm, a[2] - rz], [a[0] + rx, a[1] + rm, a[2] + rz], [b[0] - rx, b[1] - rm, b[2] - rz], [b[0] + rx, b[1] + rm, b[2] + rz]], opts);
  },
  ellipsoid(frame, c, r, opts = {}) {
    const fn = ellipsoidFn(c[0], c[1], c[2], r[0], r[1], r[2]);
    return makePrim(frame, fn, cornersOfBox(c, r), opts);
  },
  box(frame, c, h, round, opts = {}) {
    const fn = boxFn(c[0], c[1], c[2], h[0], h[1], h[2], round);
    return makePrim(frame, fn, cornersOfBox(c, h), opts);
  },
  sphere(frame, c, r, opts = {}) {
    return Prims.ellipsoid(frame, c, [r, r, r], opts);
  },
};

/** Collection of primitives evaluated as a smooth-union with smooth subtractions. */
export class SDFScene {
  constructor() { this.prims = []; }
  add(p) { this.prims.push(p); return p; }
  evalList(list, x, y, z) {
    let d = BIG;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.op === 'add') d = smin(d, p.d(x, y, z), p.k);
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.op === 'sub') d = smax(d, -p.d(x, y, z), p.k);
    }
    return d;
  }
  eval(x, y, z) { return this.evalList(this.prims, x, y, z); }
  bounds() {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of this.prims) if (p.op === 'add') { min.min(p.min); max.max(p.max); }
    return { min, max };
  }
}
export { BIG };
