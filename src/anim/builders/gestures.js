// Emotion, celebration, warm-up, official-signal and freestyle families. Data-driven: each entry
// is a short key list; the generator adds mirrored (L/R) and intensity variants.
import { P, CH, mirrorPose, scalePoseAbout } from '../pose.js';
import { READY, STANDING, STANCE_LOW, HAND, KB, flatFeet, D2R } from '../authoring.js';
import { register } from '../clip.js';

const SIDES = { L: 'left', R: 'right' };

function seqClip(base, keys, dur, loop, meta = {}, events = {}) {
  const kb = new KB(base);
  for (const [t, d, o] of keys) { const k = kb.at(t, d, o); if (!d.__noflat) flatFeet(k); }
  return { duration: dur, loop, keys: kb.keys, events, meta: { kind: 'gesture', ...meta } };
}
function mirrorClip(c) { return { ...c, keys: c.keys.map((k) => ({ t: k.t, pose: mirrorPose(k.pose), k: k.k })) }; }
function intensity(c, base, k) { return { ...c, keys: c.keys.map((kk) => { const p = new Float32Array(kk.pose.length); scalePoseAbout(p, kk.pose, base, k); return { t: kk.t, pose: p, k: kk.k }; }) }; }

function add(id, name, cat, tags, dur, build, loop = false) {
  register({ id, name, cat, tags: [...tags, ...(loop ? ['loop'] : [])], params: { kind: 'gesture' }, dur, loop, build });
}
/** Register a one-sided gesture as R, L (mirror) and 3 intensities where it makes sense. */
function addSided(id, name, cat, tags, dur, fn, { intens = true, loop = false } = {}) {
  for (const s of ['R', 'L']) {
    for (const [iname, ik] of intens ? [['mild', 0.7], ['strong', 1.0], ['wild', 1.3]] : [['', 1]]) {
      const suffix = `${s}${iname ? '.' + iname : ''}`;
      add(`${id}.${suffix}`, `${name} (${SIDES[s]}${iname ? ', ' + iname : ''})`, cat, tags, dur, () => {
        let c = fn('R', ik);
        if (ik !== 1) c = intensity(c, c.keys[0].pose, ik);
        return s === 'L' ? mirrorClip(c) : c;
      }, loop);
    }
  }
}

