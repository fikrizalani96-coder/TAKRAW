// Ground-level saves: slides, diving headers, leg splits, back-falls, plus rolls and get-ups.
// Root translation over the dive is declared in meta.travel and applied by the game.
import * as THREE from 'three';
import { P, CH } from '../pose.js';
import { READY, STANCE_LOW, HAND, KB, flatFeet, solveLeg, other, sideSign, D2R } from '../authoring.js';
import { register } from '../clip.js';

const DIRN = { fwd: 'forward', left: 'left', right: 'right', back: 'backward' };
const rotYv = (v, a) => new THREE.Vector3(v.x * Math.cos(a) + v.z * Math.sin(a), v.y, -v.x * Math.sin(a) + v.z * Math.cos(a));

function recoverKeys(kb, t, kind, roll, pitchEnd = 0) {
  // rise from the floor: 'up' (push off hands to a crouch) or 'roll' (roll through to a crouch)
  if (kind === 'roll') {
    const a = kb.at(t + 0.12, { pitch: 40, spine: [40, 0, 0], neck: [24, 0, 0], LR: { hp_f: 88, kn_f: 120, sh_f: 90, el_f: 60, sh_a: 20 } }); flatFeet(a);
    const b = kb.at(t + 0.30, { pitch: 30, spine: [30, 0, 0], LR: { hp_f: 82, kn_f: 118, sh_f: 60, el_f: 70 } }); flatFeet(b);
  } else {
    const a = kb.at(t + 0.14, { pitch: 20, spine: [34, 0, 0], neck: [-6, 0, 0], LR: { hp_f: 92, kn_f: 122, sh_f: 70, sh_a: 25, el_f: 40 } }); flatFeet(a);
  }
  const b = kb.at(t + 0.44, { spine: [22, 0, 0], LR: { hp_f: 62, kn_f: 96, sh_f: 40, sh_a: 26, el_f: 70 } }); flatFeet(b);
  kb.at(t + 0.70, {});
}

