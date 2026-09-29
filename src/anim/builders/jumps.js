// Airborne skills: spikes ("libas"): kuda, gulung (roll/sunback), gunting (scissor), sila, cara, kilas,
// roda (cartwheel), plus blocks. Rotation channels (pitch/yaw/roll) are authored unwrapped and
// wrapped to (-pi, pi] by the animator, so full flips blend correctly.
import * as THREE from 'three';
import { P, CH } from '../pose.js';
import { READY, STANCE_LOW, STANDING, HAND, KB, flatFeet, solveLeg, other, sideSign, D2R, clampN, LEN } from '../authoring.js';
import { register } from '../clip.js';

const LEGN = { L: 'left', R: 'right' };
const TYPE_NAME = { kuda: 'Libas Kuda (overhead instep)', gulung: 'Libas Gulung (roll spike)', gunting: 'Libas Gunting (scissor)', sila: 'Libas Sila (inside foot)', cara: 'Libas Cara (outside foot)', kilas: 'Libas Kilas (spin)', roda: 'Libas Roda (cartwheel)', tumit: 'Libas Tumit (heel)' };
const SURF_OF = { kuda: 'instep', gulung: 'instep', gunting: 'instep', sila: 'inside', cara: 'outside', kilas: 'instep', roda: 'instep', tumit: 'heel' };
const SURF_OFF = { instep: [0, 0.052, 0.085], inside: [-0.108, -0.01, 0.05], outside: [0.108, -0.01, 0.05], heel: [0, -0.02, -0.125] };

/** Height of the root above the ground at clip time t for a clip with meta.air (parabola). */
export function airHeight(meta, t) {
  const a = meta.air; if (!a) return 0;
  if (t <= a.t0 || t >= a.t1) return 0;
  const u = (t - a.t0) / (a.t1 - a.t0);
  return a.peak * 4 * u * (1 - u);
}

/**
 * p: {type, leg, T:[x,y,z] ball relative to the take-off spot, peak (m), air (s), approach:'straight'|'left'|'right'}
 */
