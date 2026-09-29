// Skill library: maps a wanted ball contact (height, lateral offset, kind) to the best catalogue
// clip. Skills describe what each role can do and where the ball can be played from.
import { allEntries, getClip } from '../anim/catalog.js';

const famCache = new Map();
/** All catalogue entries whose id starts with one of the prefixes. */
function family(prefixes) {
  const key = prefixes.join('|');
  let f = famCache.get(key);
  if (!f) { f = allEntries().filter((e) => prefixes.some((p) => e.id.startsWith(p))); famCache.set(key, f); }
  return f;
}

/**
 * skill definitions. hMin/hMax: ball height range at contact; z: typical forward offset;
 * prefixes: catalogue families; air: needs a jump; ground: dive/slide.
 */
export const SKILLS = {
  'dig.foot': { prefixes: ['recv.foot.'], hMin: 0.15, hMax: 1.08, z: 0.38, reach: 0.55, cat: 'receive' },
  'dig.thigh': { prefixes: ['recv.thigh.'], hMin: 0.55, hMax: 1.05, z: 0.30, reach: 0.45, cat: 'receive' },
  'dig.knee': { prefixes: ['recv.knee.'], hMin: 0.45, hMax: 1.05, z: 0.30, reach: 0.45, cat: 'receive' },
  'dig.chest': { prefixes: ['recv.chest.', 'ctl.chest.'], hMin: 1.02, hMax: 1.48, z: 0.24, reach: 0.42, cat: 'receive' },
  'dig.head': { prefixes: ['recv.head.'], hMin: 1.55, hMax: 2.3, z: 0.28, reach: 0.42, cat: 'receive', jumpFrom: 1.95 },
  'dig.shoulder': { prefixes: ['recv.shoulder.'], hMin: 1.15, hMax: 1.62, z: 0.2, reach: 0.4, cat: 'receive' },
  'dig.back': { prefixes: ['recv.back.'], hMin: 1.1, hMax: 1.55, z: -0.25, reach: 0.4, cat: 'receive' },
  'dig.slide': { prefixes: ['dive.slide.'], hMin: 0.06, hMax: 0.4, z: 0.9, reach: 0.7, cat: 'dive', ground: true },
  'dig.dive': { prefixes: ['dive.head.'], hMin: 0.25, hMax: 0.7, z: 1.2, reach: 0.7, cat: 'dive', ground: true },
  'dig.split': { prefixes: ['dive.split.'], hMin: 0.06, hMax: 0.32, z: 0.5, reach: 0.65, cat: 'dive', ground: true },
  'set.foot': { prefixes: ['set.foot.'], hMin: 0.5, hMax: 1.2, z: 0.4, reach: 0.5, cat: 'set' },
  'set.head': { prefixes: ['set.head.'], hMin: 1.55, hMax: 2.3, z: 0.28, reach: 0.42, cat: 'set', jumpFrom: 1.95 },
  'set.chest': { prefixes: ['set.chest.'], hMin: 1.02, hMax: 1.48, z: 0.24, reach: 0.42, cat: 'set' },
  'atk.kick': { prefixes: ['atk.kick.'], hMin: 0.65, hMax: 1.4, z: 0.42, reach: 0.5, cat: 'attack' },
  'atk.head': { prefixes: ['atk.head.'], hMin: 1.55, hMax: 2.3, z: 0.28, reach: 0.42, cat: 'attack', jumpFrom: 1.95 },
  'spike.kuda': { prefixes: ['atk.kuda.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.gulung': { prefixes: ['atk.gulung.'], hMin: 2.15, hMax: 2.95, z: 0.18, reach: 0.5, cat: 'attack', air: true },
  'spike.gunting': { prefixes: ['atk.gunting.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.sila': { prefixes: ['atk.sila.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.cara': { prefixes: ['atk.cara.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.kilas': { prefixes: ['atk.kilas.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.roda': { prefixes: ['atk.roda.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'spike.tumit': { prefixes: ['atk.tumit.'], hMin: 2.15, hMax: 2.95, z: 0.34, reach: 0.5, cat: 'attack', air: true },
  'block.foot': { prefixes: ['block.foot.'], hMin: 1.75, hMax: 2.45, z: 0.26, reach: 0.6, cat: 'block', air: true },
  'block.double': { prefixes: ['block.double.'], hMin: 1.75, hMax: 2.45, z: 0.26, reach: 0.6, cat: 'block', air: true },
  'block.head': { prefixes: ['block.head.'], hMin: 1.75, hMax: 2.45, z: 0.26, reach: 0.5, cat: 'block', air: true },
  'block.chest': { prefixes: ['block.chest.'], hMin: 1.75, hMax: 2.45, z: 0.26, reach: 0.5, cat: 'block', air: true },
  'serve.instep': { prefixes: ['serve.instep.'], hMin: 0.7, hMax: 1.3, z: 0.4, reach: 0.5, cat: 'serve' },
  'serve.inside': { prefixes: ['serve.inside.'], hMin: 0.6, hMax: 1.2, z: 0.4, reach: 0.5, cat: 'serve' },
  'serve.outside': { prefixes: ['serve.outside.'], hMin: 0.6, hMax: 1.2, z: 0.4, reach: 0.5, cat: 'serve' },
  'serve.toe': { prefixes: ['serve.toe.'], hMin: 0.2, hMax: 0.5, z: 0.45, reach: 0.4, cat: 'serve' },
};

/** Air-time model shared with the animation builders. */
export function clipInfo(entry) {
  const clip = getClip(entry.id);
  const m = clip.meta || {};
  return { clip, tc: clip.events.contact, T: m.contact?.T || entry.params?.T || [0, 1, 0.3], side: m.contact?.side || null, air: m.air || null, meta: m };
}

/**
 * Choose the catalogue clip that best matches a wanted contact.
 * want: {y, x (lateral, +left of player), z (forward)}; opts.side preferred leg/side ('L'|'R'|null)
 */
export function pickClip(skillKey, want, opts = {}) {
  const sk = SKILLS[skillKey];
  const fam = family(sk.prefixes);
  let best = null, bestS = Infinity;
  for (const e of fam) {
    const p = e.params || {};
    const T = p.T; if (!T) continue;
    if (opts.filter && !opts.filter(e)) continue;
    let s = Math.abs(T[1] - want.y) * 3.2 + Math.abs(T[0] - (want.x ?? 0)) * 1.3 + (want.z !== undefined ? Math.abs(T[2] - want.z) * 0.6 : 0);
    const side = p.leg || p.side || p.hand;
    if (opts.side && side && side !== opts.side) s += 0.12;
    if (opts.prefType && p.type === opts.prefType) s -= 0.15;
    if (opts.rand) s += Math.random() * opts.rand;
    if (s < bestS) { bestS = s; best = e; }
  }
  if (!best) return null;
  const info = clipInfo(best);
  return { entry: best, ...info, score: bestS };
}

export function skillFor(cat) { return Object.keys(SKILLS).filter((k) => SKILLS[k].cat === cat); }
