// Procedural locomotion: continuous gait synthesis from forward/lateral velocity, used live by
// the animator and baked into loop clips for the catalogue.
import { CH, newPose, lerpPose } from './pose.js';
import { STANDING, READY, STANCE_LOW, flatFeet } from './authoring.js';

const D = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const STANCES = { upright: STANDING, ready: READY, low: STANCE_LOW };
const _base = newPose();

/** Cycle frequency (cycles/s; a cycle = two steps) for a speed in m/s. */
export function cycleFreq(v, style = 'run') {
  if (style === 'shuffle') return 0.9 + 0.22 * v;
  return 0.7 + 0.145 * v;
}

/**
 * Writes a gait pose. phase in [0,1). vf forward speed (m/s, negative = backwards), vl lateral
 * speed (positive = character's left). crouch 0..1 blends upright->ready->low stance.
 */
export function gaitPose(out, phase, vf, vl, crouch = 0.5, opt = {}) {
  const v = Math.hypot(vf, vl);
  // base stance
  if (crouch <= 0.5) lerpPose(_base, STANDING, READY, crouch * 2);
  else lerpPose(_base, READY, STANCE_LOW, (crouch - 0.5) * 2);
  out.set(_base);
  if (v < 0.02) return out;
  const fw = vf / v, lt = vl / v;                      // direction components
  const fwd = Math.abs(fw), lat = Math.abs(lt);
  const dirF = vf >= 0 ? 1 : -1, dirL = vl >= 0 ? 1 : -1;
  const run = smooth(2.2, 5.5, v);                    // 0 walk .. 1 run
  const sprint = smooth(5.5, 8.5, v);
  const hipAmp = clamp(14 + 4.6 * v, 0, 58) * (vf < 0 ? 0.62 : 1) * (0.35 + 0.65 * fwd) * D;
  const kneeAmp = (36 + 48 * run + 26 * sprint) * (0.5 + 0.5 * fwd) * D;
  const armAmp = (16 + 30 * run + 14 * sprint) * (0.45 + 0.55 * fwd) * D;
  const bounce = opt.bounce ?? 1;

  for (const [s, sd, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
    const ph = (phase + off) % 1;
    const a = TAU * ph;
    const sn = Math.sin(a), cs = Math.cos(a);
    // forward/back leg swing (dirF flips the motion for backwards travel)
    const swing = dirF * hipAmp * sn;
    let hf = out[CH['hp_f_' + s]] + swing + 0.35 * hipAmp * (dirF > 0 ? 1 : 0.3);
    const swingPhase = Math.max(0, cs);                 // leg moving forward under body
    let kf = out[CH['kn_f_' + s]] + kneeAmp * Math.pow(swingPhase, 1.4) * (dirF > 0 ? 1 : 0.7) * (0.4 + 0.6 * fwd) + 10 * D * Math.max(0, -sn) * 0.6;
    // lateral shuffle (hip abduction pattern; legs alternate step/close)
    const lateralA = (5 + 9 * clamp(v / 3, 0, 1)) * D * lat;
    let ha = out[CH['hp_a_' + s]] + dirL * lateralA * (s === 'L' ? Math.sin(a) : -Math.sin(a + 0.5 * Math.PI)) * 1.0 + lateralA * 0.6;
    kf += (opt.bounce === undefined ? 1 : bounce) * (6 * D * Math.abs(sn)) * (0.5 + lat);
    // ankle: foot flat in stance, toe-down at push-off, toe-up in swing
    const stance = smooth(0.0, 0.6, -cs);
    let an = (hf - kf - out[CH.pitch]) * stance + (-14 * D + 30 * D * run) * (1 - stance) * 0.6 + 12 * D * smooth(0.35, 0.0, sn) * stance * run;
    out[CH['hp_f_' + s]] = hf; out[CH['hp_a_' + s]] = ha; out[CH['kn_f_' + s]] = kf; out[CH['an_p_' + s]] = clamp(an, -30 * D, 55 * D);
    out[CH['to_f_' + s]] = (12 * D + 20 * D * run) * smooth(0.2, 0.9, sn);
    // arms swing opposite to the same-side leg
    const sw = -dirF * armAmp * sn;
    out[CH['sh_f_' + s]] += sw * (0.4 + 0.6 * fwd) + 10 * D * run;
    out[CH['el_f_' + s]] += (10 + 46 * run + 18 * sprint) * D + 14 * D * Math.max(0, -sw / (armAmp + 1e-6));
    out[CH['sh_a_' + s]] += 4 * D * run;
    if (run > 0.4) for (const k of ['h_ix', 'h_md', 'h_rg', 'h_pk']) out[CH[k + '_' + s]] = 0.65;
  }
  // torso: lean into the run, counter-rotate chest against pelvis
  const sn0 = Math.sin(TAU * phase);
  out[CH.pitch] += (2 + 3.2 * v * (vf >= 0 ? 1 : -0.4)) * D * clamp(fwd + 0.25, 0, 1);
  out[CH.yaw] += -dirF * (3 + 5 * run) * D * sn0 * (0.4 + 0.6 * fwd);
  out[CH.chest_t] += dirF * (4 + 8 * run) * D * sn0 * (0.4 + 0.6 * fwd);
  out[CH.spine_t] += dirF * 2 * D * sn0;
  out[CH.roll] += 2.5 * D * Math.cos(TAU * phase) * (0.5 + run);
  out[CH.spine_l] += 2 * D * Math.cos(TAU * phase) * (0.5 + run) * (-1);
  out[CH.head_f] += -2 * D * run; out[CH.neck_f] += (vf < 0 ? -4 : -2) * D;
  out[CH.hz] += 0.02 * fwd * dirF;
  // lateral lean into direction of travel
  out[CH.spine_l] += -dirL * lat * 5 * D * clamp(v / 3, 0, 1);
  out[CH.roll] += dirL * lat * 2 * D;
  return out;
}

/** Breathing/weight-shift idle, additive over a stance. */
export function idlePose(out, t, stance = READY, o = {}) {
  out.set(stance);
  const br = Math.sin(t * (o.rate ?? 1.6));
  out[CH.chest_f] += 0.012 * br * (o.amp ?? 1);
  out[CH.spine_f] += 0.008 * br;
  out[CH.neck_f] += -0.008 * br;
  for (const s of ['L', 'R']) out[CH['sh_f_' + s]] += 0.010 * br;
  const sway = Math.sin(t * 0.55 + (o.seed ?? 0)) * (o.sway ?? 1);
  out[CH.hx] += 0.012 * sway; out[CH.roll] += 0.020 * sway; out[CH.spine_l] += -0.020 * sway; out[CH.head_l] += 0.016 * sway;
  const bob = Math.sin(t * 2.1 + (o.seed ?? 0)) * (o.bob ?? 1);
  out[CH.kn_f_L] += 0.022 * bob; out[CH.kn_f_R] += 0.022 * bob; out[CH.hp_f_L] += 0.011 * bob; out[CH.hp_f_R] += 0.011 * bob;
  flatFeet(out);
  return out;
}
export { flatFeet };
