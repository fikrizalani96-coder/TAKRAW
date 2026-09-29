// Pose = Float32Array of semantic joint channels (anatomical angles in radians, offsets in metres,
// finger curls / face weights in 0..1). A pose drives every one of the ~110 bones through
// `applyPose`, distributing twist across twist bones and bend across the spine chain, so a
// 66-number vector describes a complete full-body posture. Poses are cheap to blend, mirror,
// scale and generate procedurally - this is what makes a 1000+ clip catalogue tractable.
import * as THREE from 'three';

const DEG = Math.PI / 180;

// ---------- channel table ----------
export const CHANNELS = [];
export const CH = {};
const ANGULAR = new Set();
const add = (n, angular) => { CH[n] = CHANNELS.length; CHANNELS.push(n); if (angular) ANGULAR.add(CH[n]); };

['hx', 'hy', 'hz'].forEach((n) => add(n, false));
['pitch', 'yaw', 'roll'].forEach((n) => add(n, true));
for (const g of ['spine', 'chest', 'neck', 'head']) for (const a of ['f', 'l', 't']) add(`${g}_${a}`, true);
const ARM = ['cl_e', 'cl_p', 'sh_f', 'sh_a', 'sh_t', 'el_f', 'fa_p', 'wr_f', 'wr_d'];
const HAND = ['h_th', 'h_ix', 'h_md', 'h_rg', 'h_pk', 'h_sp'];
const LEG = ['hp_f', 'hp_a', 'hp_r', 'kn_f', 'an_p', 'an_i', 'to_f'];
for (const s of ['L', 'R']) {
  ARM.forEach((n) => add(`${n}_${s}`, true));
  HAND.forEach((n) => add(`${n}_${s}`, false));
  LEG.forEach((n) => add(`${n}_${s}`, true));
}
['blink', 'jaw', 'smile', 'brow'].forEach((n) => add(n, false));
export const NCH = CHANNELS.length;

// ---------- mirror tables ----------
const MIRROR_INDEX = new Int16Array(NCH);
const MIRROR_SIGN = new Float32Array(NCH).fill(1);
for (let i = 0; i < NCH; i++) {
  const n = CHANNELS[i];
  if (n.endsWith('_L')) MIRROR_INDEX[i] = CH[n.slice(0, -1) + 'R'];
  else if (n.endsWith('_R')) MIRROR_INDEX[i] = CH[n.slice(0, -1) + 'L'];
  else MIRROR_INDEX[i] = i;
}
for (const n of ['hx', 'yaw', 'roll', 'spine_l', 'spine_t', 'chest_l', 'chest_t', 'neck_l', 'neck_t', 'head_l', 'head_t']) MIRROR_SIGN[CH[n]] = -1;

