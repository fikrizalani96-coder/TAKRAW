// Human skeleton definition: ~110 joints in a MetaHuman/UE-style hierarchy.
//
// Conventions
//  * The character faces +Z, up is +Y. The character's LEFT side is +X (suffix _l), right is -X (_r).
//  * In the neutral frame every bone axis is aligned with the world (arms/legs hang along -Y,
//    spine along +Y, feet point +Z). Bone offsets below are expressed in the parent's neutral frame.
//  * The bind (rest) pose is the neutral pose plus REST_POSE (arms slightly abducted, relaxed
//    fingers) so that armpits/crotch are open for clean skinning. Animation poses are absolute
//    anatomical angles relative to the neutral frame (see anim/pose.js), so a pose of all zeros
//    means "arms hanging straight down".
import * as THREE from 'three';

const M = (o, s) => [o[0] * s, o[1], o[2]]; // mirror an offset for the right side (s = -1)

function buildSpec(dims) {
  const K = dims.scale;
  const T = dims.torso, L = dims.leg, A = dims.arm;
  const bones = [];
  const add = (name, parent, off, opts = {}) => {
    const sc = opts.k ?? 1;
    bones.push({ name, parent, off: [off[0] * sc, off[1] * sc, off[2] * sc], ...opts });
  };

  add('root', null, [0, 0, 0]);
  add('pelvis', 'root', [0, 0.97 * K * L, 0]);
  add('spine_01', 'pelvis', [0, 0.070 * K * T, 0]);
  add('spine_02', 'spine_01', [0, 0.085 * K * T, 0.004]);
  add('spine_03', 'spine_02', [0, 0.090 * K * T, 0.004]);
  add('spine_04', 'spine_03', [0, 0.085 * K * T, 0]);
  add('spine_05', 'spine_04', [0, 0.080 * K * T, -0.004]);
  add('neck_01', 'spine_05', [0, 0.110 * K, -0.010]);
  add('neck_02', 'neck_01', [0, 0.055 * K, 0.008]);
  add('head', 'neck_02', [0, 0.050 * K, 0.008]);

  // Face rig (jaw, eyes, eyelids, brows, cheeks, lips)
  add('jaw', 'head', [0, 0.035 * K, 0.005]);
  for (const [sfx, s] of [['_l', 1], ['_r', -1]]) {
    add('eye' + sfx, 'head', M([0.032 * K, 0.072 * K, 0.078 * K], s));
    add('eyelid_up' + sfx, 'head', M([0.032 * K, 0.072 * K, 0.078 * K], s));
    add('eyelid_lo' + sfx, 'head', M([0.032 * K, 0.072 * K, 0.078 * K], s));
    add('brow' + sfx, 'head', M([0.035 * K, 0.100 * K, 0.092 * K], s));
    add('cheek' + sfx, 'head', M([0.052 * K, 0.030 * K, 0.075 * K], s));
    add('lip_corner' + sfx, 'jaw', M([0.024 * K, -0.057 * K, 0.090 * K], s));
  }
  add('lip_upper', 'head', [0, -0.012 * K, 0.100 * K]);
  add('lip_lower', 'jaw', [0, -0.050 * K, 0.098 * K]);

  for (const [sfx, s] of [['_l', 1], ['_r', -1]]) {
    const n = (x) => x + sfx;
    // Shoulder girdle and arm
    add(n('clavicle'), 'spine_05', M([0.020 * K, 0.050 * K, 0.030], s));
    add(n('scapula'), 'spine_05', M([0.060 * K, 0.030 * K, -0.055], s));
    add(n('upperarm'), n('clavicle'), M([0.170 * K, -0.005 * K, -0.030], s));
    const ua = 0.310 * K * A, fa = 0.260 * K * A;
    add(n('upperarm_twist_01'), n('upperarm'), [0, -ua * 0.32, 0]);
    add(n('upperarm_twist_02'), n('upperarm'), [0, -ua * 0.66, 0]);
    add(n('lowerarm'), n('upperarm'), [0, -ua, 0]);
    add(n('lowerarm_twist_01'), n('lowerarm'), [0, -fa * 0.32, 0]);
    add(n('lowerarm_twist_02'), n('lowerarm'), [0, -fa * 0.66, 0]);
    add(n('hand'), n('lowerarm'), [0, -fa, 0]);
    // Hand: 4 metacarpals + 4 x 3 phalanges + thumb (3) = 19 bones per hand
    const fingers = [
      ['index', 0.030, [0.040, 0.024, 0.020]],
      ['middle', 0.010, [0.045, 0.028, 0.021]],
      ['ring', -0.010, [0.041, 0.026, 0.020]],
      ['pinky', -0.028, [0.031, 0.018, 0.017]],
    ];
    for (const [f, z, ln] of fingers) {
      add(`${f}_metacarpal${sfx}`, n('hand'), [0, -0.018, z * 0.7]);
      add(`${f}_01${sfx}`, `${f}_metacarpal${sfx}`, [0, -0.072, z * 0.3]);
      add(`${f}_02${sfx}`, `${f}_01${sfx}`, [0, -ln[0], 0]);
      add(`${f}_03${sfx}`, `${f}_02${sfx}`, [0, -ln[1], 0]);
    }
    add(`thumb_01${sfx}`, n('hand'), M([-0.012, -0.028, 0.030], s), { rot: [-52, 0, 18 * s] });
    add(`thumb_02${sfx}`, `thumb_01${sfx}`, [0, -0.040, 0]);
    add(`thumb_03${sfx}`, `thumb_02${sfx}`, [0, -0.031, 0]);

    // Leg
    const th = 0.430 * K * L, sh = 0.410 * K * L;
    add(n('thigh'), 'pelvis', M([0.088 * K, -0.050 * K, 0], s));
    add(n('thigh_twist_01'), n('thigh'), [0, -th * 0.30, 0]);
    add(n('thigh_twist_02'), n('thigh'), [0, -th * 0.62, 0]);
    add(n('calf'), n('thigh'), [0, -th, 0]);
    add(n('calf_twist_01'), n('calf'), [0, -sh * 0.28, 0]);
    add(n('calf_twist_02'), n('calf'), [0, -sh * 0.60, 0]);
    add(n('foot'), n('calf'), [0, -sh, 0]);
    add(n('ball'), n('foot'), [0, -0.050 * K, 0.140 * K]);
    add(n('toe_big'), n('ball'), M([-0.016 * K, 0.0, 0.032 * K], s));
    add(n('toe_small'), n('ball'), M([0.020 * K, 0.0, 0.030 * K], s));
  }

  // IK / control helper bones (never skinned; used as end-effector targets).
  add('ik_foot_root', 'root', [0, 0, 0]);
  add('ik_foot_l', 'ik_foot_root', [0.10, 0.08, 0]);
  add('ik_foot_r', 'ik_foot_root', [-0.10, 0.08, 0]);
  add('ik_hand_root', 'root', [0, 0, 0]);
  add('ik_hand_l', 'ik_hand_root', [0.34, 0.87, 0]);
  add('ik_hand_r', 'ik_hand_root', [-0.34, 0.87, 0]);
  add('ik_ball', 'root', [0, 1.0, 0.4]);
  add('ik_look', 'root', [0, 1.65, 3.0]);
  return bones;
}

