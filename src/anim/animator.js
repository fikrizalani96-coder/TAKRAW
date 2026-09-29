// Per-character animator. Layers: procedural base (gait/idle) + action clip (skills, gestures)
// blended with masks, then IK passes (planted feet, contact limb -> ball, gaze) and grounding.
import * as THREE from 'three';
import { CH, NCH, newPose, MASK, lerpPoseMasked, RigPoser } from './pose.js';
import { getClip } from './clip.js';
import { gaitPose, idlePose, cycleFreq } from './gait.js';
import { READY } from './authoring.js';
import { twoBoneIK, aimBone, eyesLookAt, lowestPoint } from './ik.js';

const D = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;
const WRAP = [CH.pitch, CH.yaw, CH.roll];

// Where the ball centre sits relative to the striking surface. Offsets in the end bone's local space.
export const CONTACT_DEF = {
  instep: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: (s) => [0, 0.052, 0.085] },
  inside: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: (s) => [-s * 0.108, -0.010, 0.050] },
  outside: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: (s) => [s * 0.108, -0.010, 0.050] },
  toe: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: () => [0, -0.030, 0.190] },
  heel: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: () => [0, -0.020, -0.125] },
  sole: { bone: 'foot', chain: ['thigh', 'calf', 'foot'], off: () => [0, -0.150, 0.030] },
  knee: { bone: 'calf', aim: 'thigh', off: () => [0, 0.0, 0.118] },
  thigh: { bone: 'thigh_twist_01', aim: 'thigh', off: () => [0, -0.02, 0.12] },
  head: { bone: 'head', off: () => [0, 0.100, 0.130] },
  chest: { bone: 'spine_04', off: () => [0, 0.010, 0.200] },
  back: { bone: 'spine_03', off: () => [0, 0.0, -0.200] },
  shoulder: { bone: 'upperarm', off: (s) => [s * 0.03, 0.02, 0.10] },
  hand: { bone: 'hand', chain: ['upperarm', 'lowerarm', 'hand'], off: () => [0, -0.100, 0.0] },
};

export class Animator {
  constructor(human) {
    this.h = human;
    this.rig = human.rig;
    this.poser = human.poser;
    this.b = human.rig.bones;
    this.basePose = newPose(); this.actPose = newPose(); this.pose = newPose();
    this.mask = MASK.all;
    // locomotion state
    this.vf = 0; this.vl = 0; this.crouch = 0.6; this.phase = Math.random(); this.t = Math.random() * 10;
    this.stanceName = 'ready';
    // action
    this.act = null;          // {clip, time, scale, fadeIn, fadeOut, w, loop, mask, done}
    this.contact = null;      // {kind, side, pos:Vector3, weight}
    this.pins = { L: null, R: null };
    this.jumpY = 0;
    this.groundY = 0;
    this.gaze = null;         // world Vector3 or null
    this.gazeW = 0;
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    this.faceOverride = { jaw: 0, smile: 0, brow: 0 };
    this.expression = { smile: 0, jaw: 0, brow: 0 };
    this.faceTarget = { smile: 0, jaw: 0, brow: 0 };
    this.assist = 1;
    this.tmp = new V3(); this.tmp2 = new V3(); this.tmpQ = new THREE.Quaternion();
    this.ikEnabled = true;
    this.yaw = 0;
    this.speedScale = 1;
    this.airPose = null;
    this.events = [];
    this._lastFoot = { L: new V3(), R: new V3() };
  }

  // ---------- control API ----------
  setLocomotion(vf, vl, crouch = 0.6) { this.vf = vf; this.vl = vl; this.crouch = crouch; }
  setStance(name) { this.stanceName = name; }
  setGaze(target, weight = 1) { this.gaze = target; this.gazeW = weight; }
  setFace(smile = 0, jaw = 0, brow = 0) { this.faceTarget.smile = smile; this.faceTarget.jaw = jaw; this.faceTarget.brow = brow; }