export function makeJumpAttack(p) {
  const s = p.leg, ps = other(s), sd = sideSign(s);
  const type = p.type;
  const surf = SURF_OF[type];
  const peak = p.peak ?? 0.62, air = p.air ?? (0.36 + 0.62 * Math.sqrt(peak / 4.9) * 1.0);   // ballistic-ish airtime
  const T = new THREE.Vector3(...p.T);
  const appr = p.approach === 'left' ? 1 : p.approach === 'right' ? -1 : 0;
  const base = READY;
  const kb = new KB(base);
  const tj = 0.30, tland = tj + air;
  const uc = type === 'gulung' ? 0.56 : type === 'kilas' ? 0.55 : 0.50;
  const tc = tj + air * uc;
  const meta = { air: { t0: tj, t1: tland, peak }, kind: 'jump', type, surface: surf, contact: { kind: surf, side: s, t: tc, T: p.T }, power: 1, style: 'jump', wrapAt: tland };
  const hJ = (t) => { const u = (t - tj) / air; return u <= 0 || u >= 1 ? 0 : peak * 4 * u * (1 - u); };
  const Tp = T.clone().sub(new THREE.Vector3(0, hJ(tc), 0));   // ball in the (jump-following) root frame
  const yawToRad = Math.atan2(T.x, Math.max(0.15, T.z));
  const yawTo = yawToRad / D2R;   // degrees for P()
  const rot = p.rot ?? 0;

  // 0: approach stride
  const k0 = P({ pitch: 9, spine: [8, 0, appr * 6], LR: { hp_f: 24, kn_f: 40, hp_a: 5 }, [s]: { sh_f: -30, el_f: 90 }, [ps]: { sh_f: 40, el_f: 90 }, yaw: appr * 8 }, STANDING); flatFeet(k0);
  kb.push(0, k0);
  // 1: plant / load (deep crouch, arms swing back)
  const k1 = P({ pitch: 22, hz: 0.03, spine: [20, 0, appr * 8], chest: [4, 0, 0], neck: [-18, 0, 0], yaw: appr * 14,
    LR: { hp_f: 72, kn_f: 100, hp_a: 12, sh_f: -46, sh_a: 20, el_f: 30, ...HAND.open } }, base); flatFeet(k1);
  kb.push(tj * 0.55, k1);
  // 2: take-off (extend, arms drive up)
  const k2 = P({ pitch: type === 'gulung' ? -18 : 2, spine: [-4, 0, 0], chest: [-6, 0, 0], neck: [-10, 0, 0], yaw: 0,
    LR: { hp_f: 4, kn_f: 8, an_p: 52, sh_f: 148, sh_a: 24, el_f: 12, ...HAND.open } }, base);
  kb.push(tj, k2);
  // 3: rise / cock the striking leg
  const rp = type === 'gulung' ? -70 : type === 'gunting' ? -35 : type === 'kuda' ? -12 : 0;
  const k3 = P({ pitch: rp, yaw: type === 'kilas' ? -sd * 40 : 0, roll: type === 'roda' ? -sd * 60 : 0, spine: [-6, 0, 0], neck: [-6, 0, 0],
    [s]: { hp_f: 62, kn_f: 112, an_p: 40, hp_a: 10, sh_f: 90, sh_a: 60, el_f: 30 },
    [ps]: { hp_f: 8, kn_f: 60, an_p: 24, hp_a: 4, sh_f: 120, sh_a: 50, el_f: 26 } }, base);
  kb.push(tj + air * (uc - 0.24), k3);
  // 4: contact (solved)
  const pitchC = type === 'gulung' ? -(190 + rot) : type === 'gunting' ? -88 : type === 'kuda' || type === 'sila' || type === 'cara' ? -(14 + clampN((T.y - 2.2) * 40, 0, 20)) : type === 'kilas' ? -8 : type === 'tumit' ? -30 : -6;
  const kc = P({ pitch: pitchC, yaw: type === 'kilas' ? sd * 100 : yawTo * 0.6, roll: type === 'roda' ? -sd * 190 : 0,
    spine: [type === 'gulung' ? 12 : -10, 0, type === 'kilas' ? sd * 40 : 0], chest: [type === 'gulung' ? 12 : -6, 0, 0], neck: [-4, 0, 0],
    LR: { sh_f: 30, sh_a: 82, el_f: 20, ...HAND.open },
    [s]: { hp_r: surf === 'inside' ? 38 : surf === 'outside' ? -24 : -6, an_p: surf === 'inside' ? -4 : surf === 'heel' ? -18 : 50, an_i: surf === 'inside' ? 14 : surf === 'outside' ? -18 : 0 },
    [ps]: { hp_f: type === 'gunting' ? -32 : type === 'gulung' ? 100 : 10, kn_f: type === 'gunting' ? 30 : type === 'gulung' ? 100 : 55, hp_a: 16, an_p: 40 } }, base);
  const offV = new THREE.Vector3(...SURF_OFF[surf]);
  // pelvis frame rotation is included by solveLeg; ankle target ~ ball minus foot offset (rotated toward shot)
  const ankle = Tp.clone().sub(new THREE.Vector3(offV.x, offV.y, offV.z)                .applyAxisAngle(new THREE.Vector3(0, 1, 0), yawToRad).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.5));
  solveLeg(kc, s, ankle, { pole: [sd * 0.3, 0, 1] });
  kb.push(tc, kc, 1.25);
  // 5: follow-through
  const fpitch = type === 'gulung' ? -(250 + rot) : type === 'gunting' ? -120 : pitchC - 12;
  const kf = P({ pitch: fpitch, yaw: type === 'kilas' ? sd * 210 : yawTo * 0.4, roll: type === 'roda' ? -sd * 300 : 0, spine: [4, 0, 0], neck: [10, 0, 0],
    LR: { sh_f: 20, sh_a: 70, el_f: 30 }, [s]: { hp_f: 40, kn_f: 30, an_p: 30 }, [ps]: { hp_f: 40, kn_f: 50 } }, base);
  kb.push(tc + air * 0.16, kf);
  // 6: prepare to land (legs reach down)
  const endRot = type === 'gulung' ? -360 : type === 'roda' ? 0 : 0;
  const kl0 = P({ pitch: type === 'gulung' ? -330 : type === 'gunting' ? -30 : 10, yaw: type === 'kilas' ? sd * 335 : 0, roll: type === 'roda' ? -sd * 340 : 0,
    LR: { hp_f: 16, kn_f: 12, an_p: 42, sh_f: 30, sh_a: 60, el_f: 40 } }, base);
  kb.push(tland - 0.05, kl0);
  // 7: landing absorb
  const kl = P({ pitch: type === 'gulung' ? -360 + 24 : type === 'roda' ? 0 : 24, yaw: type === 'kilas' ? sd * 360 : 0, roll: type === 'roda' ? -sd * 360 : 0, spine: [26, 0, 0], neck: [-14, 0, 0],
    LR: { hp_f: 78, kn_f: 108, hp_a: 12, sh_f: 46, sh_a: 42, el_f: 60, ...HAND.relaxed } }, base); flatFeet(kl);
  kb.push(tland + 0.04, kl, 0.6);
  const kr = P({ pitch: type === 'gulung' ? -360 : 0, yaw: type === 'kilas' ? sd * 360 : 0, roll: type === 'roda' ? -sd * 360 : 0 }, base);
  kb.push(tland + 0.26, kr);
  kb.push(tland + 0.5, P({ pitch: type === 'gulung' ? -360 : 0, yaw: type === 'kilas' ? sd * 360 : 0, roll: type === 'roda' ? -sd * 360 : 0 }, base));
  meta.plant = [];
  return { duration: tland + 0.5, loop: false, keys: kb.keys, events: { takeoff: tj, contact: tc, land: tland }, meta };
}

