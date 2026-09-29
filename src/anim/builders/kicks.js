// Parametric foot-strike generator. One biomechanical model -> serves, digs, sets, ground attacks,
// clearances. The contact pose is solved from the target ball position T (root frame; +x = the
// player's left, +y up, +z forward) so each parameter set yields a genuinely different motion.
import * as THREE from 'three';
import { P, CH } from '../pose.js';
import { READY, STANCE_LOW, KB, flatFeet, solveLeg, other, sideSign, D2R, clampN, lerpN, LEN, V } from '../authoring.js';
import { register } from '../clip.js';

// Approximate foot-frame offset (ball centre relative to the ankle) used while authoring.
const SURF = {
  instep: { off: [0, 0.052, 0.085], ap: 50, ai: 0, hr: -8, pd: 30 },
  inside: { off: [-0.108, -0.010, 0.050], ap: -4, ai: 14, hr: 38, pd: 4 },
  outside: { off: [0.108, -0.010, 0.050], ap: 44, ai: -20, hr: -24, pd: 20 },
  toe: { off: [0, -0.030, 0.190], ap: 62, ai: 0, hr: -4, pd: 55 },
  heel: { off: [0, -0.020, -0.125], ap: -18, ai: 0, hr: 6, pd: 0 },
  sole: { off: [0, -0.150, 0.030], ap: -24, ai: 0, hr: 10, pd: 0 },
};

const rotY = (v, a) => new THREE.Vector3(v.x * Math.cos(a) + v.z * Math.sin(a), v.y, -v.x * Math.sin(a) + v.z * Math.cos(a));

/**
 * p: {leg:'L'|'R', surface, T:[x,y,z], power 0..1, tc (contact time), style:'stand'|'lunge'|'hop'|'step',
 *      base, follow (follow-through scale), recover (s), backswing (0..1)}
 */