// Bone whose head defines the *tip* of each bone segment (used for skin weighting & capsule fitting).
export function tipOf(name) {
  const side = name.endsWith('_l') ? '_l' : name.endsWith('_r') ? '_r' : '';
  const base = side ? name.slice(0, -2) : name;
  const T = {
    pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'spine_04', spine_04: 'spine_05',
    spine_05: 'neck_01', neck_01: 'neck_02', neck_02: 'head',
    clavicle: 'upperarm', scapula: null,
    upperarm: 'upperarm_twist_01', upperarm_twist_01: 'upperarm_twist_02', upperarm_twist_02: 'lowerarm',
    lowerarm: 'lowerarm_twist_01', lowerarm_twist_01: 'lowerarm_twist_02', lowerarm_twist_02: 'hand',
    hand: 'middle_metacarpal',
    thigh: 'thigh_twist_01', thigh_twist_01: 'thigh_twist_02', thigh_twist_02: 'calf',
    calf: 'calf_twist_01', calf_twist_01: 'calf_twist_02', calf_twist_02: 'foot',
    foot: 'ball', ball: 'toe_big',
    thumb_01: 'thumb_02', thumb_02: 'thumb_03',
  };
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    T[`${f}_metacarpal`] = `${f}_01`; T[`${f}_01`] = `${f}_02`; T[`${f}_02`] = `${f}_03`;
  }
  if (base in T) return T[base] ? T[base] + side : null;
  return null;
}

const DEG = Math.PI / 180;

/** Body dimension presets. `scale` is stature/1.75. */
export function makeDims(o = {}) {
  return { scale: (o.height ?? 1.75) / 1.75, torso: o.torso ?? 1, leg: o.leg ?? 1, arm: o.arm ?? 1 };
}

/**
 * Build a THREE.Bone hierarchy. Returns a rig descriptor:
 *  { root, bones{name->Bone}, list[], names[], index{name->i}, parentIndex[], dims, deform[] }
 */
export function buildRig(dims = makeDims()) {
  const spec = buildSpec(dims);
  const bones = {}, list = [], names = [], index = {}, parentIndex = [];
  for (const b of spec) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.set(b.off[0], b.off[1], b.off[2]);
    if (b.rot) {
      const e = new THREE.Euler(b.rot[0] * DEG, b.rot[1] * DEG, b.rot[2] * DEG, 'XYZ');
      bone.userData.qStatic = new THREE.Quaternion().setFromEuler(e);
    } else bone.userData.qStatic = new THREE.Quaternion();
    bone.userData.restPos = bone.position.clone();
    bones[b.name] = bone;
    index[b.name] = list.length;
    list.push(bone);
    names.push(b.name);
    parentIndex.push(b.parent ? index[b.parent] : -1);
    if (b.parent) bones[b.parent].add(bone);
  }
  const deform = list.filter((b) => !b.name.startsWith('ik_') && b.name !== 'root');
  return { root: bones.root, bones, list, names, index, parentIndex, dims, deform, spec };
}

export function countJoints() {
  return buildSpec(makeDims()).length;
}