/** kind: slide|dive|split|backfall. dir relative to the player's facing. */
export function makeDive(p) {
  const { kind, dir, leg } = p;
  const s = leg || 'R', ps = other(s), sd = sideSign(s);
  const T = new THREE.Vector3(...p.T);
  const tc = p.tc ?? 0.34;
  const kb = new KB(READY);
  const dv = dir === 'fwd' ? [0, 1] : dir === 'back' ? [0, -1] : dir === 'left' ? [1, 0] : [-1, 0];
  const dist = p.dist ?? (kind === 'split' ? 0.55 : kind === 'dive' ? 1.0 : 0.85);
  const meta = { kind: 'dive', dive: kind, dir, contact: { kind: p.surface, side: s, t: tc, T: p.T }, travel: { t0: 0.10, t1: tc + 0.28, dx: dv[0] * dist, dz: dv[1] * dist }, style: 'dive', plant: [], air: null, power: 0.4 };
  kb.at(0, {});
  const lateral = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
  const along = dir === 'fwd' ? 1 : dir === 'back' ? -1 : 0;
  let rec = p.recover || 'up';
  if (kind === 'slide') {
    kb.at(0.14, { spine: [22, lateral * -6, 0], roll: lateral * -12, LR: { hp_f: 70, kn_f: 110, hp_a: 12, sh_a: 40, sh_f: 30, el_f: 50 } });
    const c = P({ pitch: along * -30 + (dir === 'back' ? 10 : 0), roll: lateral * -75 + (along ? 0 : 0), yaw: along === 0 ? lateral * 0 : 0, hx: 0, spine: [10, lateral * 18, 0], chest: [0, lateral * 10, 0], neck: [-6, 0, 0],
      LR: { sh_a: 64, sh_f: 20, el_f: 16 }, [ps]: { hp_f: 78, kn_f: 118, hp_a: 12 } }, READY);
    const tgt = T.clone().sub(new THREE.Vector3(0, 0, 0));
    solveLeg(c, s, tgt.clone().sub(new THREE.Vector3(0, 0, 0.09)), { pole: [sd * 0.2, 0.2, 1] });
    c[CH['an_p_' + s]] = 40 * D2R; c[CH['hp_r_' + s]] = (p.surface === 'inside' ? 34 : -6) * D2R;
    kb.push(tc, c, 1.2);
    kb.at(tc + 0.14, { pitch: along * -32, roll: lateral * -80, spine: [10, lateral * 20, 0], LR: { sh_a: 60, el_f: 30 }, [s]: { hp_f: 40, kn_f: 30 }, [ps]: { hp_f: 70, kn_f: 100 } });
  } else if (kind === 'dive') {
    kb.at(0.12, { pitch: 20, spine: [20, 0, 0], LR: { hp_f: 68, kn_f: 100, sh_f: 20, sh_a: 30 } });
    const c = P({ pitch: along >= 0 ? 78 : -70, roll: lateral * -70, spine: [-14, 0, 0], neck: [-28, 0, 0], head: [-10, 0, 0], LR: { sh_f: 165, sh_a: 20, el_f: 8, hp_f: -18, kn_f: 22, an_p: 50, ...HAND.open }, face: { jaw: 0.3 } }, READY);
    kb.push(tc, c, 1.15);
    kb.at(tc + 0.2, { pitch: along >= 0 ? 86 : -78, roll: lateral * -76, spine: [-8, 0, 0], neck: [-22, 0, 0], LR: { sh_f: 150, sh_a: 30, el_f: 30, hp_f: -6, kn_f: 30 } });
    rec = p.recover || 'roll';
  } else if (kind === 'split') {
    kb.at(0.12, { spine: [14, 0, 0], LR: { hp_f: 60, kn_f: 96, hp_a: 20, sh_a: 46, sh_f: 30, el_f: 60 } });
    const c = P({ spine: [12, 0, 0], neck: [-10, 0, 0], LR: { sh_a: 66, sh_f: 24, el_f: 20 } }, READY);
    // legs split: leading leg abducts sideways (or forward for fwd)
    if (lateral !== 0) { c[CH['hp_a_' + (lateral > 0 ? 'L' : 'R')]] = 88 * D2R; c[CH['hp_a_' + (lateral > 0 ? 'R' : 'L')]] = 70 * D2R; c[CH['hp_f_L']] = c[CH['hp_f_R']] = 6 * D2R; c[CH['kn_f_L']] = c[CH['kn_f_R']] = 4 * D2R; c[CH['hp_r_' + (lateral > 0 ? 'L' : 'R')]] = 30 * D2R; c[CH.pitch] = 0; c[CH.roll] = 0; c[CH.hy] = -0.3; }
    else { c[CH['hp_f_' + s]] = 84 * D2R; c[CH['hp_f_' + ps]] = -68 * D2R; c[CH['kn_f_' + s]] = 4 * D2R; c[CH['kn_f_' + ps]] = 28 * D2R; c[CH.pitch] = 12 * D2R; c[CH.hy] = -0.3; }
    c[CH['an_p_' + s]] = 20 * D2R;
    kb.push(tc, c, 1.2);
    kb.at(tc + 0.2, { spine: [18, 0, 0], LR: { hp_f: 20, hp_a: 80, kn_f: 10, sh_a: 50, sh_f: 30 } });
    rec = 'up';
  } else { // backfall: fall backwards scooping the ball with the heel/instep
    kb.at(0.12, { spine: [-4, 0, 0], LR: { hp_f: 40, kn_f: 60, sh_a: 40, sh_f: 30 }, pitch: -8 });
    const c = P({ pitch: -58, spine: [-16, 0, 0], neck: [-18, 0, 0], LR: { sh_f: 60, sh_a: 66, el_f: 20, ...HAND.open }, [ps]: { hp_f: 70, kn_f: 100 } }, READY);
    solveLeg(c, s, T.clone(), { pole: [sd * 0.2, 0, 1] });
    kb.push(tc, c, 1.2);
    kb.at(tc + 0.2, { pitch: -78, spine: [-10, 0, 0], LR: { sh_f: 70, sh_a: 60, hp_f: 60, kn_f: 40 } });
    rec = 'roll';
  }
  recoverKeys(kb, tc + 0.22, rec === 'roll' ? 'roll' : 'up');
  meta.plant = [];
  return { duration: tc + 0.22 + 0.70, loop: false, keys: kb.keys, events: { contact: tc, release: tc + 0.05 }, meta };
}