export function registerGestures() {
  const B = STANDING;
  // =============== CELEBRATIONS ===============
  addSided('cel.fistpump', 'Fist pump', 'celebrate', ['joy'], 1.3, () => seqClip(B, [
    [0, {}], [0.18, { spine: [-4, 0, 0], R: { sh_f: 40, el_f: 100, ...HAND.fist } }], [0.34, { spine: [-8, 0, 6], head: [-10, 0, 0], R: { sh_f: 150, sh_a: 30, el_f: 60, ...HAND.fist }, face: { jaw: 0.7, smile: 0.5 } }],
    [0.52, { spine: [4, 0, 0], R: { sh_f: 70, el_f: 110, ...HAND.fist }, face: { jaw: 0.5, smile: 0.5 } }], [0.7, { spine: [-8, 0, 6], R: { sh_f: 154, sh_a: 34, el_f: 50, ...HAND.fist }, face: { jaw: 0.8, smile: 0.6 } }], [1.0, { R: { sh_f: 100, el_f: 90, ...HAND.fist }, face: { smile: 0.4 } }], [1.3, {}]], 1.3));
  add('cel.arms.up.v', 'Arms raised in a V', 'celebrate', ['joy'], 1.6, () => seqClip(B, [[0, {}], [0.3, { spine: [-6, 0, 0], neck: [-14, 0, 0], LR: { sh_f: 150, sh_a: 46, el_f: 14, ...HAND.open }, face: { jaw: 0.8, smile: 0.6 } }], [1.0, { spine: [-8, 0, 0], neck: [-18, 0, 0], LR: { sh_f: 160, sh_a: 52, el_f: 10, ...HAND.open }, face: { jaw: 0.6, smile: 0.7 } }], [1.6, {}]], 1.6));
  add('cel.arms.up.wild', 'Arms up, roaring', 'celebrate', ['joy'], 1.8, () => seqClip(B, [[0, {}], [0.25, { spine: [-10, 0, 0], neck: [-22, 0, 0], LR: { sh_f: 140, sh_a: 58, el_f: 40, ...HAND.fist }, face: { jaw: 1, smile: 0.2, brow: -0.6 } }], [0.9, { spine: [-14, 0, 0], neck: [-26, 0, 0], LR: { sh_f: 150, sh_a: 66, el_f: 60, ...HAND.fist }, face: { jaw: 0.9, brow: -0.6 } }], [1.8, {}]], 1.8));
  add('cel.arms.up.kneel', 'Kneeling, arms to the sky', 'celebrate', ['joy'], 2.0, () => seqClip(B, [[0, {}], [0.4, { spine: [10, 0, 0], LR: { hp_f: 60, kn_f: 110, sh_f: 40 } }], [0.8, { spine: [-14, 0, 0], neck: [-24, 0, 0], L: { hp_f: 90, kn_f: 100 }, R: { hp_f: -10, kn_f: 130 }, LR: { sh_f: 150, sh_a: 40, el_f: 20, ...HAND.open }, face: { jaw: 0.7 } }], [2.0, { spine: [-10, 0, 0], neck: [-18, 0, 0], L: { hp_f: 90, kn_f: 100 }, R: { hp_f: -10, kn_f: 130 }, LR: { sh_f: 154, sh_a: 42, el_f: 20 } }]], 2.0));
  addSided('cel.point.sky', 'Point to the sky', 'celebrate', ['joy', 'pray'], 1.8, () => seqClip(B, [[0, {}], [0.4, { neck: [-20, 0, 0], R: { sh_f: 150, sh_a: 20, el_f: 8, ...HAND.point } }], [1.2, { neck: [-24, 0, 0], R: { sh_f: 156, sh_a: 20, el_f: 6, ...HAND.point }, face: { smile: 0.4 } }], [1.8, {}]], 1.8), { intens: false });
  addSided('cel.chest.thump', 'Chest thump', 'celebrate', ['joy'], 1.4, () => seqClip(B, [[0, {}], [0.2, { R: { sh_f: 30, sh_a: 40, el_f: 100, ...HAND.fist } }], [0.34, { spine: [-6, 0, 0], R: { sh_f: 24, sh_a: 6, el_f: 128, ...HAND.fist }, face: { jaw: 0.5 } }], [0.5, { R: { sh_f: 30, sh_a: 40, el_f: 100, ...HAND.fist } }], [0.64, { spine: [-6, 0, 0], R: { sh_f: 24, sh_a: 6, el_f: 128, ...HAND.fist } }], [1.4, {}]], 1.4), { intens: false });
  for (const [n, nm, lr] of [['both', 'Double-biceps flex', true], ['R', 'Right-arm flex', false]]) add(`cel.flex.${n}`, nm, 'celebrate', ['joy', 'pose'], 1.8, () => seqClip(B, [[0, {}], [0.3, { spine: [-4, 0, 0], neck: [-8, 0, 0], ...(lr ? { LR: { sh_f: 20, sh_a: 90, el_f: 120, ...HAND.fist, fa_p: -20 } } : { R: { sh_f: 20, sh_a: 90, el_f: 125, ...HAND.fist }, L: { sh_a: 10, sh_f: 10 } }), face: { jaw: 0.4, brow: -0.6 } }], [1.4, { spine: [-6, 0, 0], neck: [-10, 0, 0], ...(lr ? { LR: { sh_f: 18, sh_a: 94, el_f: 126, ...HAND.fist } } : { R: { sh_f: 18, sh_a: 96, el_f: 130, ...HAND.fist } }) }], [1.8, {}]], 1.8));
  add('cel.bow', 'Bow to the crowd', 'celebrate', ['respect'], 2.0, () => seqClip(B, [[0, {}], [0.6, { spine: [48, 0, 0], neck: [10, 0, 0], LR: { sh_f: 12, sh_a: 6, el_f: 10 } }], [1.3, { spine: [48, 0, 0], LR: { sh_f: 12, sh_a: 6, el_f: 10 } }], [2.0, {}]], 2.0));
  add('cel.thanks.pray', 'Hands together in thanks (wai)', 'celebrate', ['respect', 'thai'], 2.0, () => seqClip(B, [[0, {}], [0.5, { spine: [10, 0, 0], neck: [12, 0, 0], LR: { sh_f: 58, sh_a: 4, el_f: 122, fa_p: 20, wr_f: -10, ...HAND.flat } }], [1.5, { spine: [22, 0, 0], neck: [18, 0, 0], LR: { sh_f: 62, sh_a: 2, el_f: 128, ...HAND.flat }, face: { smile: 0.5 } }], [2.0, {}]], 2.0));
  add('cel.salute', 'Salute to the fans', 'celebrate', ['respect'], 1.6, () => seqClip(B, [[0, {}], [0.3, { R: { sh_f: 60, sh_a: 60, el_f: 130, fa_p: 60, ...HAND.flat } }], [1.0, { R: { sh_f: 62, sh_a: 64, el_f: 134, fa_p: 60, ...HAND.flat }, face: { smile: 0.4 } }], [1.6, {}]], 1.6));
  add('cel.airplane', 'Running with arms out', 'celebrate', ['joy', 'loop'], 1.2, () => seqClip(B, [[0, { LR: { sh_a: 84, sh_f: 8, el_f: 6, ...HAND.open }, spine: [6, 0, 0], roll: 4 }], [0.6, { LR: { sh_a: 84, sh_f: 8, el_f: 6, ...HAND.open }, spine: [6, 0, 0], roll: -4 }]], 1.2, true), true);
  for (const dir of ['fwd', 'left', 'right']) add(`cel.kneeslide.${dir}`, `Knee slide ${dir}`, 'celebrate', ['joy', 'slide'], 1.6, () => {
    const lat = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    const c = seqClip(B, [[0, { LR: { sh_f: 20 } }], [0.18, { spine: [-4, 0, 0], neck: [-10, 0, 0], LR: { hp_f: 40, kn_f: 60, sh_f: 20, sh_a: 60 } }], [0.4, { spine: [-14, 0, 0], neck: [-22, 0, 0], L: { hp_f: 80, kn_f: 90 }, R: { hp_f: -20, kn_f: 130 }, LR: { sh_f: 130, sh_a: 62, el_f: 20, ...HAND.fist }, face: { jaw: 0.8 } }], [1.0, { spine: [-16, 0, 0], neck: [-24, 0, 0], L: { hp_f: 80, kn_f: 90 }, R: { hp_f: -20, kn_f: 130 }, LR: { sh_f: 130, sh_a: 62, el_f: 20, ...HAND.fist } }], [1.6, {}]], 1.6, false, { travel: { t0: 0.15, t1: 0.9, dx: lat * 2.0, dz: dir === 'fwd' ? 2.6 : 0.5 } });
    return c;
  });
  // flips (rotation in the air)
  for (const [n, nm, ch, sg] of [['back', 'Standing backflip', 'pitch', -1], ['front', 'Front flip', 'pitch', 1], ['side.L', 'Side flip (left)', 'roll', -1], ['side.R', 'Side flip (right)', 'roll', 1]]) add(`cel.flip.${n}`, nm, 'celebrate', ['joy', 'acrobatic'], 1.5, () => {
    const air = 0.7, t0 = 0.3, t1 = t0 + air;
    const rot = (a) => ({ [ch]: sg * a });
    const c = seqClip(B, [[0, {}], [t0 * 0.6, { ...rot(sg > 0 ? 10 : -14), spine: [16, 0, 0], LR: { hp_f: 70, kn_f: 100, sh_f: -40 } }], [t0, { ...rot(0), LR: { hp_f: 6, kn_f: 10, sh_f: 150, an_p: 50 } }],
      [t0 + air * 0.35, { ...rot(140), spine: [24, 0, 0], LR: { hp_f: 100, kn_f: 130, sh_f: 20, sh_a: 20, el_f: 60 } }], [t0 + air * 0.65, { ...rot(250), spine: [24, 0, 0], LR: { hp_f: 100, kn_f: 130, sh_f: 20, el_f: 60 } }], [t1 - 0.06, { ...rot(340), LR: { hp_f: 20, kn_f: 20, sh_f: 60 } }], [t1 + 0.05, { ...rot(360), spine: [24, 0, 0], LR: { hp_f: 70, kn_f: 104, sh_f: 60 } }], [t1 + 0.4, { ...rot(360) }]], t1 + 0.4, false,
      { air: { t0, t1, peak: 0.85 }, wrapAt: t1 });
    return c;
  });
  add('cel.cartwheel', 'Cartwheel', 'celebrate', ['joy', 'acrobatic'], 1.6, () => seqClip(B, [[0, {}], [0.2, { roll: -20, spine: [10, -10, 0], LR: { hp_f: 40, kn_f: 60, sh_f: 140, sh_a: 20 } }], [0.5, { roll: -170, LR: { hp_f: 4, hp_a: 80, kn_f: 4, sh_f: 170, sh_a: 10, el_f: 6 } }], [0.85, { roll: -330, LR: { hp_f: 40, kn_f: 60, sh_f: 100 } }], [1.1, { roll: -360, spine: [10, 0, 0] }], [1.6, { roll: -360 }]], 1.6, false, { air: { t0: 0.35, t1: 0.95, peak: 0.35 }, wrapAt: 0.98, travel: { t0: 0.15, t1: 1.0, dx: 1.4, dz: 0 } }));
  addSided('cel.jump.fist', 'Jump with a scream', 'celebrate', ['joy'], 1.2, () => seqClip(B, [[0, {}], [0.15, { spine: [16, 0, 0], LR: { hp_f: 60, kn_f: 90, sh_f: -20 } }], [0.3, { spine: [-8, 0, 0], neck: [-14, 0, 0], LR: { hp_f: 5, kn_f: 10, an_p: 50, sh_f: 130, sh_a: 30, el_f: 90, ...HAND.fist }, face: { jaw: 1 } }], [0.62, { LR: { hp_f: 20, kn_f: 30, sh_f: 120 } }], [0.72, { spine: [16, 0, 0], LR: { hp_f: 60, kn_f: 90, sh_f: 40 } }], [1.2, {}]], 1.2, false, { air: { t0: 0.3, t1: 0.68, peak: 0.42 } }), { intens: false });
  addSided('cel.jump.bump', 'Chest-bump jump', 'celebrate', ['joy', 'team'], 1.2, () => seqClip(B, [[0, {}], [0.15, { spine: [16, 0, 0], LR: { hp_f: 60, kn_f: 90, sh_f: -20 } }], [0.3, { spine: [-10, 0, 0], neck: [-6, 0, 0], LR: { hp_f: 8, kn_f: 20, an_p: 40, sh_f: 40, sh_a: 70, el_f: 60, ...HAND.fist }, R: { hp_f: 36, kn_f: 60 } }], [0.6, { spine: [-6, 0, 0], LR: { hp_f: 16, kn_f: 30, sh_f: 40, sh_a: 60 } }], [0.72, { spine: [16, 0, 0], LR: { hp_f: 60, kn_f: 90 } }], [1.2, {}]], 1.2, false, { air: { t0: 0.3, t1: 0.68, peak: 0.34 } }), { intens: false });
  for (const [n, hi] of [['up', 1], ['low', 0]]) addSided(`cel.highfive.${n}`, `High-five (${n})`, 'celebrate', ['team'], 1.2, () => seqClip(B, [[0, {}], [0.25, { R: { sh_f: hi ? 150 : 60, sh_a: 20, el_f: hi ? 20 : 40, ...HAND.open }, face: { smile: 0.6 } }], [0.5, { R: { sh_f: hi ? 158 : 64, sh_a: 20, el_f: 10, ...HAND.open } }], [1.2, {}]], 1.2), { intens: false });
  add('cel.hug', 'Open arms for a hug', 'celebrate', ['team'], 1.6, () => seqClip(B, [[0, {}], [0.4, { spine: [6, 0, 0], LR: { sh_f: 60, sh_a: 66, el_f: 46, ...HAND.open }, face: { smile: 0.7 } }], [1.0, { spine: [10, 0, 0], LR: { sh_f: 64, sh_a: 20, el_f: 90, ...HAND.grip } }], [1.6, {}]], 1.6));
  add('cel.huddle', 'Team huddle (arms over shoulders)', 'celebrate', ['team', 'loop'], 2.4, () => seqClip(STANCE_LOW, [[0, { spine: [30, 0, 0], neck: [10, 0, 0], LR: { sh_f: 80, sh_a: 34, el_f: 50, ...HAND.grip } }], [1.2, { spine: [34, 0, 0], neck: [12, 0, 0], LR: { sh_f: 84, sh_a: 34, el_f: 50, ...HAND.grip } }]], 2.4, true), true);
  addSided('cel.wave', 'Wave to the crowd', 'celebrate', ['respect'], 2.0, () => seqClip(B, [[0, {}], [0.3, { R: { sh_f: 140, sh_a: 34, el_f: 60, ...HAND.open }, face: { smile: 0.6 } }], [0.6, { R: { sh_f: 142, sh_a: 40, el_f: 66, wr_d: 18, ...HAND.open } }], [0.9, { R: { sh_f: 140, sh_a: 30, el_f: 56, wr_d: -18, ...HAND.open } }], [1.2, { R: { sh_f: 142, sh_a: 40, el_f: 66, wr_d: 18, ...HAND.open } }], [2.0, {}]], 2.0), { intens: false });
  add('cel.clap.overhead', 'Clapping overhead to the fans', 'celebrate', ['joy', 'loop'], 0.8, () => seqClip(B, [[0, { LR: { sh_f: 150, sh_a: 20, el_f: 60, ...HAND.flat }, face: { smile: 0.6 } }], [0.4, { LR: { sh_f: 158, sh_a: 4, el_f: 30, ...HAND.flat } }]], 0.8, true), true);
  add('cel.clap.front', 'Clapping in front', 'celebrate', ['joy', 'loop'], 0.7, () => seqClip(B, [[0, { LR: { sh_f: 62, sh_a: 20, el_f: 92, fa_p: 90, ...HAND.flat } }], [0.35, { LR: { sh_f: 62, sh_a: 2, el_f: 100, fa_p: 90, ...HAND.flat } }]], 0.7, true), true);
  add('cel.kissbadge', 'Kiss the badge', 'celebrate', ['joy'], 1.6, () => seqClip(B, [[0, {}], [0.3, { spine: [8, 0, 0], neck: [14, 0, 0], R: { sh_f: 40, sh_a: 20, el_f: 130, ...HAND.flat } }], [1.1, { spine: [12, 0, 0], neck: [18, 0, 0], R: { sh_f: 36, sh_a: 10, el_f: 140, ...HAND.flat }, face: { smile: 0.2 } }], [1.6, {}]], 1.6));
  // dances (loops)
  for (let i = 0; i < 6; i++) add(`cel.dance.${i + 1}`, `Celebration dance ${i + 1}`, 'celebrate', ['joy', 'dance', 'loop'], 1.6, () => {
    const f = 1 + i * 0.25, amp = 1 + (i % 3) * 0.3;
    const keys = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const s = Math.sin(a), c = Math.cos(a);
      keys.push([k * 0.2, { hx: 0.05 * s * amp, roll: 6 * s * amp, spine: [6, 0, 10 * s * amp], chest: [0, 0, -12 * s * amp], L: { hp_f: 20 + 12 * Math.max(0, c), kn_f: 30 + 26 * Math.max(0, c), hp_a: 8 + 6 * s, sh_f: 60 + 40 * s * f, sh_a: 30 + 20 * c, el_f: 90 }, R: { hp_f: 20 + 12 * Math.max(0, -c), kn_f: 30 + 26 * Math.max(0, -c), hp_a: 8 - 6 * s, sh_f: 60 - 40 * s * f, sh_a: 30 - 20 * c, el_f: 90 }, head: [0, 0, 0, 0], face: { smile: 0.6, jaw: 0.2 } }]);
    }
    return seqClip(B, keys, 1.6, true);
  }, true);

  // =============== REACTIONS (disappointment / frustration / communication) ===============
  add('react.hands.head', 'Hands on head in disbelief', 'react', ['sad'], 2.0, () => seqClip(B, [[0, {}], [0.35, { spine: [4, 0, 0], neck: [10, 0, 0], LR: { sh_f: 150, sh_a: 30, el_f: 120, sh_t: 40, ...HAND.grip }, face: { brow: 0.6 } }], [1.4, { spine: [8, 0, 0], neck: [14, 0, 0], LR: { sh_f: 154, sh_a: 34, el_f: 124, ...HAND.grip } }], [2.0, {}]], 2.0));
  add('react.hands.knees', 'Hands on knees, head down', 'react', ['sad', 'tired'], 2.4, () => seqClip(B, [[0, {}], [0.5, { spine: [36, 0, 0], chest: [14, 0, 0], neck: [20, 0, 0], LR: { hp_f: 44, kn_f: 40, sh_f: 60, sh_a: 12, el_f: 8 } }], [1.6, { spine: [40, 0, 0], chest: [16, 0, 0], neck: [24, 0, 0], LR: { hp_f: 46, kn_f: 42, sh_f: 62, el_f: 6 } }], [2.4, {}]], 2.4));
  add('react.kneel.punch', 'Kneel and slam the floor', 'react', ['sad', 'anger'], 2.2, () => seqClip(B, [[0, {}], [0.4, { spine: [30, 0, 0], neck: [16, 0, 0], L: { hp_f: 90, kn_f: 100 }, R: { hp_f: -10, kn_f: 125 }, LR: { sh_f: 50, el_f: 80 } }], [0.8, { spine: [40, 0, 0], neck: [20, 0, 0], L: { hp_f: 92, kn_f: 100 }, R: { hp_f: -10, kn_f: 125 }, R: { sh_f: 100, el_f: 70, ...HAND.fist }, face: { jaw: 0.6, brow: 0.5 } }], [1.0, { spine: [44, 0, 0], neck: [20, 0, 0], R: { hp_f: -10, kn_f: 125, sh_f: 30, el_f: 30, ...HAND.fist } }], [2.2, { spine: [40, 0, 0], neck: [22, 0, 0], R: { hp_f: -10, kn_f: 125, sh_f: 30, el_f: 30 } }]], 2.2));
  addSided('react.kick.ground', 'Kick the floor in frustration', 'react', ['anger'], 1.4, () => seqClip(B, [[0, {}], [0.2, { spine: [10, 0, 0], neck: [14, 0, 0], R: { hp_f: -14, kn_f: 60 } }], [0.34, { spine: [16, 0, 0], neck: [16, 0, 0], R: { hp_f: 34, kn_f: 20, an_p: 30 }, face: { brow: 0.7 } }], [1.4, {}]], 1.4), { intens: false });
  add('react.headshake', 'Shake head, hands on hips', 'react', ['sad'], 2.0, () => seqClip(B, [[0, {}], [0.3, { LR: { sh_a: 36, sh_f: -6, el_f: 105, fa_p: 60 }, neck: [10, 0, 0], head: [6, 0, 20] }], [0.6, { LR: { sh_a: 36, sh_f: -6, el_f: 105 }, head: [6, 0, -20] }], [0.9, { LR: { sh_a: 36, sh_f: -6, el_f: 105 }, head: [6, 0, 20] }], [1.2, { head: [6, 0, -14], LR: { sh_a: 36, el_f: 105 } }], [2.0, {}]], 2.0));
  add('react.slump', 'Slump shoulders, exhale', 'react', ['sad'], 2.2, () => seqClip(B, [[0, {}], [0.5, { spine: [22, 0, 0], neck: [24, 0, 0], head: [10, 0, 0], LR: { cl_e: -10, sh_f: 8 }, face: { jaw: 0.2 } }], [1.5, { spine: [20, 0, 0], neck: [22, 0, 0], LR: { cl_e: -8 } }], [2.2, {}]], 2.2));
  add('react.sit.down', 'Sit on the floor, head in hands', 'react', ['sad'], 2.8, () => seqClip(B, [[0, {}], [0.6, { spine: [30, 0, 0], LR: { hp_f: 90, kn_f: 130, sh_f: 40 } }], [1.4, { pitch: -20, spine: [40, 0, 0], neck: [30, 0, 0], LR: { hp_f: 100, kn_f: 120, sh_f: 70, el_f: 130, sh_t: 20 } }], [2.8, { pitch: -24, spine: [44, 0, 0], neck: [34, 0, 0], LR: { hp_f: 100, kn_f: 120, sh_f: 74, el_f: 132 } }]], 2.8));
  add('react.lieback', 'Lie back and stare at the ceiling', 'react', ['sad'], 2.8, () => seqClip(B, [[0, {}], [0.6, { pitch: -50, spine: [20, 0, 0], LR: { hp_f: 90, kn_f: 100, sh_f: 40 } }], [1.5, { pitch: -86, spine: [0, 0, 0], neck: [-6, 0, 0], LR: { hp_f: 0, kn_f: 4, sh_f: 30, sh_a: 20 } }], [2.8, { pitch: -88, LR: { hp_f: 0, kn_f: 4, sh_a: 24 } }]], 2.8));
  addSided('react.wipe.face', 'Wipe face with jersey', 'react', ['tired'], 1.6, () => seqClip(B, [[0, {}], [0.3, { spine: [8, 0, 0], neck: [14, 0, 0], R: { sh_f: 90, sh_a: 20, el_f: 120, ...HAND.grip }, L: { sh_f: 30, sh_a: 34, el_f: 80 } }], [0.7, { spine: [10, 0, 0], neck: [16, 0, 0], R: { sh_f: 98, sh_a: 26, el_f: 130 } }], [1.6, {}]], 1.6), { intens: false });
  addSided('react.arms.disbelief', 'Arms thrown out in disbelief', 'react', ['anger'], 1.4, () => seqClip(B, [[0, {}], [0.3, { spine: [-6, 0, 0], LR: { sh_f: 30, sh_a: 66, el_f: 70, ...HAND.open }, head: [0, 0, 10 * 1], face: { brow: 0.6, jaw: 0.3 } }], [0.9, { LR: { sh_f: 30, sh_a: 66, el_f: 70 } }], [1.4, {}]], 1.4));
  addSided('react.point.self', 'Point at self: my fault', 'react', ['apology'], 1.6, () => seqClip(B, [[0, {}], [0.3, { R: { sh_f: 50, sh_a: 10, el_f: 130, ...HAND.point }, neck: [10, 0, 0], face: { brow: 0.4 } }], [1.0, { R: { sh_f: 52, sh_a: 10, el_f: 134, ...HAND.point } }], [1.6, {}]], 1.6), { intens: false });
  addSided('react.apology', 'Raised hand apology', 'react', ['apology'], 1.4, () => seqClip(B, [[0, {}], [0.3, { spine: [6, 0, 0], neck: [10, 0, 0], R: { sh_f: 100, sh_a: 30, el_f: 90, ...HAND.open } }], [1.0, { spine: [8, 0, 0], R: { sh_f: 102, sh_a: 30, el_f: 90 } }], [1.4, {}]], 1.4), { intens: false });
  for (const [n, ang] of [['a', 20], ['b', 40], ['c', 60]]) add(`react.protest.${n}`, `Protest to the referee (${n})`, 'react', ['anger'], 1.8, () => seqClip(B, [[0, {}], [0.25, { spine: [4, 0, 0], head: [0, 0, ang * 0.3], R: { sh_f: 80, sh_a: 20 + ang * 0.4, el_f: 40, ...HAND.open }, face: { brow: 0.7, jaw: 0.5 } }], [0.6, { R: { sh_f: 90, sh_a: 20 + ang * 0.4, el_f: 20 } }], [1.0, { R: { sh_f: 78, sh_a: 30, el_f: 50 } }], [1.8, {}]], 1.8));
  add('react.turn.away', 'Turn away in disgust', 'react', ['anger'], 1.6, () => seqClip(B, [[0, {}], [0.5, { yaw: 30, spine: [4, 0, 20], neck: [8, 0, 25], LR: { sh_a: 30, el_f: 60 } }], [1.6, { yaw: 34, spine: [4, 0, 22], neck: [8, 0, 26] }]], 1.6));
  add('react.scream', 'Scream in frustration', 'react', ['anger'], 1.6, () => seqClip(B, [[0, {}], [0.25, { spine: [-8, 0, 0], neck: [-24, 0, 0], LR: { sh_f: 20, sh_a: 34, el_f: 100, ...HAND.fist }, face: { jaw: 1, brow: 0.8 } }], [1.0, { spine: [-10, 0, 0], neck: [-26, 0, 0], face: { jaw: 0.9, brow: 0.8 }, LR: { sh_f: 20, sh_a: 34, el_f: 100, ...HAND.fist } }], [1.6, {}]], 1.6));

  // =============== WARM-UP DRILLS (loops) ===============
  const loop = (id, name, dur, keys, base = B) => add(id, name, 'warmup', ['loop', 'drill'], dur, () => seqClip(base, keys, dur, true), true);
  for (const dir of ['fwd', 'back']) { const k = dir === 'fwd' ? 1 : -1; loop(`warm.armcircle.${dir}`, `Arm circles ${dir}`, 1.6, [0, 0.4, 0.8, 1.2].map((t, i) => [t, { LR: { sh_f: 90 + k * 90 * Math.sin(i * Math.PI / 2), sh_a: 88 * Math.abs(Math.cos(i * Math.PI / 2)) + 8, el_f: 6, ...HAND.open } }])); }
  for (const s of ['R', 'L']) { loop(`warm.legswing.front.${s}`, `Front leg swings (${SIDES[s]})`, 1.4, [[0, { [s]: { hp_f: -10, kn_f: 10 }, LR: { sh_a: 30 } }], [0.7, { [s]: { hp_f: 70, kn_f: 6 }, LR: { sh_a: 34 } }]]);
    loop(`warm.legswing.side.${s}`, `Side leg swings (${SIDES[s]})`, 1.4, [[0, { [s]: { hp_a: -8 }, LR: { sh_a: 60 } }], [0.7, { [s]: { hp_a: 46 }, LR: { sh_a: 60 } }]]);
    loop(`warm.quad.${s}`, `Quad stretch (${SIDES[s]})`, 3, [[0, { [s]: { hp_f: -16, kn_f: 140 }, [s === 'R' ? 'L' : 'R']: { kn_f: 6, hp_f: 4 }, spine: [4, 0, 0], [s]: { hp_f: -16, kn_f: 140, sh_f: -20, el_f: 90 } }], [1.5, { [s]: { hp_f: -18, kn_f: 144 }, spine: [6, 0, 0] }]]);
    loop(`warm.hamstring.${s}`, `Hamstring stretch (${SIDES[s]})`, 3, [[0, { spine: [50, 0, 0], neck: [10, 0, 0], [s]: { hp_f: 40, kn_f: 4, sh_f: 70 }, [s === 'R' ? 'L' : 'R']: { hp_f: 40, kn_f: 60 } }], [1.5, { spine: [54, 0, 0], [s]: { hp_f: 44, kn_f: 4, sh_f: 74 }, [s === 'R' ? 'L' : 'R']: { hp_f: 44, kn_f: 64 } }]]);
    loop(`warm.calf.${s}`, `Calf stretch (${SIDES[s]})`, 3, [[0, { spine: [14, 0, 0], [s]: { hp_f: -14, kn_f: 4 }, [s === 'R' ? 'L' : 'R']: { hp_f: 50, kn_f: 80 }, LR: { sh_f: 56, el_f: 40 } }], [1.5, { spine: [18, 0, 0], [s]: { hp_f: -16, kn_f: 4 }, [s === 'R' ? 'L' : 'R']: { hp_f: 54, kn_f: 86 }, LR: { sh_f: 58, el_f: 40 } }]]);
    loop(`warm.lunge.${s}`, `Walking lunge (${SIDES[s]})`, 1.6, [[0, { L: { hp_f: 4 }, R: { hp_f: 4 } }], [0.8, { [s]: { hp_f: 78, kn_f: 90 }, [s === 'R' ? 'L' : 'R']: { hp_f: -30, kn_f: 100 }, LR: { sh_f: 30, el_f: 90 }, spine: [4, 0, 0] }]]); }
  loop('warm.twist', 'Torso twists', 1.6, [[0, { spine: [4, 0, 26], chest: [0, 0, 24], LR: { sh_f: 60, sh_a: 20, el_f: 90 } }], [0.8, { spine: [4, 0, -26], chest: [0, 0, -24], LR: { sh_f: 60, sh_a: 20, el_f: 90 } }]]);
  loop('warm.hipcircle', 'Hip circles', 2, [[0, { hx: 0.08, hz: 0, LR: { sh_a: 20, sh_f: 20, el_f: 80 } }], [0.5, { hx: 0, hz: 0.08 }], [1, { hx: -0.08, hz: 0 }], [1.5, { hx: 0, hz: -0.08 }]]);
  loop('warm.squat', 'Bodyweight squats', 1.6, [[0, { LR: { sh_f: 80, el_f: 10 } }], [0.8, { spine: [26, 0, 0], LR: { hp_f: 92, kn_f: 122, sh_f: 86, el_f: 10 } }]]);
  loop('warm.highknees', 'High knees', 0.5, [[0, { L: { hp_f: 90, kn_f: 100 }, R: { hp_f: 4, kn_f: 8 }, LR: { sh_f: 40, el_f: 90 } }], [0.25, { R: { hp_f: 90, kn_f: 100 }, L: { hp_f: 4, kn_f: 8 }, LR: { sh_f: 40, el_f: 90 } }]]);
  loop('warm.buttkicks', 'Butt kicks', 0.5, [[0, { L: { hp_f: 4, kn_f: 130 }, R: { hp_f: 10, kn_f: 10 }, LR: { sh_f: 30, el_f: 90 } }], [0.25, { R: { hp_f: 4, kn_f: 130 }, L: { hp_f: 10, kn_f: 10 }, LR: { sh_f: 30, el_f: 90 } }]]);
  loop('warm.jacks', 'Jumping jacks', 0.8, [[0, { LR: { hp_a: 2, sh_a: 8, sh_f: 4 } }], [0.4, { LR: { hp_a: 20, sh_a: 150, sh_f: 4, an_p: 30 } }]]);
  loop('warm.toetouch', 'Toe touches', 2.2, [[0, { LR: { sh_f: 165 } }], [1.1, { spine: [70, 0, 0], neck: [20, 0, 0], LR: { sh_f: 40, el_f: 4, hp_f: 20 } }]]);
  loop('warm.neckroll', 'Neck rolls', 2.4, [[0, { neck: [16, 0, 0], head: [0, 0, 0] }], [0.6, { neck: [0, 0, 0], head: [0, 20, 0] }], [1.2, { neck: [-14, 0, 0] }], [1.8, { neck: [0, 0, 0], head: [0, -20, 0] }]]);
  loop('warm.shrug', 'Shoulder shrugs', 1.0, [[0, { LR: { cl_e: 16 } }], [0.5, { LR: { cl_e: -4 } }]]);
  loop('warm.skip', 'Skipping', 0.7, [[0, { L: { hp_f: 70, kn_f: 90 }, R: { hp_f: 0, kn_f: 10 }, LR: { sh_f: 40, el_f: 90 } }], [0.35, { R: { hp_f: 70, kn_f: 90 }, L: { hp_f: 0, kn_f: 10 }, LR: { sh_f: 40, el_f: 90 } }]]);
  loop('warm.plyo', 'Plyometric squat jumps', 1.0, [[0, { spine: [22, 0, 0], LR: { hp_f: 70, kn_f: 100, sh_f: -30 } }], [0.5, { LR: { hp_f: 4, kn_f: 8, sh_f: 140, an_p: 50 } }]]);
  loop('warm.sidestep', 'Lateral band-walk', 1.2, [[0, { LR: { hp_f: 34, kn_f: 60, hp_a: 22, sh_f: 50, el_f: 90 } }], [0.6, { LR: { hp_f: 34, kn_f: 60, hp_a: 8, sh_f: 50, el_f: 90 } }]], READY);
  loop('warm.sprintdrill', 'A-skip drill', 0.6, [[0, { L: { hp_f: 80, kn_f: 100, an_p: -20 }, R: { hp_f: -10, kn_f: 8 }, LR: { sh_f: 50, el_f: 90 } }], [0.3, { R: { hp_f: 80, kn_f: 100 }, L: { hp_f: -10, kn_f: 8 }, LR: { sh_f: 50, el_f: 90 } }]]);
  loop('warm.hop.single', 'Single-leg hops', 0.8, [[0, { L: { hp_f: 20, kn_f: 30 }, R: { hp_f: 60, kn_f: 100 } }], [0.4, { L: { hp_f: 4, kn_f: 8, an_p: 40 }, R: { hp_f: 40, kn_f: 90 } }]]);
}

