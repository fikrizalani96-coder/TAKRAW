// Tosser's one-handed service toss, tekong service prep, and ball-handling clips
// (catching, presenting, bouncing, spinning).
import * as THREE from 'three';
import { P, CH } from '../pose.js';
import { READY, STANDING, STANCE_LOW, HAND, KB, flatFeet, solveArm, other, sideSign, D2R } from '../authoring.js';
import { register } from '../clip.js';

/** One-handed underarm toss. hand: 'R'|'L'; loft 0..1 (0 low, 1 high); dist 0..1 (near..far). */
export function makeToss(p) {
  const s = p.hand, os = other(s), sd = sideSign(s);
  const loft = p.loft ?? 0.5, dist = p.dist ?? 0.5;
  const tr = 0.36;                                   // release time
  const kb = new KB(READY);
  const holdHand = { ...HAND.cup };
  const hold = P({ hz: 0.0, spine: [10, 0, sd * 6], chest: [2, 0, 0], neck: [-10, 0, -sd * 6],
    [s]: { sh_f: 46, sh_a: 12, el_f: 96, fa_p: -50, wr_f: -10, ...holdHand }, [os]: { sh_f: 30, sh_a: 20, el_f: 80, ...HAND.relaxed },
    LR: { hp_f: 30, kn_f: 50, hp_a: 8 } }, READY); flatFeet(hold);
  kb.push(0, hold);
  // dip: knees load, ball hand swings down-back
  const dip = P({ hz: -0.02, spine: [16, 0, sd * 10], chest: [4, 0, sd * 8], neck: [-12, 0, -sd * 8],
    [s]: { sh_f: -14 - 12 * dist, sh_a: 14, el_f: 30, fa_p: -30, wr_f: 0, ...holdHand }, [os]: { sh_f: 44, sh_a: 22, el_f: 70, ...HAND.relaxed },
    LR: { hp_f: 44 + 12 * loft, kn_f: 74 + 14 * loft, hp_a: 9 } }, READY); flatFeet(dip);
  kb.push(tr * 0.5, dip);
  // release: legs drive, arm swings through and up, palm up
  const rel = P({ hz: 0.03, spine: [-2, 0, -sd * 8], chest: [-2, 0, -sd * 6], neck: [-6, 0, sd * 4],
    [s]: { sh_f: 72 + 46 * loft + 12 * dist, sh_a: 10, el_f: 8 + 20 * (1 - loft), fa_p: -40, wr_f: 12, ...HAND.flat }, [os]: { sh_f: 50, sh_a: 30, el_f: 60, ...HAND.relaxed },
    LR: { hp_f: 16, kn_f: 22 - 10 * loft, an_p: 28 * loft, hp_a: 8 } }, READY);
  kb.push(tr, rel, 1.3);
  const fol = P({ spine: [-4, 0, -sd * 4], neck: [-8, 0, 0], [s]: { sh_f: 100 + 40 * loft, sh_a: 12, el_f: 6, fa_p: -30, wr_f: 20, ...HAND.open }, [os]: { sh_f: 40, sh_a: 30, el_f: 60 }, LR: { hp_f: 12, kn_f: 14 } }, READY);
  kb.push(tr + 0.16, fol);
  const back = P({ [s]: { sh_f: 50, sh_a: 16, el_f: 70, ...HAND.relaxed }, LR: { hp_f: 30, kn_f: 50 } }, READY); flatFeet(back);
  kb.push(tr + 0.5, back);
  kb.push(tr + 0.8, P({}, READY));
  const T = [sd * 0.16, 1.15 + 0.28 * loft, 0.33 + 0.1 * loft];
  return { duration: tr + 0.8, loop: false, keys: kb.keys, events: { contact: tr, release: tr }, meta: { contact: { kind: 'hand', side: s, t: tr, T }, plant: [{ foot: 'L', t0: 0, t1: tr + 0.3 }, { foot: 'R', t0: 0, t1: tr + 0.3 }], kind: 'toss', holdBone: 'hand_' + s.toLowerCase(), power: 0.2 } };
}