  /**
   * Start an action clip. opts: {contactAt (seconds until contact, rescales time), timeScale, fadeIn,
   * fadeOut, mask, loop, hold}. Returns the action object.
   */
  play(clipOrId, opts = {}) {
    const clip = typeof clipOrId === 'string' ? getClip(clipOrId) : clipOrId;
    if (!clip) return null;
    let scale = opts.timeScale ?? 1;
    const ct = clip.events?.contact;
    if (opts.contactAt !== undefined && ct) scale = clamp(ct / Math.max(0.05, opts.contactAt), 0.55, 2.2);
    this.act = {
      clip, time: opts.startAt ?? 0, scale, fadeIn: opts.fadeIn ?? 0.12, fadeOut: opts.fadeOut ?? 0.22,
      w: 0, loop: opts.loop ?? clip.loop, mask: opts.mask ?? (clip.meta?.mask ? MASK[clip.meta.mask] : MASK.all), done: false,
      elapsed: 0, hold: opts.hold ?? false, fired: {}, id: clip.id,
    };
    this.pins = { L: null, R: null };
    this._pinInit = false;
    this.contact = null;
    return this.act;
  }
  stopAction(fade = 0.2) { if (this.act) { this.act.fadeOut = fade; this.act.ending = true; } }
  get actionTime() { return this.act ? this.act.time : 0; }
  get busy() { return !!this.act && !this.act.done; }

  /** Provide the ball position (world) the contact limb should reach; kind overrides clip.meta. */
  setContactTarget(pos, weight = 1) {
    if (!this.act) return;
    const m = this.act.clip.meta?.contact;
    if (!m) return;
    if (!this.contact) this.contact = { kind: m.kind, side: m.side, pos: new V3(), weight: 1, t: this.act.clip.events.contact };
    this.contact.pos.copy(pos); this.contact.weight = weight;
  }

  // ---------- update ----------
  update(dt) {
    const rig = this.rig, b = this.b;
    this.t += dt;
    // base layer
    const sp = Math.hypot(this.vf, this.vl);
    if (sp > 0.08) {
      this.phase = (this.phase + dt * cycleFreq(sp)) % 1;
      gaitPose(this.basePose, this.phase, this.vf, this.vl, this.crouch);
      // blend toward idle at very low speeds for smooth start/stop
      if (sp < 0.5) { idlePose(this.actPose, this.t, this.stanceName === 'upright' ? READY : READY); const w = 1 - sp / 0.5; for (let i = 0; i < NCH; i++) this.basePose[i] += (this.actPose[i] - this.basePose[i]) * w; }
    } else idlePose(this.basePose, this.t, READY, { seed: this.phase * 6 });
    let pose = this.basePose;

    // action layer
    const A = this.act;
    if (A) {
      A.elapsed += dt;
      const dur = A.clip.duration;
      let ct = A.time + dt * A.scale;
      if (A.loop) ct %= dur; else if (ct >= dur) { ct = dur; if (!A.hold) A.ending = true; }
      A.time = ct;
      // events
      for (const [name, tt] of Object.entries(A.clip.events || {})) if (!A.fired[name] && A.time >= tt - 1e-6) { A.fired[name] = true; this.events.push({ name, t: A.time, act: A }); }
      let target = 1;
      if (A.ending) { A.fadeAcc = (A.fadeAcc ?? 0) + dt; target = 0; }
      const rate = target === 1 ? (1 / Math.max(0.01, A.fadeIn)) : (1 / Math.max(0.01, A.fadeOut));
      A.w = clamp(A.w + (target === 1 ? 1 : -1) * dt * rate, 0, 1);
      if (A.ending && A.w <= 0) { A.done = true; this.act = null; this.contact = null; this.pins = { L: null, R: null }; }
      else {
        A.clip.sample(A.time, this.actPose);
        for (const c of WRAP) { const a = this.actPose[c]; if (a > Math.PI || a < -Math.PI) this.actPose[c] = a - Math.PI * 2 * Math.round(a / (Math.PI * 2)); }
        pose = this.pose;
        lerpPoseMasked(pose, this.basePose, this.actPose, smooth(A.w), A.mask);
      }
    }
    if (pose === this.basePose) { this.pose.set(pose); pose = this.pose; }

    // face & blink & gaze (pose channels)
    this._face(dt, pose);
    this._look(pose);

    // FK
    b.root.position.set(0, 0, 0);
    this.poser.apply(pose);
    rig.root.updateMatrixWorld(true);

    if (this.ikEnabled) this._ik(dt);

    // ground fit
    const low = lowestPoint(rig);
    this.groundY = -low;
    b.root.position.y = this.groundY + this.jumpY;
    rig.root.updateMatrixWorld(true);
    // eyes
    this._eyes();
  }

