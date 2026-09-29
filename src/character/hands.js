// Hands (19 bones each), feet/toes for barefoot play, all as SDF primitives in finger-bone space.
import { Prims, SDFScene } from './sdf.js';

/** side: '_l' or '_r'. Returns a scene containing the hand plus the last centimetres of forearm. */
export function buildHandScene(rig, bind, sd, bodyScene) {
  const K = rig.dims.scale;
  const s = sd === '_l' ? 1 : -1;
  const F = (n) => bind.frames[n + sd];
  const sc = new SDFScene();
  const add = (p) => sc.add(p);
  const HB = ['lowerarm_twist_02' + sd, 'hand' + sd];
  const MC = ['hand' + sd, 'index_metacarpal' + sd, 'middle_metacarpal' + sd, 'ring_metacarpal' + sd, 'pinky_metacarpal' + sd];
  // palm
  add(Prims.box(F('hand'), [0, -0.052 * K, 0.0], [0.0155 * K, 0.046 * K, 0.043 * K], 0.012 * K, { k: 0.012, skin: MC, tag: 'skin' }));
  add(Prims.ellipsoid(F('hand'), [s * -0.012 * K, -0.036 * K, 0.030 * K], [0.020 * K, 0.030 * K, 0.021 * K], { k: 0.012, skin: [...MC, 'thumb_01' + sd], tag: 'skin' })); // thenar
  add(Prims.ellipsoid(F('hand'), [s * 0.0, -0.040 * K, -0.030 * K], [0.017 * K, 0.030 * K, 0.017 * K], { k: 0.012, skin: MC, tag: 'skin' }));             // hypothenar
  // wrist / lower forearm (slightly bigger than the body's forearm to avoid coincident surfaces)
  add(Prims.cone(F('lowerarm'), [0, -0.170 * K * rig.dims.arm, 0], [0, -0.262 * K * rig.dims.arm, 0], 0.0285 * K, 0.0255 * K, { k: 0.015, skin: [...HB, 'lowerarm' + sd], tag: 'skin' }));
  const fingers = [
    ['index', [0.040, 0.024, 0.020], [0.0105, 0.0095, 0.0085, 0.0075]],
    ['middle', [0.045, 0.028, 0.021], [0.0108, 0.0098, 0.0088, 0.0078]],
    ['ring', [0.041, 0.026, 0.020], [0.0102, 0.0092, 0.0082, 0.0072]],
    ['pinky', [0.031, 0.018, 0.017], [0.0092, 0.0084, 0.0075, 0.0066]],
  ];
  for (const [f, ln, r] of fingers) {
    const chain = [`${f}_01${sd}`, `${f}_02${sd}`, `${f}_03${sd}`];
    const near = [`${f}_metacarpal${sd}`, ...chain];
    add(Prims.cone(F(`${f}_01`), [0, 0, 0], [0, -ln[0] * K, 0], r[0] * K, r[1] * K, { k: 0.005, skin: near, tag: 'skin' }));
    add(Prims.cone(F(`${f}_02`), [0, 0, 0], [0, -ln[1] * K, 0], r[1] * K, r[2] * K, { k: 0.005, skin: near, tag: 'skin' }));
    add(Prims.cone(F(`${f}_03`), [0, 0, 0], [0, -ln[2] * K, 0], r[2] * K, r[3] * K, { k: 0.005, skin: near, tag: 'skin' }));
  }
  const th = ['thumb_01' + sd, 'thumb_02' + sd, 'thumb_03' + sd];
  add(Prims.cone(F('thumb_01'), [0, 0, 0], [0, -0.040 * K, 0], 0.0128 * K, 0.0112 * K, { k: 0.006, skin: ['hand' + sd, ...th], tag: 'skin' }));
  add(Prims.cone(F('thumb_02'), [0, 0, 0], [0, -0.031 * K, 0], 0.0112 * K, 0.0098 * K, { k: 0.006, skin: ['hand' + sd, ...th], tag: 'skin' }));
  add(Prims.cone(F('thumb_03'), [0, 0, 0], [0, -0.026 * K, 0], 0.0098 * K, 0.0082 * K, { k: 0.006, skin: ['hand' + sd, ...th], tag: 'skin' }));
  return sc;
}

/** Bare foot (with five toes) for Kampung/barefoot play. Includes a little lower-leg overlap. */
export function buildFootScene(rig, bind, sd) {
  const K = rig.dims.scale;
  const s = sd === '_l' ? 1 : -1;
  const F = (n) => bind.frames[n + sd];
  const sc = new SDFScene();
  const add = (p) => sc.add(p);
  const FT = ['calf_twist_02' + sd, 'foot' + sd, 'ball' + sd];
  add(Prims.cone(F('calf'), [0, -0.30 * K * rig.dims.leg, 0], [0, -0.412 * K * rig.dims.leg, 0], 0.0365 * K, 0.0352 * K, { k: 0.02, skin: ['calf' + sd, ...FT], tag: 'skin' }));
  add(Prims.ellipsoid(F('foot'), [0, -0.036 * K, -0.028 * K], [0.0345 * K, 0.043 * K, 0.047 * K], { k: 0.02, skin: FT, tag: 'skin' }));
  add(Prims.ellipsoid(F('foot'), [0, -0.041 * K, 0.055 * K], [0.0385 * K, 0.031 * K, 0.096 * K], { k: 0.02, skin: FT, tag: 'skin' }));
  add(Prims.ellipsoid(F('foot'), [0, -0.054 * K, 0.140 * K], [0.0465 * K, 0.021 * K, 0.043 * K], { k: 0.015, skin: [...FT, 'toe_big' + sd, 'toe_small' + sd], tag: 'skin' }));
  // malleoli
  for (const m of [-1, 1]) add(Prims.ellipsoid(F('foot'), [m * 0.032 * K, -0.016 * K, -0.004 * K], [0.011 * K, 0.014 * K, 0.014 * K], { k: 0.01, skin: FT, tag: 'skin' }));
  // toes: big toe (2 phalanges) + four small toes
  add(Prims.cone(F('ball'), [s * -0.020 * K, -0.008 * K, 0.004 * K], [s * -0.016 * K, -0.006 * K, 0.032 * K], 0.0118 * K, 0.0108 * K, { k: 0.006, skin: ['ball' + sd, 'toe_big' + sd], tag: 'skin' }));
  add(Prims.cone(F('toe_big'), [0, -0.006 * K, 0], [0, -0.006 * K, 0.030 * K], 0.0108 * K, 0.0088 * K, { k: 0.006, skin: ['ball' + sd, 'toe_big' + sd], tag: 'skin' }));
  const small = [[0.008, 0.030, 0.0084], [0.020, 0.027, 0.0078], [0.031, 0.023, 0.0072], [0.041, 0.019, 0.0066]];
  for (const [x, l, r] of small) add(Prims.cone(F('ball'), [s * x * K, -0.009 * K, 0.006 * K], [s * x * K, -0.010 * K, (0.006 + l) * K], r * K, (r - 0.0012) * K, { k: 0.005, skin: ['ball' + sd, 'toe_small' + sd], tag: 'skin' }));
  return sc;
}