/** Two-hand catch at chest height. */
function makeCatch(h) {
  const kb = new KB(READY);
  kb.at(0, {});
  kb.at(0.14, { spine: [8, 0, 0], LR: { sh_f: 76 + 20 * h, sh_a: 30, el_f: 36, fa_p: 30, ...HAND.open } });
  kb.at(0.28, { spine: [6, 0, 0], LR: { sh_f: 62 + 20 * h, sh_a: 12, el_f: 62, fa_p: 20, ...HAND.grip } });
  kb.at(0.5, { LR: { sh_f: 44, sh_a: 16, el_f: 84, ...HAND.grip } });
  kb.at(0.8, {});
  return { duration: 0.8, loop: false, keys: kb.keys, events: { contact: 0.24 }, meta: { kind: 'catch', contact: { kind: 'hand', side: null, t: 0.24 } } };
}

export function registerToss() {
  // 2 hands x 4 lofts x 3 distances = 24 tosses
  for (const hand of ['R', 'L']) for (const [ln, loft] of [['low', 0.1], ['medium', 0.45], ['high', 0.8], ['lob', 1.0]]) for (const [dn, dist] of [['near', 0.1], ['mid', 0.5], ['far', 0.95]]) {
    const params = { hand, loft, dist };
    register({ id: `toss.${hand}.${ln}.${dn}`, name: `One-hand service toss (${hand === 'L' ? 'left' : 'right'} hand, ${ln}, ${dn})`, cat: 'toss', tags: ['toss', 'tosser'], params: { kind: 'toss', ...params }, dur: 1.16, build: () => makeToss(params) });
  }
  // catches
  for (const [n, h] of [['low', 0], ['chest', 0.5], ['high', 1]]) register({ id: 'ball.catch.' + n, name: `Two-hand catch (${n})`, cat: 'ball', tags: ['catch'], params: { kind: 'catch' }, dur: 0.8, build: () => makeCatch(h) });
  // ball presentation & routine
  const loopSeq = (id, name, dur, keys, cat = 'ball') => register({ id, name, cat, tags: ['loop'], params: { kind: 'ball' }, dur, loop: true, build: () => {
    const kb = new KB(READY); for (const [t, d] of keys) { const k = kb.at(t, d); flatFeet(k); }
    return { duration: dur, loop: true, keys: kb.keys, events: {}, meta: { kind: 'ball' } };
  } });
  loopSeq('ball.hold.ready.R', 'Holding ball at hip (right hand)', 2, [[0, { R: { sh_f: 40, el_f: 92, fa_p: -50, ...HAND.cup } }], [1, { R: { sh_f: 43, el_f: 94, fa_p: -50, ...HAND.cup }, spine: [16, 0, 2] }]]);
  loopSeq('ball.hold.ready.L', 'Holding ball at hip (left hand)', 2, [[0, { L: { sh_f: 40, el_f: 92, fa_p: -50, ...HAND.cup } }], [1, { L: { sh_f: 43, el_f: 94, fa_p: -50, ...HAND.cup }, spine: [16, 0, -2] }]]);
  loopSeq('ball.hold.chest', 'Holding ball at chest', 2, [[0, { LR: { sh_f: 58, sh_a: 14, el_f: 96, ...HAND.grip } }], [1, { LR: { sh_f: 60, sh_a: 14, el_f: 98, ...HAND.grip }, chest: [2, 0, 0] }]]);
  loopSeq('ball.bounce.hand.R', 'Bouncing ball on the palm (right)', 0.8, [[0, { R: { sh_f: 46, el_f: 96, ...HAND.flat } }], [0.4, { R: { sh_f: 40, el_f: 70, ...HAND.flat } }]]);
  loopSeq('ball.bounce.hand.L', 'Bouncing ball on the palm (left)', 0.8, [[0, { L: { sh_f: 46, el_f: 96, ...HAND.flat } }], [0.4, { L: { sh_f: 40, el_f: 70, ...HAND.flat } }]]);
  loopSeq('ball.spin.finger', 'Spinning ball on a fingertip', 2, [[0, { R: { sh_f: 100, sh_a: 20, el_f: 70, wr_f: -10, ...HAND.point } }], [1, { R: { sh_f: 104, sh_a: 22, el_f: 66, wr_f: -8, ...HAND.point } }]]);
  const one = (id, name, dur, keys) => register({ id, name, cat: 'ball', tags: ['ball'], params: { kind: 'ball' }, dur, build: () => { const kb = new KB(READY); for (const [t, d] of keys) { const k = kb.at(t, d); flatFeet(k); } return { duration: dur, loop: false, keys: kb.keys, events: {}, meta: { kind: 'ball' } }; } });
  one('ball.pickup.ground', 'Pick the ball up from the floor', 1.1, [[0, {}], [0.3, { spine: [46, 0, 0], neck: [10, 0, 0], LR: { hp_f: 70, kn_f: 96, sh_f: 30 } }], [0.5, { spine: [60, 0, 0], R: { sh_f: 60, el_f: 20, ...HAND.grip }, LR: { hp_f: 80, kn_f: 100 } }], [0.85, { spine: [20, 0, 0], R: { sh_f: 46, el_f: 90, ...HAND.grip } }], [1.1, { R: { sh_f: 42, el_f: 94, ...HAND.grip } }]]);
  one('ball.present.referee', 'Present the ball to the referee', 1.2, [[0, {}], [0.4, { LR: { sh_f: 56, sh_a: 26, el_f: 70, ...HAND.cup }, spine: [8, 0, 0] }], [0.8, { LR: { sh_f: 62, sh_a: 26, el_f: 40, ...HAND.cup }, spine: [8, 0, 0] }], [1.2, {}]]);
  one('ball.give.hand', 'Hand the ball to a teammate', 1.0, [[0, { R: { sh_f: 44, el_f: 94, ...HAND.grip } }], [0.4, { R: { sh_f: 70, el_f: 40, ...HAND.cup } }], [0.7, { R: { sh_f: 74, el_f: 30, ...HAND.open } }], [1.0, {}]]);
  one('ball.examine', 'Inspect the ball', 1.6, [[0, {}], [0.5, { LR: { sh_f: 56, sh_a: 10, el_f: 100, ...HAND.grip }, neck: [24, 0, 0], head: [10, 0, 0] }], [1.1, { LR: { sh_f: 56, sh_a: 10, el_f: 100, ...HAND.grip }, neck: [24, 0, 0], head: [10, 0, 6] }], [1.6, {}]]);
  one('ball.throw.overhand', 'Throw the ball back to the referee (overhand)', 1.0, [[0, {}], [0.3, { R: { sh_f: -20, sh_a: 60, el_f: 100, ...HAND.grip }, spine: [-4, 0, -14] }], [0.42, { R: { sh_f: 130, sh_a: 20, el_f: 10, ...HAND.open }, spine: [10, 0, 16] }], [1.0, {}]]);

  // ---- tekong pre-service stances (foot in the circle) ----
  for (const [n, nm, base, kick] of [['a', 'Feet together, staring at the target', READY, 'R'], ['b', 'Long stride, rocking', STANCE_LOW, 'R'], ['c', 'Rear foot in circle, front foot tap', READY, 'L'], ['d', 'Deep breath, shoulders back', READY, 'R'], ['e', 'Squared up, hands loose', STANCE_LOW, 'L'], ['f', 'Wide stance, calling the toss', READY, 'R']]) {
    for (const flip of [false, true]) register({ id: `serve.prep.${n}${flip ? '.m' : ''}`, name: `Service stance: ${nm}${flip ? ' (mirrored)' : ''}`, cat: 'serve', tags: ['prep', 'loop'], params: { kind: 'prep' }, dur: 3, loop: true, build: () => {
      const kb = new KB(base);
      const ps = other(kick);
      const mk = (t, d) => { const k = kb.at(t, { spine: [12, 0, 0], neck: [-10, 0, 0], ...d }); flatFeet(k); return k; };
      mk(0, { [kick]: { hp_f: 20, kn_f: 44 }, [ps]: { hp_f: 34, kn_f: 60 } });
      mk(1.0, { hz: 0.02, [kick]: { hp_f: 24 + (n === 'c' ? 20 : 0), kn_f: 48 + (n === 'c' ? 30 : 0) }, [ps]: { hp_f: 36, kn_f: 64 }, spine: [16, 0, 2] });
      mk(2.0, { [kick]: { hp_f: 20, kn_f: 44 }, [ps]: { hp_f: 34, kn_f: 60 }, spine: [10, 0, -2] });
      let c = { duration: 3, loop: true, keys: kb.keys, events: {}, meta: { kind: 'prep', plant: [] } };
      if (flip) c.keys = c.keys.map((k) => ({ t: k.t, pose: (() => { const q = new Float32Array(k.pose); return q; })() }));
      return c;
    } });
  }
}