// =============== OFFICIALS ===============
export function registerOfficials() {
  const B = STANDING;
  const o = (id, name, dur, keys, loop = false, extra = {}) => register({ id, name, cat: 'official', tags: ['official', ...(loop ? ['loop'] : [])], params: { kind: 'official' }, dur, loop, build: () => seqClip(B, keys, dur, loop, extra) });
  o('ref.idle', 'Referee waiting (arms folded behind)', 3, [[0, { LR: { sh_f: -10, sh_a: 14, el_f: 60, fa_p: 30 }, spine: [-2, 0, 0] }], [1.5, { LR: { sh_f: -12, sh_a: 14, el_f: 62 }, spine: [-3, 0, 0] }]], true);
  o('ref.stand.chair', 'Umpire seated, watching play', 3, [[0, { LR: { hp_f: 92, kn_f: 92, an_p: 0, sh_f: 20, sh_a: 12, el_f: 90, fa_p: 40 }, spine: [4, 0, 0] }], [1.5, { LR: { hp_f: 92, kn_f: 92, sh_f: 22, el_f: 92 }, spine: [6, 0, 0], head: [0, 0, 8] }]], true, { seated: true });
  for (const s of ['L', 'R']) {
    o(`ref.point.serve.${s}`, `Point toward the serving side (${SIDES[s]})`, 1.6, [[0, {}], [0.3, { [s]: { sh_f: 74, sh_a: 12, el_f: 12, ...HAND.flat, fa_p: 30 } }], [1.1, { [s]: { sh_f: 78, sh_a: 12, el_f: 8, ...HAND.flat } }], [1.6, {}]]);
    o(`ref.point.award.${s}`, `Award the point: arm out to ${SIDES[s]} side`, 1.8, [[0, {}], [0.3, { [s]: { sh_f: 20, sh_a: 84, el_f: 8, ...HAND.flat, fa_p: 0 }, spine: [-2, 0, 0] }], [1.3, { [s]: { sh_f: 20, sh_a: 88, el_f: 6, ...HAND.flat } }], [1.8, {}]]);
    o(`ref.hand.raise.${s}`, `Raise ${SIDES[s]} hand to stop play`, 1.4, [[0, {}], [0.25, { [s]: { sh_f: 150, sh_a: 10, el_f: 8, ...HAND.flat } }], [1.0, { [s]: { sh_f: 152, sh_a: 10, el_f: 6, ...HAND.flat } }], [1.4, {}]]);
    o(`ref.whistle.${s}`, `Blow the whistle (${SIDES[s]} hand)`, 1.2, [[0, {}], [0.2, { neck: [10, 0, 0], [s]: { sh_f: 40, sh_a: 20, el_f: 130, ...HAND.grip }, face: { jaw: 0.1 } }], [0.7, { neck: [8, 0, 0], [s]: { sh_f: 40, sh_a: 20, el_f: 132 } }], [1.2, {}]]);
    o(`ref.signal.net.${s}`, `Signal: net touch (${SIDES[s]})`, 1.8, [[0, {}], [0.3, { [s]: { sh_f: 70, sh_a: 22, el_f: 90, ...HAND.flat } }], [0.7, { [s]: { sh_f: 76, sh_a: 10, el_f: 10, ...HAND.flat } }], [1.1, { [s]: { sh_f: 70, sh_a: 22, el_f: 90 } }], [1.8, {}]]);
    o(`ref.signal.foul.${s}`, `Signal: fault to the ${SIDES[s]} team`, 1.8, [[0, {}], [0.3, { [s]: { sh_f: 30, sh_a: 80, el_f: 90, ...HAND.point } }], [1.4, { [s]: { sh_f: 30, sh_a: 86, el_f: 10, ...HAND.point } }], [1.8, {}]]);
    o(`ref.signal.out.${s}`, `Signal: ball out (${SIDES[s]})`, 1.6, [[0, {}], [0.3, { [s]: { sh_f: 90, sh_a: 70, el_f: 10, ...HAND.flat } }], [0.7, { [s]: { sh_f: 90, sh_a: 20, el_f: 10, ...HAND.flat } }], [1.0, { [s]: { sh_f: 90, sh_a: 70, el_f: 10 } }], [1.6, {}]]);
    o(`ref.signal.toomany.${s}`, `Signal: too many touches (${SIDES[s]})`, 1.8, [[0, {}], [0.3, { [s]: { sh_f: 80, sh_a: 20, el_f: 60, h_ix: 0, h_md: 0, h_rg: 0, h_pk: 1, h_th: 1, h_sp: 0.5 } }], [1.4, { [s]: { sh_f: 82, sh_a: 20, el_f: 58, h_ix: 0, h_md: 0, h_rg: 0, h_pk: 1, h_th: 1 } }], [1.8, {}]]);
    o(`ref.card.${s}`, `Show a card (${SIDES[s]} hand)`, 1.6, [[0, {}], [0.3, { [s]: { sh_f: 140, sh_a: 20, el_f: 20, ...HAND.grip } }], [1.2, { [s]: { sh_f: 144, sh_a: 20, el_f: 16, ...HAND.grip } }], [1.6, {}]]);
    o(`ref.beckon.${s}`, `Beckon the players (${SIDES[s]})`, 1.4, [[0, {}], [0.25, { [s]: { sh_f: 60, sh_a: 20, el_f: 60, ...HAND.open } }], [0.5, { [s]: { sh_f: 60, sh_a: 20, el_f: 110, ...HAND.grip } }], [0.75, { [s]: { sh_f: 60, sh_a: 20, el_f: 60, ...HAND.open } }], [1.4, {}]]);
    o(`ref.handshake.${s}`, `Offer handshake (${SIDES[s]} hand)`, 1.6, [[0, {}], [0.3, { [s]: { sh_f: 60, sh_a: 10, el_f: 40, ...HAND.flat, fa_p: -20 }, spine: [4, 0, 0], face: { smile: 0.4 } }], [1.2, { [s]: { sh_f: 62, sh_a: 10, el_f: 36, ...HAND.flat } }], [1.6, {}]]);
    o(`line.flag.up.${s}`, `Line judge: flag up - in (${SIDES[s]})`, 1.8, [[0, { [s]: { sh_f: 20, sh_a: 10, el_f: 20, ...HAND.grip } }], [0.4, { [s]: { sh_f: 150, sh_a: 10, el_f: 10, ...HAND.grip } }], [1.4, { [s]: { sh_f: 152, sh_a: 10, el_f: 8, ...HAND.grip } }], [1.8, { [s]: { sh_f: 20, sh_a: 10, el_f: 20, ...HAND.grip } }]]);
    o(`line.flag.out.${s}`, `Line judge: flag horizontal - out (${SIDES[s]})`, 1.8, [[0, { [s]: { sh_f: 20, sh_a: 10, el_f: 20, ...HAND.grip } }], [0.4, { [s]: { sh_f: 20, sh_a: 88, el_f: 8, ...HAND.grip } }], [1.4, { [s]: { sh_f: 20, sh_a: 90, el_f: 6, ...HAND.grip } }], [1.8, { [s]: { sh_f: 20, sh_a: 10, el_f: 20, ...HAND.grip } }]]);
    o(`line.flag.cross.${s}`, `Line judge: flag across - net fault (${SIDES[s]})`, 1.8, [[0, { [s]: { sh_f: 20, sh_a: 10, el_f: 20, ...HAND.grip } }], [0.4, { [s]: { sh_f: 60, sh_a: -40, el_f: 40, ...HAND.grip } }], [1.4, { [s]: { sh_f: 62, sh_a: -44, el_f: 36, ...HAND.grip } }], [1.8, { [s]: { sh_f: 20, sh_a: 10, el_f: 20 } }]]);
    o(`line.flag.idle.${s}`, `Line judge standing with flag (${SIDES[s]})`, 3, [[0, { [s]: { sh_f: 20, sh_a: 10, el_f: 26, ...HAND.grip } }], [1.5, { [s]: { sh_f: 22, sh_a: 10, el_f: 28, ...HAND.grip }, head: [0, 0, 6] }]], true);
  }
  o('ref.signal.deuce', 'Signal: deuce (arms crossed at chest)', 1.8, [[0, {}], [0.4, { LR: { sh_f: 60, sh_a: -30, el_f: 100, fa_p: 60, ...HAND.flat } }], [1.4, { LR: { sh_f: 62, sh_a: -34, el_f: 104, ...HAND.flat } }], [1.8, {}]]);
  o('ref.signal.changeserve', 'Signal: change of service (rolling hands)', 2.0, [[0, {}], [0.3, { LR: { sh_f: 56, sh_a: 20, el_f: 100, ...HAND.grip } }], [0.7, { LR: { sh_f: 58, sh_a: 20, el_f: 70, ...HAND.grip }, spine: [2, 0, 0] }], [1.1, { LR: { sh_f: 56, sh_a: 20, el_f: 100 } }], [1.5, { LR: { sh_f: 58, sh_a: 20, el_f: 70 } }], [2.0, {}]]);
  o('ref.signal.timeout', 'Signal: time-out (T with hands)', 1.8, [[0, {}], [0.4, { L: { sh_f: 90, sh_a: 10, el_f: 6, ...HAND.flat }, R: { sh_f: 78, sh_a: 20, el_f: 100, ...HAND.flat } }], [1.4, { L: { sh_f: 92, sh_a: 10, el_f: 6 }, R: { sh_f: 80, sh_a: 20, el_f: 100 } }], [1.8, {}]]);
  o('ref.signal.set.won', 'Signal: set won (fingers up)', 1.8, [[0, {}], [0.3, { R: { sh_f: 120, sh_a: 20, el_f: 60, h_ix: 0, h_md: 0, h_rg: 1, h_pk: 1, h_th: 1, h_sp: 0.6 } }], [1.4, { R: { sh_f: 124, sh_a: 20, el_f: 56, h_ix: 0, h_md: 0, h_rg: 1, h_pk: 1, h_th: 1 } }], [1.8, {}]]);
  o('ref.cointoss', 'Coin toss', 2.0, [[0, {}], [0.4, { R: { sh_f: 60, sh_a: 10, el_f: 110, ...HAND.fist } }], [0.6, { R: { sh_f: 110, sh_a: 10, el_f: 40, ...HAND.open }, neck: [-10, 0, 0] }], [1.0, { R: { sh_f: 70, sh_a: 10, el_f: 100, ...HAND.flat, fa_p: -80 }, neck: [12, 0, 0] }], [2.0, {}]]);
  o('ref.walk.check', 'Check the net height', 2.4, [[0, {}], [0.6, { spine: [12, 0, 0], neck: [10, 0, 0], R: { sh_f: 100, sh_a: 20, el_f: 30, ...HAND.flat } }], [1.6, { spine: [10, 0, 0], R: { sh_f: 104, sh_a: 20, el_f: 26 } }], [2.4, {}]]);
  o('umpire.write', 'Umpire writing the score sheet', 3, [[0, { LR: { hp_f: 92, kn_f: 92, sh_f: 44, sh_a: 12, el_f: 96 }, spine: [16, 0, 0], neck: [26, 0, 0] }], [1.5, { LR: { hp_f: 92, kn_f: 92, sh_f: 46, sh_a: 12, el_f: 98 }, spine: [18, 0, 0], neck: [28, 0, 0], R: { sh_f: 48, el_f: 100, wr_f: 10 } }]], true, { seated: true });
  o('umpire.flip.score', 'Umpire flipping the scoreboard', 1.6, [[0, { LR: { hp_f: 92, kn_f: 92, sh_f: 30, sh_a: 12, el_f: 90 } }], [0.5, { LR: { hp_f: 92, kn_f: 92 }, spine: [10, 0, 10], R: { sh_f: 76, sh_a: 34, el_f: 40, ...HAND.flat } }], [1.6, { LR: { hp_f: 92, kn_f: 92, sh_f: 30, sh_a: 12, el_f: 90 } }]], false, { seated: true });
}