export const newPose = () => new Float32Array(NCH);
export const copyPose = (p) => Float32Array.from(p);
export function mirrorPose(p, out = newPose()) {
  const tmp = Float32Array.from(p);
  for (let i = 0; i < NCH; i++) out[i] = tmp[MIRROR_INDEX[i]] * MIRROR_SIGN[i];
  return out;
}
export function lerpPose(out, a, b, t) { for (let i = 0; i < NCH; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }
export function lerpPoseMasked(out, a, b, t, mask) { for (let i = 0; i < NCH; i++) { const m = t * mask[i]; out[i] = a[i] + (b[i] - a[i]) * m; } return out; }
export function addPose(out, a, b, k = 1) { for (let i = 0; i < NCH; i++) out[i] = a[i] + b[i] * k; return out; }
export function subPose(out, a, b) { for (let i = 0; i < NCH; i++) out[i] = a[i] - b[i]; return out; }
export function scalePoseAbout(out, p, base, k) { for (let i = 0; i < NCH; i++) out[i] = base[i] + (p[i] - base[i]) * k; return out; }

// Catmull-Rom on pose vectors (p0..p3 = keys around segment p1->p2)
export function splinePose(out, p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  for (let i = 0; i < NCH; i++) {
    out[i] = 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  }
  // clamp non-angular weights that must stay in 0..1
  return out;
}

// ---------- masks ----------
function makeMask(pred) { const m = new Float32Array(NCH); for (let i = 0; i < NCH; i++) m[i] = pred(CHANNELS[i]) ? 1 : 0; return m; }
export const MASK = {
  all: makeMask(() => true),
  lower: makeMask((n) => /^(hx|hy|hz|pitch|yaw|roll)$/.test(n) || /^(hp_|kn_|an_|to_)/.test(n)),
  legs: makeMask((n) => /^(hp_|kn_|an_|to_)/.test(n)),
  upper: makeMask((n) => /^(spine_|chest_|neck_|head_|cl_|sh_|el_|fa_|wr_|h_|blink|jaw|smile|brow)/.test(n)),
  arms: makeMask((n) => /^(cl_|sh_|el_|fa_|wr_|h_)/.test(n)),
  armL: makeMask((n) => /^(cl_|sh_|el_|fa_|wr_|h_)/.test(n) && n.endsWith('_L')),
  armR: makeMask((n) => /^(cl_|sh_|el_|fa_|wr_|h_)/.test(n) && n.endsWith('_R')),
  torso: makeMask((n) => /^(spine_|chest_)/.test(n)),
  head: makeMask((n) => /^(neck_|head_|blink|jaw|smile|brow)/.test(n)),
  root: makeMask((n) => /^(hx|hy|hz|pitch|yaw|roll)$/.test(n)),
  face: makeMask((n) => /^(blink|jaw|smile|brow)/.test(n)),
};

// ---------- authoring helper ----------
// P({ hy:-0.2, pitch:10, spine:[f,l,t], chest:[..], neck:[..], head:[..],
//     L:{sh_f:90, el_f:100, ...}, R:{...}, LR:{...}, face:{jaw:.5} }, base)  angles in degrees.
export function P(desc = {}, base = null) {
  const p = base ? Float32Array.from(base) : newPose();
  const set = (name, v) => {
    const i = CH[name];
    if (i === undefined) throw new Error('unknown pose channel ' + name);
    p[i] = ANGULAR.has(i) ? v * DEG : v;
  };
  for (const [k, v] of Object.entries(desc)) {
    if (k === 'spine' || k === 'chest' || k === 'neck' || k === 'head') {
      if (Array.isArray(v)) { if (v[0] !== undefined) set(`${k}_f`, v[0]); if (v[1] !== undefined) set(`${k}_l`, v[1]); if (v[2] !== undefined) set(`${k}_t`, v[2]); }
      else for (const [a, val] of Object.entries(v)) set(`${k}_${a}`, val);
    } else if (k === 'L' || k === 'R' || k === 'LR') {
      for (const [n, val] of Object.entries(v)) {
        if (k === 'LR') { set(`${n}_L`, val); set(`${n}_R`, val); } else set(`${n}_${k}`, val);
      }
    } else if (k === 'face') {
      for (const [n, val] of Object.entries(v)) set(n, val);
    } else set(k, v);
  }
  return p;
}

// ---------- pose -> bones ----------
const _q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const setRX = (q, a) => q.set(Math.sin(a * 0.5), 0, 0, Math.cos(a * 0.5));
const setRY = (q, a) => q.set(0, Math.sin(a * 0.5), 0, Math.cos(a * 0.5));
const setRZ = (q, a) => q.set(0, 0, Math.sin(a * 0.5), Math.cos(a * 0.5));
const A = _q[0], B = _q[1], C = _q[2], D = _q[3];

function out3(dst, qs, qa, qb, qc) { // dst = qa * qb * qc * qStatic-left-multiplied
  dst.copy(qa).multiply(qb).multiply(qc);
  if (qs) dst.premultiply(qs).normalize(); else dst.normalize();
  return dst;
}

export class RigPoser {
  constructor(rig) {
    this.rig = rig;
    this.b = rig.bones;
    this.cache = {};
  }

  // Applies pose channels to bone transforms. Bone local rotation = qStatic * R(pose).
  apply(p, restOnly = false) {
    const b = this.b;
    const g = (n) => p[CH[n]];
    // root motion inside the body (pelvis)
    const pel = b.pelvis;
    pel.position.set(pel.userData.restPos.x + g('hx'), pel.userData.restPos.y + g('hy'), pel.userData.restPos.z + g('hz'));
    setRY(A, g('yaw')); setRX(B, g('pitch')); setRZ(C, g('roll'));
    pel.quaternion.copy(A).multiply(B).multiply(C);

    // spine chain
    this._chain(['spine_01', 'spine_02'], [0.5, 0.5], g('spine_f'), g('spine_l'), g('spine_t'));
    this._chain(['spine_03', 'spine_04', 'spine_05'], [0.3, 0.4, 0.3], g('chest_f'), g('chest_l'), g('chest_t'));
    this._chain(['neck_01', 'neck_02'], [0.5, 0.5], g('neck_f'), g('neck_l'), g('neck_t'));
    this._chain(['head'], [1], g('head_f'), g('head_l'), g('head_t'));

    for (const [sfx, sd, S] of [['_l', 'L', 1], ['_r', 'R', -1]]) this._limbs(p, sfx, sd, S);

    // face
    const blink = g('blink'), jaw = g('jaw'), smile = g('smile'), brow = g('brow');
    setRX(A, jaw * 24 * DEG); b.jaw.quaternion.copy(A);
    for (const [sfx, S] of [['_l', 1], ['_r', -1]]) {
      setRX(A, blink * 40 * DEG); b['eyelid_up' + sfx].quaternion.copy(A);
      setRX(A, -blink * 22 * DEG); b['eyelid_lo' + sfx].quaternion.copy(A);
      const lc = b['lip_corner' + sfx], r = lc.userData.restPos;
      lc.position.set(r.x + S * smile * 0.004, r.y + smile * 0.007 + jaw * 0.002, r.z - smile * 0.002);
      const br = b['brow' + sfx], rb = br.userData.restPos;
      br.position.set(rb.x, rb.y + brow * 0.006, rb.z);
      const ck = b['cheek' + sfx], rc = ck.userData.restPos;
      ck.position.set(rc.x, rc.y + smile * 0.004, rc.z);
    }
    return this;
  }

  _chain(names, w, f, l, t) {
    for (let i = 0; i < names.length; i++) {
      const bone = this.b[names[i]];
      setRX(A, f * w[i]); setRZ(B, -l * w[i]); setRY(C, t * w[i]);
      out3(bone.quaternion, bone.userData.qStatic, A, B, C);
    }
  }

  _limbs(p, sfx, sd, S) {
    const b = this.b;
    const g = (n) => p[CH[`${n}_${sd}`]];
    // clavicle / scapula
    const el = g('cl_e'), pr = g('cl_p');
    setRZ(A, S * el); setRY(B, -S * pr); C.identity();
    out3(b['clavicle' + sfx].quaternion, null, A, B, C);
    setRZ(A, S * el * 0.5); setRY(B, -S * pr * 0.6); out3(b['scapula' + sfx].quaternion, null, A, B, C);

    // shoulder: swing (flex, abduct) on upperarm; twist distributed to twist bones and forearm
    const sf = g('sh_f'), sa = g('sh_a'), st = g('sh_t');
    setRX(A, -sf); setRZ(B, S * sa); C.identity();
    out3(b['upperarm' + sfx].quaternion, null, A, B, C);
    setRY(A, -S * st * 0.33); b['upperarm_twist_01' + sfx].quaternion.copy(A);
    setRY(A, -S * st * 0.66); b['upperarm_twist_02' + sfx].quaternion.copy(A);
    // elbow: twist about humerus then hinge
    setRY(A, -S * st); setRX(B, -g('el_f'));
    b['lowerarm' + sfx].quaternion.copy(A).multiply(B);
    // forearm pronation
    const pron = g('fa_p');
    setRY(A, -S * pron * 0.33); b['lowerarm_twist_01' + sfx].quaternion.copy(A);
    setRY(A, -S * pron * 0.66); b['lowerarm_twist_02' + sfx].quaternion.copy(A);
    // wrist
    setRY(A, -S * pron); setRX(B, -g('wr_f')); setRZ(C, S * g('wr_d'));
    b['hand' + sfx].quaternion.copy(A).multiply(B).multiply(C);

    // hand shape
    const sp = g('h_sp');
    const fingers = [['index', 'h_ix', 1], ['middle', 'h_md', 0.25], ['ring', 'h_rg', -0.5], ['pinky', 'h_pk', -1]];
    for (const [f, ch, d] of fingers) {
      const cu = g(ch);
      setRZ(A, -S * cu * 4 * DEG); b[`${f}_metacarpal${sfx}`].quaternion.copy(A);
      setRX(A, -d * sp * 13 * DEG); setRZ(B, -S * (cu * 82 * DEG + 4 * DEG)); b[`${f}_01${sfx}`].quaternion.copy(A).multiply(B);
      setRZ(A, -S * (cu * 98 * DEG + 5 * DEG)); b[`${f}_02${sfx}`].quaternion.copy(A);
      setRZ(A, -S * cu * 62 * DEG); b[`${f}_03${sfx}`].quaternion.copy(A);
    }
    const th = g('h_th');
    for (const [nm, ang] of [['thumb_01', 30], ['thumb_02', 50], ['thumb_03', 62]]) {
      const bone = b[nm + sfx];
      setRZ(A, -S * th * ang * DEG); setRX(B, S * sp * 8 * DEG * (nm === 'thumb_01' ? 1 : 0));
      bone.quaternion.copy(bone.userData.qStatic).multiply(A).multiply(B);
    }

    // leg
    const hf = g('hp_f'), ha = g('hp_a'), hr = g('hp_r');
    setRX(A, -hf); setRZ(B, S * ha); C.identity();
    out3(b['thigh' + sfx].quaternion, null, A, B, C);
    setRY(A, S * hr * 0.33); b['thigh_twist_01' + sfx].quaternion.copy(A);
    setRY(A, S * hr * 0.66); b['thigh_twist_02' + sfx].quaternion.copy(A);
    setRY(A, S * hr); setRX(B, g('kn_f'));
    b['calf' + sfx].quaternion.copy(A).multiply(B);
    b['calf_twist_01' + sfx].quaternion.identity();
    b['calf_twist_02' + sfx].quaternion.identity();
    setRX(A, g('an_p')); setRZ(B, -S * g('an_i'));
    b['foot' + sfx].quaternion.copy(A).multiply(B);
    const to = g('to_f');
    setRX(A, to); b['ball' + sfx].quaternion.copy(A);
    setRX(A, to * 0.5); b['toe_big' + sfx].quaternion.copy(A);
    setRX(A, to * 0.3); b['toe_small' + sfx].quaternion.copy(A);
  }
}

// The bind pose: neutral + arms abducted / relaxed fingers / slight leg spread.
export const REST_POSE = P({
  LR: { sh_a: 30, el_f: 6, h_th: 0.1, h_ix: 0.12, h_md: 0.15, h_rg: 0.18, h_pk: 0.2, h_sp: 0.2, hp_a: 5, an_p: 0 },
});

// Neutral relaxed standing pose (arms by the sides) - the default authoring base.
export const STAND_POSE = P({
  LR: { sh_a: 6, sh_f: 4, el_f: 12, fa_p: 12, wr_f: 0, h_th: 0.25, h_ix: 0.32, h_md: 0.38, h_rg: 0.42, h_pk: 0.46, h_sp: 0.1, hp_a: 2, kn_f: 4 },
});