export function makeKick(p) {
  const s = p.leg, ps = other(s), sd = sideSign(s);
  const surf = SURF[p.surface] || SURF.instep;
  const [tx, ty, tz] = p.T;
  const power = p.power ?? 0.6;
  const tc = p.tc ?? 0.34;
  const style = p.style ?? 'stand';
  const backswing = p.backswing ?? (0.45 + 0.55 * power);
  const base = p.base ?? READY;
  const kb = new KB(base);
  const shotYaw = Math.atan2(tx, Math.max(0.12, tz));       // direction to ball from the body (radians)
  const shotDeg = shotYaw / D2R;
  const dirShot = new THREE.Vector3(Math.sin(shotYaw), 0.25, Math.cos(shotYaw)).normalize();
  const hi = clampN((ty - 0.7) / 0.9, -0.3, 1.2);            // 0 knee height .. 1 head height
  const lunge = style === 'lunge' ? 1 : 0;

  // ------- build key poses -------
  const t0 = 0, t1 = tc * 0.44, t2 = Math.max(tc * 0.78, tc - 0.075), t3 = tc, t4 = tc + 0.085, t5 = tc + 0.23, t6 = tc + 0.42, t7 = tc + 0.62;

  // stance start (weight shifted on plant leg)
  const start = kb.at(t0, { hx: -sd * 0.02, spine: [base === STANCE_LOW ? 24 : 14, -sd * 1.5, 0] });
  flatFeet(start);

  // backswing
  const bs = P({
    hx: -sd * 0.03, hz: -0.02, yaw: sd * (8 + 16 * power * backswing), roll: sd * 3,
    spine: [10 - 6 * hi, -sd * 2, sd * (5 + 8 * backswing)], chest: [2, 0, sd * (6 + 8 * backswing)], neck: [-10, 0, 0],
    [s]: { hp_f: -(10 + 26 * power * backswing), hp_a: 6, hp_r: -sd * 0, kn_f: 62 + 44 * power * backswing, an_p: 24 },
    [ps]: { hp_f: 34 - 6 * hi + 10 * lunge, kn_f: 58 - 12 * hi + 22 * lunge, hp_a: 8 + 10 * lunge },
  }, base);
  bs[CH['an_p_' + ps]] = bs[CH['hp_f_' + ps]] - bs[CH['kn_f_' + ps]] - bs[CH.pitch];
  // arms: opposite arm swings forward for balance, kicking-side arm back
  bs[CH['sh_f_' + other(s)]] = 42 * D2R; bs[CH['sh_f_' + s]] = -10 * D2R; bs[CH['sh_a_' + s]] = 30 * D2R; bs[CH['el_f_' + s]] = 40 * D2R;
  kb.push(t1, bs);

  // cock: knee leads, foot trailing
  const ck = P({
    hx: -sd * 0.02, yaw: sd * (2 + 5 * power), roll: sd * 2,
    spine: [8 - 6 * hi, -sd, sd * 2], chest: [1, 0, 0], neck: [-8, 0, 0],
    [s]: { hp_f: 40 + 30 * Math.max(hi, 0.2), hp_a: 8, kn_f: 96 + 10 * power, an_p: 32 },
    [ps]: { hp_f: 32 - 6 * hi + 10 * lunge, kn_f: 52 - 10 * hi + 22 * lunge },
  }, base);
  ck[CH['an_p_' + ps]] = ck[CH['hp_f_' + ps]] - ck[CH['kn_f_' + ps]] - ck[CH.pitch];
  ck[CH['sh_f_' + other(s)]] = 44 * D2R; ck[CH['sh_a_' + other(s)]] = 26 * D2R; ck[CH['sh_a_' + s]] = 34 * D2R; ck[CH['sh_f_' + s]] = -6 * D2R;
  kb.push(t2, ck);

  // contact (solved)
  const contact = P({
    hx: -sd * 0.02 + tx * 0.1 * lunge, hz: 0.03 + tz * 0.18 * lunge, yaw: -sd * (4 + 6 * power) + shotDeg * 0.55, roll: sd * 4,
    pitch: -6 * hi + 6 * lunge,
    spine: [10 - 30 * Math.max(hi, 0) + 10 * lunge, -sd * 3 - Math.sign(tx) * Math.min(6, Math.abs(tx) * 12), -sd * 4], chest: [-2 - 6 * Math.max(hi, 0), 0, 0], neck: [-6, 0, 0],
    [ps]: { hp_f: 20 - 6 * hi + 20 * lunge, kn_f: 22 + 4 * lunge * 30 - 6 * hi, hp_a: 5 + 12 * lunge },
    [s]: { hp_r: surf.hr, an_p: surf.ap, an_i: surf.ai, to_f: p.surface === 'toe' ? 30 : 0 },
  }, base);
  contact[CH['an_p_' + ps]] = contact[CH['hp_f_' + ps]] - contact[CH['kn_f_' + ps]] - contact[CH.pitch];
  // ankle target = ball - foot offset (rotated to face the shot, foot pitched by 'pd')
  const off = new THREE.Vector3(...surf.off).applyAxisAngle(new THREE.Vector3(1, 0, 0), -surf.pd * D2R);
  const offW = rotY(off, shotYaw);
  const ankle = new THREE.Vector3(tx, ty, tz).sub(offW);
  // pole: knee direction
  const pole = p.surface === 'inside' ? [-sd * 0.2, 0, 1] : p.surface === 'outside' ? [sd * 0.5, 0, 1] : [sd * 0.2, 0, 1];
  solveLeg(contact, s, ankle, { pole });
  contact[CH['sh_f_' + other(s)]] = 55 * D2R; contact[CH['sh_a_' + other(s)]] = 32 * D2R; contact[CH['el_f_' + other(s)]] = 60 * D2R;
  contact[CH['sh_f_' + s]] = -18 * D2R; contact[CH['sh_a_' + s]] = 46 * D2R; contact[CH['el_f_' + s]] = 30 * D2R;
  contact[CH.jaw] = 0.25 * power;
  kb.push(t3, contact, 1.25);

  // follow-through
  const ft = new THREE.Vector3(tx, ty, tz).addScaledVector(dirShot, (0.20 + 0.34 * power) * (p.follow ?? 1)).add(new THREE.Vector3(0, 0.10 * (1 - hi * 0.5), 0));
  const follow = P({
    hx: contact[CH.hx], hz: contact[CH.hz] + 0.03, yaw: contact[CH.yaw] / D2R + 7, roll: contact[CH.roll] / D2R, pitch: contact[CH.pitch] / D2R + 2,
    spine: [contact[CH.spine_f] / D2R + 3, 0, 0], chest: [-2, 0, 0], neck: [-4, 0, 0],
    [ps]: { hp_f: 14, kn_f: 12, hp_a: 5 },
    [s]: { hp_r: surf.hr * 0.6, an_p: surf.ap * 0.7, an_i: surf.ai * 0.5 },
  }, base);
  follow[CH['an_p_' + ps]] = follow[CH['hp_f_' + ps]] - follow[CH['kn_f_' + ps]] - follow[CH.pitch];
  solveLeg(follow, s, ft, { pole });
  follow[CH['sh_f_' + other(s)]] = 40 * D2R; follow[CH['sh_a_' + other(s)]] = 30 * D2R; follow[CH['sh_a_' + s]] = 36 * D2R; follow[CH['sh_f_' + s]] = -10 * D2R;
  kb.push(t4, follow);

  const settle = P({
    yaw: contact[CH.yaw] / D2R * 0.3,
    spine: [10, 0, 0], neck: [-8, 0, 0],
    [s]: { hp_f: 26, kn_f: 58, hp_a: 8, an_p: 14 },
    [ps]: { hp_f: 30, kn_f: 50 },
  }, base);
  settle[CH['an_p_' + ps]] = settle[CH['hp_f_' + ps]] - settle[CH['kn_f_' + ps]];
  kb.push(t5, settle);
  const rec = P({ [s]: { hp_f: 34, kn_f: 60, hp_a: 9 } }, base); flatFeet(rec);
  kb.push(t6, rec);
  kb.push(t7, P({}, base));

  const meta = {
    contact: { kind: p.surface, side: s, t: tc, T: [tx, ty, tz] },
    plant: style === 'hop' ? [] : [{ foot: ps, t0: 0, t1: tc + 0.24 }],
    power, style, kind: 'kick', surface: p.surface,
  };
  if (style === 'hop') meta.air = { t0: tc - 0.16, t1: tc + 0.16, peak: 0.10 + 0.08 * power };
  return { duration: t7, loop: false, keys: kb.keys, events: { contact: tc, release: tc + 0.05 }, meta };
}

