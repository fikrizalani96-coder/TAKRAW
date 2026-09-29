// Locomotion loops baked from the procedural gait (direction x speed x stance), turns,
// starts/stops, split steps and idle variations.
import { CH, P, newPose, mirrorPose, copyPose, lerpPose } from '../pose.js';
import { READY, STANCE_LOW, STANDING, HAND, KB, flatFeet, D2R } from '../authoring.js';
import { gaitPose, idlePose, cycleFreq } from '../gait.js';
import { register } from '../clip.js';

const DIRS = [
  { n: 'fwd', a: 0 }, { n: 'fwd-left', a: 45 }, { n: 'left', a: 90 }, { n: 'back-left', a: 135 },
  { n: 'back', a: 180 }, { n: 'back-right', a: 225 }, { n: 'right', a: 270 }, { n: 'fwd-right', a: 315 },
];
const SPEEDS = [0.6, 1.0, 1.4, 2.0, 2.8, 3.6, 4.5, 5.5, 7.0];
const SPEED_NAME = (v) => (v < 1.2 ? 'slow-walk' : v < 1.8 ? 'walk' : v < 2.4 ? 'brisk-walk' : v < 3.2 ? 'jog' : v < 4.2 ? 'run' : v < 5 ? 'fast-run' : v < 6 ? 'sprint' : 'full-sprint');

function bakeGait(vf, vl, crouch, style) {
  const sp = Math.hypot(vf, vl);
  const fc = cycleFreq(sp, style);
  const dur = 1 / fc;
  const N = 10;
  const keys = [];
  for (let i = 0; i < N; i++) { const pose = newPose(); gaitPose(pose, i / N, vf, vl, crouch); keys.push({ t: (i / N) * dur, pose }); }
  return { duration: dur, loop: true, keys, events: {}, meta: { speed: sp, vf, vl, crouch, kind: 'loco' } };
}

function idleClip(fn, dur) {
  const N = 12; const keys = [];
  for (let i = 0; i < N; i++) { const pose = newPose(); fn(pose, (i / N) * dur); keys.push({ t: (i / N) * dur, pose }); }
  return { duration: dur, loop: true, keys, events: {}, meta: { kind: 'idle' } };
}