// =============== FREESTYLE / SEPAK RAGA JUGGLING (loops) ===============
export function registerFreestyle() {
  const B = READY;
  const juggle = (id, name, dur, keys) => register({ id, name, cat: 'freestyle', tags: ['loop', 'juggle', 'kampung'], params: { kind: 'freestyle' }, dur, loop: true, build: () => seqClip(B, keys, dur, true) });
  for (const s of ['R', 'L']) {
    const o = s === 'R' ? 'L' : 'R';
    for (const [rn, dur] of [['slow', 1.4], ['fast', 0.8]]) {
      juggle(`free.inside.${s}.${rn}`, `Juggle: inside foot (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 10, kn_f: 30 }, [o]: { hp_f: 24, kn_f: 40 } }], [dur * 0.4, { [s]: { hp_f: 48, kn_f: 60, hp_r: 40, hp_a: 22 }, [o]: { hp_f: 24, kn_f: 44 } }], [dur * 0.7, { [s]: { hp_f: 18, kn_f: 40 } }]]);
      juggle(`free.instep.${s}.${rn}`, `Juggle: laces (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 6, kn_f: 40 }, [o]: { hp_f: 24, kn_f: 40 } }], [dur * 0.4, { [s]: { hp_f: 62, kn_f: 40, an_p: 48 } }], [dur * 0.7, { [s]: { hp_f: 16, kn_f: 40 } }]]);
      juggle(`free.outside.${s}.${rn}`, `Juggle: outside foot (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 10, kn_f: 30 }, [o]: { hp_f: 24, kn_f: 40 } }], [dur * 0.4, { [s]: { hp_f: 40, kn_f: 60, hp_r: -30, hp_a: 30, an_i: -20 } }], [dur * 0.7, { [s]: { hp_f: 16, kn_f: 40 } }]]);
      juggle(`free.knee.${s}.${rn}`, `Juggle: knee (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 14, kn_f: 20 }, [o]: { hp_f: 18, kn_f: 28 } }], [dur * 0.4, { [s]: { hp_f: 84, kn_f: 100 }, spine: [-4, 0, 0] }], [dur * 0.7, { [s]: { hp_f: 24, kn_f: 40 } }]]);
      juggle(`free.thigh.${s}.${rn}`, `Juggle: thigh (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 14, kn_f: 20 } }], [dur * 0.4, { [s]: { hp_f: 70, kn_f: 88 }, spine: [-6, 0, 0] }], [dur * 0.7, { [s]: { hp_f: 24, kn_f: 40 } }]]);
      juggle(`free.heel.${s}.${rn}`, `Juggle: heel flick behind (${SIDES[s]}, ${rn})`, dur, [[0, { [s]: { hp_f: 8, kn_f: 30 } }], [dur * 0.4, { [s]: { hp_f: -18, kn_f: 118, an_p: -10 }, spine: [16, 0, 0] }], [dur * 0.7, { [s]: { hp_f: 8, kn_f: 30 } }]]);
    }
  }
  for (const [rn, dur] of [['slow', 1.6], ['fast', 1.0]]) {
    juggle(`free.head.${rn}`, `Juggle: header (${rn})`, dur, [[0, { LR: { hp_f: 40, kn_f: 60 }, spine: [10, 0, 0] }], [dur * 0.4, { LR: { hp_f: 10, kn_f: 14, an_p: 40 }, spine: [-6, 0, 0], neck: [-14, 0, 0] }], [dur * 0.55, { LR: { hp_f: 26, kn_f: 40 }, neck: [16, 0, 0], spine: [12, 0, 0] }]]);
    juggle(`free.chest.${rn}`, `Juggle: chest (${rn})`, dur, [[0, { LR: { hp_f: 34, kn_f: 60 }, spine: [8, 0, 0] }], [dur * 0.4, { LR: { hp_f: 16, kn_f: 30 }, spine: [-14, 0, 0], chest: [-14, 0, 0] }], [dur * 0.7, { LR: { hp_f: 34, kn_f: 60 } }]]);
    juggle(`free.alt.${rn}`, `Juggle: alternate feet (${rn})`, dur, [[0, { R: { hp_f: 50, kn_f: 60, hp_r: 30 }, L: { hp_f: 20, kn_f: 30 } }], [dur / 2, { L: { hp_f: 50, kn_f: 60, hp_r: 30 }, R: { hp_f: 20, kn_f: 30 } }]]);
    juggle(`free.world.${rn}`, `Trick: around the world (${rn})`, dur * 1.4, [[0, { R: { hp_f: 40, kn_f: 60, hp_a: 20 } }], [dur * 0.4, { R: { hp_f: 70, kn_f: 30, hp_a: 40, hp_r: 30 }, spine: [0, 0, -12] }], [dur * 0.8, { R: { hp_f: 40, kn_f: 90, hp_a: -10 }, spine: [8, 0, 10] }]]);
    juggle(`free.behind.${rn}`, `Trick: behind-the-back heel (${rn})`, dur * 1.2, [[0, { spine: [10, 0, 0] }], [dur * 0.5, { R: { hp_f: -24, kn_f: 130 }, spine: [22, 0, 0], LR: { sh_f: 40 } }]]);
    juggle(`free.neck.${rn}`, `Trick: neck stall (${rn})`, dur * 1.4, [[0, { spine: [-14, 0, 0], neck: [-24, 0, 0], LR: { sh_a: 40 } }], [dur * 0.7, { spine: [-16, 0, 0], neck: [-28, 0, 0], LR: { sh_a: 44 } }]]);
  }
}