  _face(dt, pose) {
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.001; this.blinkT = 2 + Math.random() * 4; }
    let bl = 0;
    if (this.blink > 0) { this.blink += dt; const u = this.blink / 0.17; bl = u < 0.5 ? u * 2 : Math.max(0, 2 - u * 2); if (u >= 1) this.blink = 0; }
    const e = this.expression, ft = this.faceTarget, k = 1 - Math.exp(-8 * dt);
    e.smile += (ft.smile - e.smile) * k; e.jaw += (ft.jaw - e.jaw) * k; e.brow += (ft.brow - e.brow) * k;
    pose[CH.blink] = clamp(Math.max(pose[CH.blink], bl), 0, 1);
    pose[CH.jaw] = clamp(pose[CH.jaw] + e.jaw, 0, 1);
    pose[CH.smile] = clamp(pose[CH.smile] + e.smile, -1, 1);
    pose[CH.brow] = clamp(pose[CH.brow] + e.brow, -1, 1);
  }

  _look(pose) {
    if (!this.gaze || this.gazeW <= 0) return;
    const head = this.b.head, grp = this.h.group;
    head.getWorldPosition(this.tmp);
    this.tmp2.copy(this.gaze).sub(this.tmp);
    // into body-facing frame
    const inv = grp.matrixWorld.clone().invert();
    const lp = this.gaze.clone().applyMatrix4(inv);
    const hp = this.tmp.clone().applyMatrix4(inv);
    const dx = lp.x - hp.x, dy = lp.y - hp.y, dz = lp.z - hp.z;
    const yaw = Math.atan2(dx, dz), pitch = Math.atan2(-dy, Math.hypot(dx, dz));
    const w = this.gazeW;
    const yc = clamp(yaw, -1.25, 1.25), pc = clamp(pitch, -0.6, 0.7);
    // subtract what the pose already contributes (approx.)
    const py = pose[CH.head_t] + pose[CH.neck_t] + pose[CH.chest_t] * 0.6 + pose[CH.spine_t] * 0.4 + pose[CH.yaw];
    const pp = pose[CH.head_f] + pose[CH.neck_f];
    const dyaw = (yc - py) * w, dpit = (pc - pp - 0.15) * w;
    pose[CH.neck_t] += dyaw * 0.55; pose[CH.head_t] += dyaw * 0.45;
    pose[CH.neck_f] += dpit * 0.45; pose[CH.head_f] += dpit * 0.55;
  }

  _eyes() {
    if (!this.gaze) return;
    for (const sd of ['_l', '_r']) eyesLookAt(this.b['eye' + sd], this.gaze, 0.5, 0.4, this.gazeW);
  }

  _ik(dt) {
    const b = this.b, A = this.act;
    const grp = this.h.group;
    if (!A) return;
    const clip = A.clip, meta = clip.meta || {};
    // foot pinning (planted feet)
    if (meta.plant) {
      for (const pl of meta.plant) {
        const s = pl.foot;
        const foot = b['foot_' + s.toLowerCase()];
        if (!this.pins[s]) {
          if (A.time >= pl.t0 - 1e-6 && A.elapsed > 0) {
            const wp = new V3().setFromMatrixPosition(foot.matrixWorld);
            const q = new THREE.Quaternion(); foot.matrixWorld.decompose(new V3(), q, new V3());
            this.pins[s] = { pos: wp, q };
            // remember where the previous frame had the foot so the pin captures true position
            if (this._lastFoot[s].lengthSq() > 0) this.pins[s].pos.copy(this._lastFoot[s]);
          }
        }
        const pin = this.pins[s];
        if (pin && A.time <= pl.t1 + 0.05) {
          const wgt = smooth((A.time - pl.t0) / 0.06) * (1 - smooth((A.time - pl.t1) / 0.06)) * A.w;
          this._pinFoot(s, pin, wgt);
        }
      }
    }
    for (const s of ['L', 'R']) this._lastFoot[s].setFromMatrixPosition(b['foot_' + s.toLowerCase()].matrixWorld);
    // contact IK
    if (this.contact && meta.contact) this._contactIK(A, meta.contact);
  }

  _pinFoot(s, pin, w) {
    if (w <= 0.001) return;
    const sd = '_' + s.toLowerCase();
    const b = this.b;
    // body-shift is already in FK; use two-bone IK to keep the foot where it was planted
    const pole = new V3(0, 0, 1).transformDirection(this.h.group.matrixWorld).multiplyScalar(0.5).add(new V3().setFromMatrixPosition(b['calf' + sd].matrixWorld));
    twoBoneIK(b['thigh' + sd], b['calf' + sd], b['foot' + sd], pin.pos, pole, w, true);
  }

  _contactIK(A, m) {
    const C = this.contact, def = CONTACT_DEF[C.kind];
    if (!def) return;
    const b = this.b;
    const tc = A.clip.events.contact;
    // weight bell around the contact time
    const dt0 = A.time - tc;
    const wB = dt0 < 0 ? smooth(1 + dt0 / 0.20) : 1 - smooth(dt0 / 0.16);
    const w = clamp(wB * C.weight * A.w * this.assist, 0, 1);
    if (w <= 0.001) return;
    const sd = C.side ? '_' + C.side.toLowerCase() : '';
    const s = C.side === 'L' ? 1 : C.side === 'R' ? -1 : 1;
    const off = def.off(s);
    const target = C.pos;
    if (def.chain) {
      const [a, m, e] = def.chain.map((n) => b[n + sd]);
      for (let it = 0; it < 2; it++) {
        // ankle target = ball - R_end * offset
        const q = new THREE.Quaternion(); e.matrixWorld.decompose(new V3(), q, new V3());
        const t = new V3(off[0], off[1], off[2]).applyQuaternion(q);
        const tgt = target.clone().sub(t);
        const pole = new V3(0, 0, 1).transformDirection(this.h.group.matrixWorld).multiplyScalar(0.6).add(new V3().setFromMatrixPosition(m.matrixWorld));
        twoBoneIK(a, m, e, tgt, pole, w);
      }
    } else if (def.aim) {
      const bone = b[def.aim + sd];
      const child = b[(def.aim === 'thigh' ? 'calf' : 'lowerarm') + sd];
      // rotate the thigh so the knee/thigh surface meets the ball
      const pt = new V3().setFromMatrixPosition(b[def.bone + sd].matrixWorld);
      const hip = new V3().setFromMatrixPosition(bone.matrixWorld);
      const want = target.clone().sub(hip);
      const reach = pt.clone().sub(hip).length() + off[2] * 0.4;
      want.setLength(Math.max(0.1, reach));
      const tk = hip.clone().add(want);
      aimBone(bone, child, tk, w);
    } else {
      // body-attached contact (head/chest/back/shoulder): shift the pelvis so the point meets the ball
      const bone = b[def.bone + (def.bone === 'upperarm' ? sd : '')];
      bone.updateMatrixWorld(true);
      const pt = new V3(off[0], off[1], off[2]).applyMatrix4(bone.matrixWorld);
      const err = target.clone().sub(pt);
      const lim = 0.45;
      if (err.length() > lim) err.setLength(lim);
      const pel = b.pelvis;
      const par = pel.parent;
      const pw = new V3().setFromMatrixPosition(pel.matrixWorld);
      const np = pw.clone().addScaledVector(err, w);
      par.updateMatrixWorld(true);
      pel.position.copy(par.worldToLocal(np));
      pel.updateMatrixWorld(true);
      // upper body leans toward the ball
      rigUpdate(this.rig);
    }
  }

  /** World position of a bone-local point (after the last update). */
  worldPoint(boneName, x = 0, y = 0, z = 0, out = new V3()) { return out.set(x, y, z).applyMatrix4(this.b[boneName].matrixWorld); }
  consumeEvents() { const e = this.events; this.events = []; return e; }
}

function rigUpdate(rig) { rig.root.updateMatrixWorld(true); }
