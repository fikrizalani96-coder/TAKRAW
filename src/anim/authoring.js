// Authoring kit: base stances, reach solvers (leg/arm), key builder and small utilities used by
// every clip family. Poses use degrees at authoring time (see P()).
import * as THREE from 'three';
import { P, CH, STAND_POSE, copyPose, mirrorPose } from './pose.js';

export const D2R = Math.PI / 180;
export const LEN = { thigh: 0.43, shank: 0.41, foot: 0.10, ua: 0.31, fa: 0.26, hand: 0.09, hipX: 0.088, hipY: -0.05, pelvisY: 0.97, shoulderX: 0.19, shoulderUp: 0.455 };

// Handy relaxed hand shapes (finger curls)
export const HAND = {
  relaxed: { h_th: 0.25, h_ix: 0.32, h_md: 0.38, h_rg: 0.42, h_pk: 0.46, h_sp: 0.10 },
  open: { h_th: 0.05, h_ix: 0.02, h_md: 0.02, h_rg: 0.03, h_pk: 0.04, h_sp: 0.85 },
  fist: { h_th: 0.75, h_ix: 1.0, h_md: 1.0, h_rg: 1.0, h_pk: 1.0, h_sp: 0 },
  flat: { h_th: 0.10, h_ix: 0.05, h_md: 0.05, h_rg: 0.05, h_pk: 0.06, h_sp: 0.05 },
  point: { h_th: 0.60, h_ix: 0.0, h_md: 1.0, h_rg: 1.0, h_pk: 1.0, h_sp: 0 },
  cup: { h_th: 0.30, h_ix: 0.45, h_md: 0.50, h_rg: 0.52, h_pk: 0.55, h_sp: 0.30 },
  grip: { h_th: 0.55, h_ix: 0.55, h_md: 0.58, h_rg: 0.60, h_pk: 0.62, h_sp: 0.25 },
};
export const handPose = (shape) => ({ ...shape });

/** Athletic ready stance (knees bent, weight forward, hands up in front). */
export function flatFeet(p) {
  for (const s of ['L', 'R']) {
    const hf = p[CH['hp_f_' + s]], kf = p[CH['kn_f_' + s]];
    p[CH['an_p_' + s]] = hf - kf - p[CH.pitch];
  }
  return p;
}
export const READY = flatFeet(P({
  hz: 0.02, spine: [14], chest: [4], neck: [-12],
  LR: { hp_f: 34, hp_a: 9, hp_r: 4, kn_f: 58, cl_e: 2, sh_f: 32, sh_a: 20, el_f: 78, fa_p: 42, wr_f: 8, ...HAND.relaxed },
}, STAND_POSE));
export const STANCE_LOW = flatFeet(P({
  hz: 0.05, spine: [24], chest: [6], neck: [-16],
  LR: { hp_f: 62, hp_a: 12, hp_r: 6, kn_f: 96, sh_f: 42, sh_a: 24, el_f: 72, fa_p: 40, ...HAND.relaxed },
}, STAND_POSE));
export const STANDING = flatFeet(P({ LR: { sh_a: 9, sh_f: 3, el_f: 14, fa_p: 14, hp_a: 3, kn_f: 5, ...HAND.relaxed } }, STAND_POSE));

// -------------- geometry helpers --------------
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function pelvisFrame(pose) {
  const p = new THREE.Vector3(pose[CH.hx], LEN.pelvisY + pose[CH.hy], pose[CH.hz]);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose[CH.yaw]);
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose[CH.pitch]);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose[CH.roll]);
  const q = qy.multiply(qx).multiply(qz);
  return { p, q };
}
export function torsoFrame(pose) {
  const pf = pelvisFrame(pose);
  const f = pose[CH.spine_f] + pose[CH.chest_f], l = pose[CH.spine_l] + pose[CH.chest_l], t = pose[CH.spine_t] + pose[CH.chest_t];
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), f);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -l);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t);
  const q = pf.q.clone().multiply(qx).multiply(qz).multiply(qy);
  return { p: pf.p, q };
}