/** Block: jump at the net; contact with foot/knee/chest/head above the net line. */
export function makeBlock(p) {
  const s = p.leg || 'R', ps = other(s), sd = sideSign(s);
  const peak = p.peak ?? 0.5, air = 0.36 + 0.62 * Math.sqrt(peak / 4.9);
  const T = new THREE.Vector3(...p.T);
  const tj = 0.24, tland = tj + air, tc = tj + air * 0.5;
  const base = READY, kb = new KB(base);
  const meta = { air: { t0: tj, t1: tland, peak }, kind: 'block', type: p.type, surface: p.type === 'head' ? 'head' : p.type === 'chest' ? 'chest' : 'sole', contact: { kind: p.type === 'head' ? 'head' : p.type === 'chest' ? 'chest' : 'sole', side: s, t: tc, T: p.T }, style: 'jump' };
  kb.at(0, {});
  const load = P({ spine: [16, 0, 0], neck: [-14, 0, 0], LR: { hp_f: 56, kn_f: 90, hp_a: 10, sh_f: 20, sh_a: 34, el_f: 60 } }, base); flatFeet(load); kb.push(tj * 0.55, load);
  const up = P({ spine: [-2, 0, 0], neck: [-6, 0, 0], LR: { hp_f: 6, kn_f: 10, an_p: 50, sh_f: 130, sh_a: 34, el_f: 20, ...HAND.open } }, base); kb.push(tj, up);
  const Tp = T.clone().sub(new THREE.Vector3(0, airHeight(meta, tc), 0));
  let contact;
  if (p.type === 'foot') {
    contact = P({ pitch: -10, spine: [-10, 0, 0], neck: [-8, 0, 0], LR: { sh_f: 60, sh_a: 78, el_f: 30, ...HAND.open }, [ps]: { hp_f: 6, kn_f: 40, an_p: 40, hp_a: 8 }, [s]: { an_p: -30, an_i: 0, hp_r: 6 } }, base);
    solveLeg(contact, s, Tp.clone().add(new THREE.Vector3(0, 0.09, 0)), { pole: [sd * 0.3, 0, 1] });
  } else if (p.type === 'double') {
    contact = P({ pitch: -22, spine: [-6, 0, 0], neck: [-8, 0, 0], LR: { sh_f: 40, sh_a: 80, el_f: 20, hp_f: 74, hp_a: 30, kn_f: 20, an_p: -20, ...HAND.open } }, base);
  } else if (p.type === 'head') {
    contact = P({ pitch: 4, spine: [14, 0, 0], neck: [18, 0, 0], LR: { hp_f: 18, kn_f: 50, an_p: 40, sh_f: 60, sh_a: 60, el_f: 20, ...HAND.open } }, base); flatFeet(contact); contact[CH.an_p_L] = contact[CH.an_p_R] = 45 * D2R;
  } else { // chest
    contact = P({ pitch: 8, spine: [-12, 0, 0], chest: [-14, 0, 0], neck: [-4, 0, 0], LR: { hp_f: 40, kn_f: 80, an_p: 30, sh_f: 50, sh_a: 80, el_f: 20, ...HAND.open } }, base);
  }
  kb.push(tc, contact, 1.1);
  const land = P({ spine: [22, 0, 0], neck: [-12, 0, 0], LR: { hp_f: 70, kn_f: 100, hp_a: 12, sh_f: 40, sh_a: 34, el_f: 60 } }, base); flatFeet(land);
  kb.push(tland + 0.04, land, 0.6);
  kb.push(tland + 0.28, P({}, base));
  meta.plant = [];
  return { duration: tland + 0.28, loop: false, keys: kb.keys, events: { takeoff: tj, contact: tc, land: tland }, meta };
}

