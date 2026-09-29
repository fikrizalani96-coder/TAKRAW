// Clip = sorted pose keyframes sampled with a non-uniform cardinal (Hermite) spline.
// Clips are described by lightweight registry entries and built lazily, so the catalogue can
// hold well over a thousand entries at negligible start-up cost.
import { NCH, newPose } from './pose.js';

export class Clip {
  /**
   * spec: { id, name, cat, tags[], duration, loop, keys:[{t,pose,k?}], events:{}, meta:{} }
   */
  constructor(spec) {
    Object.assign(this, { tags: [], events: {}, meta: {}, loop: false }, spec);
    this.keys.sort((a, b) => a.t - b.t);
    if (!this.duration) this.duration = this.keys[this.keys.length - 1].t;
    const n = this.keys.length;
    this.tang = this.keys.map(() => new Float32Array(NCH));
    for (let i = 0; i < n; i++) {
      const k = this.keys[i];
      const scale = k.k ?? 1;
      let ip = i - 1, inx = i + 1, tp, tn, pp, pn;
      if (this.loop) {
        const prev = (i - 1 + n) % n, next = (i + 1) % n;
        pp = this.keys[prev].pose; pn = this.keys[next].pose;
        tp = this.keys[prev].t - (i === 0 ? this.duration : 0);
        tn = this.keys[next].t + (i === n - 1 ? this.duration : 0);
      } else {
        ip = Math.max(0, i - 1); inx = Math.min(n - 1, i + 1);
        pp = this.keys[ip].pose; pn = this.keys[inx].pose; tp = this.keys[ip].t; tn = this.keys[inx].t;
      }
      const dt = tn - tp;
      const tg = this.tang[i];
      if (dt > 1e-6) for (let c = 0; c < NCH; c++) tg[c] = scale * (pn[c] - pp[c]) / dt;
    }
  }

  /** Sample pose at time t (seconds) into out. Looping clips wrap; others clamp. */
  sample(t, out = newPose()) {
    const keys = this.keys, n = keys.length;
    if (n === 1) { out.set(keys[0].pose); return out; }
    let tt = t;
    if (this.loop) { tt = ((t % this.duration) + this.duration) % this.duration; }
    else if (tt <= keys[0].t) { out.set(keys[0].pose); return out; }
    else if (tt >= keys[n - 1].t) { out.set(keys[n - 1].pose); return out; }
    // find segment
    let i = 0;
    if (this.loop && tt >= keys[n - 1].t) i = n - 1;
    else { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].t <= tt) lo = mid; else hi = mid; } i = lo; }
    const j = (i + 1) % n;
    const t0 = keys[i].t;
    const t1 = (j === 0 && this.loop) ? this.duration : keys[j].t;
    const h = t1 - t0;
    const u = h > 1e-6 ? (tt - t0) / h : 0;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const p0 = keys[i].pose, p1 = keys[j].pose, m0 = this.tang[i], m1 = this.tang[j];
    for (let c = 0; c < NCH; c++) out[c] = h00 * p0[c] + h10 * h * m0[c] + h01 * p1[c] + h11 * h * m1[c];
    return out;
  }
}

// ---------------- registry ----------------
const REG = new Map();
export function register(entry) {
  // entry: {id, name, cat, sub, tags, dur, loop, build: () => spec}
  if (REG.has(entry.id)) throw new Error('duplicate clip id ' + entry.id);
  REG.set(entry.id, entry);
  return entry;
}
export function getClip(id) {
  const e = REG.get(id);
  if (!e) return null;
  if (!e._clip) e._clip = new Clip({ id: e.id, name: e.name, cat: e.cat, tags: e.tags || [], ...e.build() });
  return e._clip;
}
export const clipCount = () => REG.size;
export const allEntries = () => [...REG.values()];
export function categoryCounts() {
  const out = {};
  for (const e of REG.values()) out[e.cat] = (out[e.cat] || 0) + 1;
  return out;
}
export function findEntries(pred) { const r = []; for (const e of REG.values()) if (pred(e)) r.push(e); return r; }
export function hasClip(id) { return REG.has(id); }