function solveTwoLink(v, l1, l2, pole) {
  let d = v.length();
  const dc = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-4);
  const u = v.clone().normalize();
  const cosA = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const perp = pole.clone().addScaledVector(u, -pole.dot(u));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(u, -u.z);
  perp.normalize();
  const t = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
  const knee = t.clone().multiplyScalar(l1);
  const sd = v.clone().normalize().multiplyScalar(dc).sub(knee).normalize();
  const flex = Math.acos(Math.min(1, Math.max(-1, t.dot(sd))));
  return { t, flex, reach: d };
}

/**
 * Solve a leg to reach T (ankle target, root frame, metres) and write hip/knee channels into pose.
 * pole: knee direction in pelvis frame. Returns {reach}.
 */
export function solveLeg(pose, side, T, opt = {}) {
  const s = side === 'L' ? 1 : -1;
  const pf = pelvisFrame(pose);
  const hip = new THREE.Vector3(s * LEN.hipX, LEN.hipY, 0).applyQuaternion(pf.q).add(pf.p);
  const v = T.clone().sub(hip).applyQuaternion(pf.q.clone().invert());
  const pole = opt.pole ? new THREE.Vector3(...opt.pole) : new THREE.Vector3(s * 0.25, 0, 1);
  const r = solveTwoLink(v, LEN.thigh, opt.shank ?? LEN.shank, pole);
  const t = r.t;
  const th = Math.asin(Math.max(-1, Math.min(1, t.x)));
  pose[CH['hp_a_' + side]] = clampN(s * th, -40 * D2R, 105 * D2R);
  pose[CH['hp_f_' + side]] = clampN(Math.atan2(t.z, -t.y), -50 * D2R, 160 * D2R);
  pose[CH['kn_f_' + side]] = clampN(r.flex, 0, 150 * D2R);
  return { reach: r.reach };
}

/** Solve an arm so the wrist reaches T (root frame). Writes shoulder/elbow channels. */
export function solveArm(pose, side, T, opt = {}) {
  const s = side === 'L' ? 1 : -1;
  const tf = torsoFrame(pose);
  const sh = new THREE.Vector3(s * LEN.shoulderX, LEN.shoulderUp, 0).applyQuaternion(tf.q).add(tf.p);
  const v = T.clone().sub(sh).applyQuaternion(tf.q.clone().invert());
  const pole = opt.pole ? new THREE.Vector3(...opt.pole) : new THREE.Vector3(s * 0.5, -0.5, -0.6);
  const r = solveTwoLink(v, LEN.ua, LEN.fa + (opt.hand ?? 0), pole);
  const t = r.t;
  const th = Math.asin(Math.max(-1, Math.min(1, t.x)));
  // swing order Rx(-flex)*Rz(abd): t = (sin th, -cos th cos f, cos th sin f)
  pose[CH['sh_a_' + side]] = s * th;
  pose[CH['sh_f_' + side]] = Math.abs(Math.cos(th)) < 1e-3 ? 0 : Math.atan2(t.z, -t.y);
  pose[CH['el_f_' + side]] = r.flex;
  return { reach: r.reach };
}

// -------------- key builder --------------
export class KB {
  constructor(base = READY) { this.base = base; this.keys = []; }
  at(t, desc = {}, o = {}) { this.keys.push({ t, pose: P(desc, o.base ?? this.base), k: o.k }); return this.keys[this.keys.length - 1]; }
  push(t, pose, k) { this.keys.push({ t, pose, k }); return pose; }
  last() { return this.keys[this.keys.length - 1].pose; }
  mirror() { return this.keys.map((k) => ({ t: k.t, pose: mirrorPose(k.pose), k: k.k })); }
}

/** deg helpers */
export const lerpN = (a, b, t) => a + (b - a) * t;
export const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
export const sideSign = (s) => (s === 'L' ? 1 : -1);
export const other = (s) => (s === 'L' ? 'R' : 'L');

/** Put (x,y,z) given in "body frame" into a Vector3. */
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Set the same channel on a list of sides. */
export function setSide(desc, side, obj) { desc[side] = { ...(desc[side] || {}), ...obj }; return desc; }