export function registerGround() {
  // slides: 4 dirs x 2 legs x 2 heights x 2 recoveries x 2 surfaces = 64 -> keep 48 (inside/instep)
  for (const dir of ['fwd', 'left', 'right', 'back']) for (const leg of ['R', 'L']) for (const [hn, h] of [['floor', 0.12], ['low', 0.30]]) for (const recover of ['up', 'roll']) {
    const sd = sideSign(leg);
    const lat = dir === 'left' ? 0.85 : dir === 'right' ? -0.85 : 0;
    const T = [lat, h, dir === 'fwd' ? 1.0 : dir === 'back' ? -0.7 : 0.15];
    const params = { kind: 'slide', dir, leg, T, recover, surface: 'instep', tc: 0.34 };
    register({ id: `dive.slide.${dir}.${leg}.${hn}.${recover}`, name: `Sliding save ${DIRN[dir]} with ${leg === 'L' ? 'left' : 'right'} foot (${hn}), recover ${recover}`, cat: 'dive', tags: ['slide', dir], params: { ...params, kind2: 'dive' }, dur: 1.26, build: () => makeDive(params) });
  }
  for (const dir of ['fwd', 'left', 'right']) for (const [hn, h] of [['low', 0.35], ['mid', 0.6]]) for (const recover of ['up', 'roll']) {
    const lat = dir === 'left' ? 1.1 : dir === 'right' ? -1.1 : 0;
    const params = { kind: 'dive', dir, leg: 'R', T: [lat, h, dir === 'fwd' ? 1.2 : 0.2], recover, surface: 'head', tc: 0.36, dist: 1.3 };
    register({ id: `dive.head.${dir}.${hn}.${recover}`, name: `Diving header ${DIRN[dir]} (${hn}), recover ${recover}`, cat: 'dive', tags: ['dive', 'header', dir], params: { ...params, kind2: 'dive' }, dur: 1.3, build: () => makeDive(params) });
  }
  for (const dir of ['left', 'right', 'fwd']) for (const leg of ['R', 'L']) for (const [hn, h] of [['floor', 0.1], ['low', 0.22]]) {
    const lat = dir === 'left' ? 0.95 : dir === 'right' ? -0.95 : 0;
    const params = { kind: 'split', dir, leg, T: [lat, h, dir === 'fwd' ? 0.9 : 0.1], surface: 'inside', tc: 0.32 };
    register({ id: `dive.split.${dir}.${leg}.${hn}`, name: `Leg-split save ${DIRN[dir]} (${leg === 'L' ? 'left' : 'right'} lead, ${hn})`, cat: 'dive', tags: ['split', dir], params: { ...params, kind2: 'dive' }, dur: 1.24, build: () => makeDive(params) });
  }
  for (const leg of ['R', 'L']) for (const [hn, h] of [['low', 0.5], ['mid', 0.8]]) for (const recover of ['up', 'roll']) {
    const params = { kind: 'backfall', dir: 'back', leg, T: [0, h, -0.4], recover, surface: 'heel', tc: 0.32 };
    register({ id: `dive.backfall.${leg}.${hn}.${recover}`, name: `Back-fall heel save (${leg === 'L' ? 'left' : 'right'}, ${hn}), recover ${recover}`, cat: 'dive', tags: ['backfall'], params: { ...params, kind2: 'dive' }, dur: 1.24, build: () => makeDive(params) });
  }

  // ---- rolls & get-ups ----
  const seq = (id, name, dur, keys, meta = {}) => register({ id, name, cat: 'dive', tags: ['recovery'], params: { kind: 'recovery' }, dur, build: () => {
    const kb = new KB(READY); kb.at(0, {});
    for (const [t, d] of keys) { const k = kb.at(t, d); flatFeet(k); }
    return { duration: dur, loop: false, keys: kb.keys, events: {}, meta: { kind: 'recovery', ...meta } };
  } });
  seq('recover.roll.fwd.a', 'Forward roll to feet', 0.9, [[0.15, { pitch: 30, spine: [40, 0, 0], LR: { hp_f: 80, kn_f: 110, sh_f: 100, el_f: 30 } }], [0.4, { pitch: 190, spine: [50, 0, 0], neck: [30, 0, 0], LR: { hp_f: 100, kn_f: 130, sh_f: 30, el_f: 90 } }], [0.65, { pitch: 340, spine: [35, 0, 0], LR: { hp_f: 90, kn_f: 118, sh_f: 40, el_f: 80 } }], [0.9, { pitch: 360 }]]);
  seq('recover.roll.fwd.b', 'Tucked forward roll, spring up', 0.8, [[0.12, { pitch: 40, spine: [50, 0, 0], LR: { hp_f: 90, kn_f: 120, sh_f: 110 } }], [0.34, { pitch: 200, spine: [56, 0, 0], neck: [36, 0, 0], LR: { hp_f: 110, kn_f: 140 } }], [0.56, { pitch: 350, spine: [30, 0, 0], LR: { hp_f: 70, kn_f: 100, sh_f: 60 } }], [0.8, { pitch: 360 }]]);
  seq('recover.roll.back', 'Backward roll to feet', 0.9, [[0.2, { pitch: -40, spine: [30, 0, 0], LR: { hp_f: 70, kn_f: 100, sh_f: 30 } }], [0.45, { pitch: -190, spine: [50, 0, 0], neck: [30, 0, 0], LR: { hp_f: 110, kn_f: 138 } }], [0.72, { pitch: -350, spine: [30, 0, 0], LR: { hp_f: 70, kn_f: 100 } }], [0.9, { pitch: -360 }]]);
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1;
    seq('recover.roll.side.' + s, `Shoulder roll to ${s === 'L' ? 'left' : 'right'}`, 0.85, [[0.18, { roll: k * -30, spine: [30, k * 6, 0], LR: { hp_f: 70, kn_f: 100, sh_f: 60 } }], [0.42, { roll: k * -180, spine: [30, 0, 0], LR: { hp_f: 100, kn_f: 130 } }], [0.68, { roll: k * -340, spine: [26, 0, 0], LR: { hp_f: 70, kn_f: 100 } }], [0.85, { roll: k * -360 }]]);
  }
  for (const [v, spd] of [['a', 0.8], ['b', 1.0], ['c', 0.65]]) {
    seq('recover.getup.prone.' + v, `Get up from lying face-down (${v})`, 1.3 / spd, [[0.25 / spd, { pitch: 82, spine: [-6, 0, 0], LR: { sh_f: 150, el_f: 60, hp_f: 8 } }], [0.6 / spd, { pitch: 55, spine: [10, 0, 0], LR: { sh_f: 100, el_f: 70, hp_f: 90, kn_f: 130 } }], [0.95 / spd, { pitch: 26, spine: [30, 0, 0], LR: { hp_f: 78, kn_f: 112, sh_f: 60, el_f: 70 } }], [1.3 / spd, {}]]);
  }
  for (const [v, spd] of [['a', 0.85], ['b', 1.0]]) {
    seq('recover.getup.back.' + v, `Get up from lying on back (${v})`, 1.3 / spd, [[0.3 / spd, { pitch: -70, spine: [30, 0, 0], LR: { sh_f: 30, el_f: 70, hp_f: 100, kn_f: 130 } }], [0.7 / spd, { pitch: -30, spine: [36, 0, 0], LR: { hp_f: 100, kn_f: 130, sh_f: 50 } }], [1.0 / spd, { pitch: 10, spine: [28, 0, 0], LR: { hp_f: 78, kn_f: 112 } }], [1.3 / spd, {}]]);
  }
  seq('recover.kipup', 'Kip-up to feet', 0.8, [[0.2, { pitch: -85, spine: [10, 0, 0], LR: { hp_f: 110, kn_f: 60, sh_f: 20 } }], [0.4, { pitch: -300, spine: [0, 0, 0], LR: { hp_f: 6, kn_f: 12, sh_f: 80, an_p: 40 } }], [0.62, { pitch: -350, spine: [22, 0, 0], LR: { hp_f: 70, kn_f: 100 } }], [0.8, { pitch: -360 }]]);
}