export function registerJumps() {
  // ---- SPIKES: type x leg x approach x height class ----
  const types = ['kuda', 'gulung', 'gunting', 'sila', 'cara', 'kilas', 'roda', 'tumit'];
  const heights = [{ n: 'low', T: 2.30, peak: 0.50 }, { n: 'mid', T: 2.55, peak: 0.66 }, { n: 'high', T: 2.80, peak: 0.84 }];
  const approaches = ['straight', 'left', 'right'];
  for (const type of types) for (const leg of ['R', 'L']) for (const h of heights) for (const approach of approaches) {
    const sd = sideSign(leg);
    if ((type === 'roda') && approach === 'straight') continue;
    const T = [sd * (type === 'gulung' ? 0.02 : 0.10) + (approach === 'left' ? 0.15 : approach === 'right' ? -0.15 : 0), h.T, type === 'gulung' ? 0.18 : 0.34];
    const params = { type, leg, T, peak: h.peak, approach };
    register({ id: `atk.${type}.${leg}.${h.n}.${approach}`, name: `${TYPE_NAME[type]} - ${LEGN[leg]} leg, ${h.n} set, ${approach} approach`, cat: 'attack', tags: ['spike', 'libas', type, LEGN[leg]], params: { kind: 'jump', ...params }, dur: 1.3, build: () => makeJumpAttack(params) });
  }
  // ---- BLOCKS: type x leg x height x lateral reach ----
  const btypes = ['foot', 'double', 'head', 'chest'];
  for (const type of btypes) for (const leg of ['R', 'L']) for (const [hn, peak, Ty] of [['low', 0.36, 1.85], ['mid', 0.52, 2.05], ['high', 0.70, 2.25]]) for (const lx of [-0.25, 0, 0.25]) {
    if ((type === 'double' || type === 'head' || type === 'chest') && leg === 'L') continue;
    const params = { type, leg, T: [lx, Ty, 0.26], peak };
    register({ id: `block.${type}.${leg}.${hn}.x${Math.round(lx * 100)}`, name: `Block - ${type} ${type === 'foot' ? LEGN[leg] : ''} ${hn}, ${lx < 0 ? 'right' : lx > 0 ? 'left' : 'centre'}`, cat: 'block', tags: ['block', type], params: { kind: 'block', ...params }, dur: 1.0, build: () => makeBlock(params) });
  }
}