export function registerLocomotion() {
  // ---- gait loops ----
  for (const d of DIRS) {
    const rad = d.a * Math.PI / 180;
    const maxIdx = Math.abs(d.a) === 0 || d.a === 45 || d.a === 315 ? 9 : d.a === 90 || d.a === 270 ? 7 : 6;
    for (let i = 0; i < maxIdx; i++) {
      const v = SPEEDS[i];
      for (const [sn, crouch] of [['upright', 0.12], ['ready', 0.55]]) {
        if (sn === 'ready' && v > 4.6) continue;
        const vf = Math.cos(rad) * v, vl = Math.sin(rad) * v;
        register({ id: `loco.${d.n}.${SPEED_NAME(v)}.${v.toFixed(1)}.${sn}`, name: `${SPEED_NAME(v)} ${d.n} (${v.toFixed(1)} m/s, ${sn})`, cat: 'locomotion', tags: ['loop', d.n, sn], params: { kind: 'loco', vf, vl, crouch }, dur: 1 / cycleFreq(v), loop: true, build: () => bakeGait(vf, vl, crouch, 'run') });
      }
    }
  }
  // ---- low athletic shuffles (sepak takraw defensive footwork) ----
  for (const d of DIRS) for (const v of [0.8, 1.5, 2.4, 3.2]) {
    const rad = d.a * Math.PI / 180; const vf = Math.cos(rad) * v, vl = Math.sin(rad) * v;
    register({ id: `loco.shuffle.${d.n}.${v.toFixed(1)}`, name: `Low shuffle ${d.n} (${v.toFixed(1)} m/s)`, cat: 'locomotion', tags: ['loop', 'shuffle', d.n], params: { kind: 'loco', vf, vl, crouch: 0.9 }, dur: 1 / cycleFreq(v, 'shuffle'), loop: true, build: () => bakeGait(vf, vl, 0.92, 'shuffle') });
  }

  // ---- idle stances & fidgets ----
  const idles = [
    ['ready', 'Ready stance', (p, t) => idlePose(p, t, READY)],
    ['ready-b', 'Ready stance (weight forward)', (p, t) => { idlePose(p, t, READY, { seed: 1.3 }); p[CH.pitch] += 0.05; p[CH.hz] += 0.03; }],
    ['low', 'Low defensive stance', (p, t) => idlePose(p, t, STANCE_LOW)],
    ['low-b', 'Low stance (arms wide)', (p, t) => { idlePose(p, t, STANCE_LOW, { seed: 2.1 }); for (const s of ['L', 'R']) { p[CH['sh_a_' + s]] += 0.35; p[CH['el_f_' + s]] -= 0.25; } }],
    ['upright', 'Upright standing', (p, t) => idlePose(p, t, STANDING, { amp: 0.8, sway: 1.4 })],
    ['upright-b', 'Standing, weight on left leg', (p, t) => { idlePose(p, t, STANDING, { seed: 0.5, sway: 0.6 }); p[CH.hx] += 0.04; p[CH.roll] += 0.05; p[CH.hp_a_R] += 0.12; p[CH.kn_f_R] += 0.12; }],
    ['upright-c', 'Standing, weight on right leg', (p, t) => { idlePose(p, t, STANDING, { seed: 0.9, sway: 0.6 }); p[CH.hx] -= 0.04; p[CH.roll] -= 0.05; p[CH.hp_a_L] += 0.12; p[CH.kn_f_L] += 0.12; }],
    ['hands-hips', 'Hands on hips', (p, t) => { idlePose(p, t, STANDING, { amp: 1.4 }); for (const s of ['L', 'R']) { p[CH['sh_a_' + s]] = 36 * D2R; p[CH['sh_f_' + s]] = -6 * D2R; p[CH['el_f_' + s]] = 105 * D2R; p[CH['fa_p_' + s]] = 60 * D2R; p[CH['wr_d_' + s]] = -0.2; } p[CH.head_l] += 0.02; }],
    ['hands-knees', 'Hands on knees (catching breath)', (p, t) => { idlePose(p, t, STANDING, { rate: 2.8, amp: 3 }); p[CH.spine_f] += 0.6; p[CH.chest_f] += 0.25; p[CH.neck_f] -= 0.3; for (const s of ['L', 'R']) { p[CH['hp_f_' + s]] = 0.5; p[CH['kn_f_' + s]] = 0.55; p[CH['sh_f_' + s]] = 0.7; p[CH['el_f_' + s]] = 0.12; p[CH['sh_a_' + s]] = 0.15; } flatFeet(p); }],
    ['hands-head', 'Hands behind head', (p, t) => { idlePose(p, t, STANDING, { rate: 2.4, amp: 2.4 }); for (const s of ['L', 'R']) { p[CH['sh_f_' + s]] = 150 * D2R; p[CH['sh_a_' + s]] = 40 * D2R; p[CH['el_f_' + s]] = 130 * D2R; p[CH['sh_t_' + s]] = 40 * D2R; } p[CH.head_f] -= 0.12; }],
    ['arms-crossed', 'Arms crossed', (p, t) => { idlePose(p, t, STANDING); for (const s of ['L', 'R']) { const k = s === 'L' ? 1 : -1; p[CH['sh_f_' + s]] = 46 * D2R; p[CH['sh_a_' + s]] = -32 * D2R; p[CH['el_f_' + s]] = 120 * D2R; p[CH['fa_p_' + s]] = 60 * D2R; } }],
    ['tired', 'Tired, slumped', (p, t) => { idlePose(p, t, STANDING, { rate: 2.6, amp: 2.5 }); p[CH.spine_f] += 0.28; p[CH.chest_f] += 0.12; p[CH.neck_f] += 0.28; p[CH.head_f] += 0.1; for (const s of ['L', 'R']) { p[CH['sh_f_' + s]] += 0.16; p[CH['cl_e_' + s]] -= 0.1; } }],
    ['shake-legs', 'Shaking out the legs', (p, t) => { idlePose(p, t, STANDING); const k = Math.sin(t * 9); p[CH.hp_f_L] += 0.35 * Math.max(0, k); p[CH.kn_f_L] += 0.7 * Math.max(0, k); p[CH.hp_f_R] += 0.35 * Math.max(0, -k); p[CH.kn_f_R] += 0.7 * Math.max(0, -k); }],
    ['bounce', 'Bouncing on toes', (p, t) => { idlePose(p, t, READY); const k = Math.sin(t * 8); p[CH.kn_f_L] += 0.15 * k; p[CH.kn_f_R] += 0.15 * k; p[CH.an_p_L] += 0.2 * Math.max(0, k); p[CH.an_p_R] += 0.2 * Math.max(0, k); p[CH.hy] += 0.02 * Math.abs(k); }],
    ['look-around', 'Looking around', (p, t) => { idlePose(p, t, READY); p[CH.head_t] += 0.5 * Math.sin(t * 0.9); p[CH.neck_t] += 0.4 * Math.sin(t * 0.9); p[CH.head_f] += 0.08 * Math.sin(t * 1.7); }],
    ['stretch-arms', 'Arm stretch overhead', (p, t) => { idlePose(p, t, STANDING); for (const s of ['L', 'R']) { p[CH['sh_f_' + s]] = 165 * D2R; p[CH['sh_a_' + s]] = 10 * D2R; p[CH['el_f_' + s]] = 6 * D2R; } p[CH.spine_f] -= 0.12; p[CH.spine_l] += 0.16 * Math.sin(t * 1.4); p[CH.neck_f] -= 0.2; }],
    ['calm-breath', 'Calm deep breathing', (p, t) => { idlePose(p, t, STANDING, { rate: 1.1, amp: 2.2 }); p[CH.chest_f] -= 0.04; for (const s of ['L', 'R']) p[CH['sh_a_' + s]] += 0.05; }],
    ['pre-serve-a', 'Pre-serve routine: shoulders roll', (p, t) => { idlePose(p, t, READY); const k = Math.sin(t * 2.4); for (const s of ['L', 'R']) { p[CH['cl_e_' + s]] += 0.12 * (k > 0 ? 1 : 0); } p[CH.neck_l] += 0.1 * k; }],
    ['pre-serve-b', 'Pre-serve routine: toe tap', (p, t) => { idlePose(p, t, READY); const k = Math.max(0, Math.sin(t * 7)); p[CH.hp_f_R] += 0.14 * k; p[CH.kn_f_R] += 0.3 * k; }],
    ['pre-serve-c', 'Pre-serve routine: rhythm bounce', (p, t) => { idlePose(p, t, READY); const k = Math.sin(t * 6); p[CH.kn_f_L] += 0.12 * k; p[CH.kn_f_R] += 0.12 * k; p[CH.sh_f_L] += 0.1 * k; p[CH.sh_f_R] -= 0.1 * k; }],
    ['focus', 'Focused stare', (p, t) => { idlePose(p, t, READY, { amp: 0.6, sway: 0.3 }); p[CH.head_f] += 0.1; p[CH.brow] = -0.3; }],
    ['nervous', 'Nervous fidget', (p, t) => { idlePose(p, t, READY, { rate: 2.8 }); p[CH.head_t] += 0.15 * Math.sin(t * 3.3); for (const s of ['L', 'R']) p[CH['h_ix_' + s]] = 0.5 + 0.4 * Math.sin(t * 5); }],
    ['encourage', 'Encouraging teammates (clap)', (p, t) => { idlePose(p, t, STANDING); const k = Math.max(0, Math.sin(t * 6)); for (const s of ['L', 'R']) { p[CH['sh_f_' + s]] = 62 * D2R; p[CH['sh_a_' + s]] = (20 - 16 * k) * D2R; p[CH['el_f_' + s]] = 92 * D2R; p[CH['fa_p_' + s]] = 90 * D2R; } p[CH.smile] = 0.4; }],
  ];
  for (const [id, name, fn] of idles) {
    register({ id: 'idle.' + id, name, cat: 'idle', tags: ['loop'], params: { kind: 'idle' }, dur: 4, loop: true, build: () => idleClip(fn, 4.4) });
    register({ id: 'idle.' + id + '.m', name: name + ' (mirrored)', cat: 'idle', tags: ['loop', 'mirror'], params: { kind: 'idle' }, dur: 4, loop: true, build: () => { const c = idleClip(fn, 4.4); c.keys = c.keys.map((k) => ({ t: k.t, pose: mirrorPose(k.pose) })); return c; } });
  }

  // ---- turns in place ----
  for (const [ang, dur] of [[45, 0.32], [90, 0.42], [135, 0.55], [180, 0.7]]) for (const side of ['L', 'R']) for (const [sn, base] of [['ready', READY], ['low', STANCE_LOW]]) {
    const sg = side === 'L' ? 1 : -1;
    register({ id: `turn.${side}.${ang}.${sn}`, name: `Turn ${side === 'L' ? 'left' : 'right'} ${ang}° (${sn})`, cat: 'locomotion', tags: ['turn'], params: { kind: 'turn', angle: ang * sg }, dur, build: () => {
      const kb = new KB(base);
      kb.at(0, {});
      const mid = kb.at(dur * 0.45, { yaw: sg * Math.min(ang * 0.5, 40), spine: [4, 0, sg * ang * 0.25], neck: [-6, 0, sg * ang * 0.2], chest: [0, 0, sg * ang * 0.25], [side]: { hp_f: 40, kn_f: 60, hp_r: sg * 22 } });
      const end = kb.at(dur, { yaw: 0 }); flatFeet(mid);
      kb.at(dur + 0.2, {});
      return { duration: dur + 0.2, loop: false, keys: kb.keys, events: { turn: dur * 0.5 }, meta: { kind: 'turn', angle: ang * sg, plant: [] } };
    } });
  }

  // ---- starts and stops (acceleration / braking) ----
  for (const d of DIRS) {
    const rad = d.a * Math.PI / 180;
    for (const [nm, kind] of [['start', 0], ['stop', 1]]) {
      register({ id: `loco.${nm}.${d.n}`, name: `${nm === 'start' ? 'Explosive start' : 'Braking stop'} ${d.n}`, cat: 'locomotion', tags: [nm, d.n], params: { kind: 'loco-' + nm, dir: d.a }, dur: 0.62, build: () => {
        const kb = new KB(READY);
        const fx = Math.cos(rad), lx = Math.sin(rad);
        if (kind === 0) {
          kb.at(0, {});
          const lean = kb.at(0.16, { pitch: 8 * fx + 2, spine: [10 * fx, -lx * 8, 0], hz: 0.04 * fx, roll: -lx * 4, hx: lx * 0.03, LR: { hp_f: 36 - 20 * Math.abs(lx), kn_f: 70 }, L: { hp_a: 10 + lx * 12 }, R: { hp_a: 10 - lx * 12 } });
          flatFeet(lean);
          kb.at(0.34, { pitch: 10 * fx, spine: [6 * fx, -lx * 4, 0], L: { hp_f: 40 * fx, kn_f: 40 }, R: { hp_f: -20 * fx, kn_f: 30 } });
          kb.at(0.62, {});
        } else {
          kb.at(0, { pitch: 8 * fx, L: { hp_f: 20, kn_f: 30 }, R: { hp_f: 0 } });
          const br = kb.at(0.12, { pitch: -6 * fx, spine: [-4 * fx + 6, lx * 6, 0], hz: -0.03 * fx, LR: { hp_f: 52, kn_f: 84, hp_a: 12 }, roll: lx * 3 }); flatFeet(br);
          kb.at(0.62, {});
        }
        return { duration: 0.62, loop: false, keys: kb.keys, events: {}, meta: { kind: 'loco-' + nm, dir: d.a } };
      } });
    }
  }

  // ---- split steps / hops ----
  for (const [nm, h, dur] of [['small', 0.06, 0.38], ['medium', 0.10, 0.46], ['big', 0.16, 0.56]]) for (const ver of ['ready', 'wide']) {
    register({ id: `hop.split.${nm}.${ver}`, name: `Split-step hop (${nm}, ${ver})`, cat: 'locomotion', tags: ['hop', 'split-step'], params: { kind: 'hop' }, dur, build: () => {
      const kb = new KB(READY);
      kb.at(0, {});
      const ld = kb.at(dur * 0.25, { LR: { hp_f: 52, kn_f: 82, hp_a: ver === 'wide' ? 22 : 10 } }); flatFeet(ld);
      const up = kb.at(dur * 0.5, { LR: { hp_f: 16, kn_f: 22, an_p: 42, hp_a: ver === 'wide' ? 26 : 12, sh_f: 46 } });
      const ld2 = kb.at(dur * 0.8, { LR: { hp_f: 48, kn_f: 80, hp_a: ver === 'wide' ? 20 : 10 } }); flatFeet(ld2);
      kb.at(dur, {});
      return { duration: dur, loop: false, keys: kb.keys, events: {}, meta: { kind: 'hop', air: { t0: dur * 0.36, t1: dur * 0.66, peak: h } } };
    } });
  }
}