/** Register a kick family variation. */
export function regKick(id, name, cat, params, tags = []) {
  register({ id, name, cat, tags: ['kick', params.surface, params.leg === 'L' ? 'left' : 'right', ...tags], params: { ...params }, dur: params.tc + 0.62, build: () => makeKick(params) });
}

const SURF_NAME = { instep: 'Instep (Kuda)', inside: 'Inside foot (Sila)', outside: 'Outside foot (Cara)', toe: 'Toe scoop (Cungkil)', heel: 'Heel flick', sole: 'Sole stop' };
const LEGN = { L: 'left', R: 'right' };

export function registerKicks() {
  // ---- SERVES (tekong): surface x leg x power x target style ----
  // Ball is tossed by the tosser and struck around waist-chest height a little in front of the tekong.
  const serveSurf = ['instep', 'inside', 'outside', 'toe'];
  const powers = { soft: 0.42, medium: 0.7, power: 1.0 };
  const lines = { line: [0.04, 0.05], cross: [0.16, -0.02], inner: [-0.12, -0.02] };
  for (const surface of serveSurf) for (const leg of ['R', 'L']) for (const [pn, pw] of Object.entries(powers)) for (const [ln, [lx, dz]] of Object.entries(lines)) {
    const sd = sideSign(leg);
    const T = surface === 'toe' ? [sd * 0.02, 0.32, 0.42 + dz] : [sd * (0.06 + lx * 0.5), surface === 'instep' ? 0.98 : 0.86, 0.36 + dz];
    regKick(`serve.${surface}.${leg}.${pn}.${ln}`, `Serve - ${SURF_NAME[surface]} ${LEGN[leg]} foot, ${pn}, ${ln}`, 'serve', { leg, surface, T, power: pw, tc: 0.52 - 0.1 * pw, style: 'stand', base: READY }, ['tekong', pn, ln]);
  }
  // ---- DIGS / RECEIVES: heights x lateral x surface x leg ----
  const rHeights = [0.22, 0.42, 0.62, 0.82, 1.02];
  const rLat = [-0.34, 0, 0.34];
  const rSurf = ['inside', 'instep', 'outside'];
  for (const surface of rSurf) for (const leg of ['R', 'L']) for (const h of rHeights) for (const lx of rLat) {
    const sd = sideSign(leg);
    const style = h < 0.4 ? 'lunge' : 'stand';
    const T = [lx, h, 0.38 + (h < 0.4 ? 0.16 : 0)];
    regKick(`recv.foot.${surface}.${leg}.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `Receive - ${SURF_NAME[surface]} ${LEGN[leg]}, h${Math.round(h * 100)}cm, ${lx < 0 ? 'right' : lx > 0 ? 'left' : 'centre'}`, 'receive', { leg, surface, T, power: 0.35, tc: 0.27, style, base: READY, backswing: 0.3, follow: 0.6 }, ['dig', 'foot']);
  }
  // ---- SETS / LIFTS (tosser) with the foot: inside foot and instep, high & quick, forward/back
  const sHeights = [0.55, 0.85, 1.15];
  for (const surface of ['inside', 'instep']) for (const leg of ['R', 'L']) for (const h of sHeights) for (const lx of [-0.3, 0, 0.3]) {
    regKick(`set.foot.${surface}.${leg}.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `Set - ${SURF_NAME[surface]} ${LEGN[leg]}, h${Math.round(h * 100)}cm`, 'set', { leg, surface, T: [lx, h, 0.4], power: 0.3, tc: 0.27, style: 'stand', base: READY, backswing: 0.25, follow: 0.5 }, ['lift', 'foot']);
  }
  // ---- GROUND ATTACKS (killer, ball at hip-chest height for quick attacks) & clearances
  for (const surface of ['instep', 'inside', 'outside', 'toe']) for (const leg of ['R', 'L']) for (const h of [0.7, 1.0, 1.3]) for (const lx of [-0.3, 0.0, 0.3]) {
    regKick(`atk.kick.${surface}.${leg}.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `Quick attack - ${SURF_NAME[surface]} ${LEGN[leg]}, h${Math.round(h * 100)}cm`, 'attack', { leg, surface, T: [lx, h, 0.42], power: 0.9, tc: 0.31, style: h > 1 ? 'hop' : 'stand', base: READY }, ['quick', 'ground']);
  }
}
