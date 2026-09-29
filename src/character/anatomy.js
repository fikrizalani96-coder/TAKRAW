// Anatomy: signed-distance primitives (muscle groups etc.) defined in bone-local space.
// `buildAnatomy` returns separate scenes for the main body, hands, feet and head so each can be
// meshed at an appropriate resolution and then skinned to the shared skeleton.
import * as THREE from 'three';
import { Frame, Prims, SDFScene } from './sdf.js';
import { tipOf } from './skeleton.js';
import { RigPoser, REST_POSE } from '../anim/pose.js';

/** Put the rig in its bind pose and compute per-bone frames and segments. */
export function computeBind(rig) {
  new RigPoser(rig).apply(REST_POSE);
  rig.root.updateMatrixWorld(true);
  const frames = {};
  const segs = {};
  const LEAF_TIP = {
    head: [0, 0.165, 0.02], jaw: [0, -0.11, 0.085], scapula: [0, 0, -0.04],
    thumb_03: [0, -0.026, 0], toe_big: [0, 0, 0.03], toe_small: [0, 0, 0.03],
    index_03: [0, -0.02, 0], middle_03: [0, -0.021, 0], ring_03: [0, -0.02, 0], pinky_03: [0, -0.017, 0],
  };
  for (const b of rig.deform) {
    frames[b.name] = new Frame(b);
    const a = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const t = tipOf(b.name);
    let bb;
    if (t) bb = new THREE.Vector3().setFromMatrixPosition(rig.bones[t].matrixWorld);
    else {
      const base = b.name.replace(/_[lr]$/, '');
      const lt = LEAF_TIP[base] || [0, -0.03, 0];
      bb = new THREE.Vector3(lt[0] * (b.name.endsWith('_r') ? -1 : 1), lt[1], lt[2]).applyMatrix4(b.matrixWorld);
    }
    segs[b.name] = { a, b: bb };
  }
  return { frames, segs };
}

const S = (side, list) => list.map((n) => (n.includes('@') ? n.replace('@', side) : n));

/**
 * Body params: chest/waist/thigh/arm are multipliers, muscle 0..1.5 scales definition.
 */
export function buildBodyScene(rig, bind, prm = {}) {
  const chest = prm.chest ?? 1, waist = prm.waist ?? 1, thighK = prm.thigh ?? 1, armK = prm.arm ?? 1, mus = prm.muscle ?? 1;
  const sc = new SDFScene();
  const F = (n) => bind.frames[n];
  const K = rig.dims.scale;
  const A = rig.dims.arm, L = rig.dims.leg;
  const T = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01'];
  let tg = 'torso';
  const cone = (bone, a, b, r1, r2, o) => sc.add(Prims.cone(F(bone), a, b, r1, r2, { tag: tg, ...o }));
  const ell = (bone, c, r, o) => sc.add(Prims.ellipsoid(F(bone), c, r, { tag: tg, ...o }));

  // --- torso ---
  tg = 'pelvis';
  cone('pelvis', [0, -0.045 * K, 0], [0, 0.04 * K, 0], 0.118 * K, 0.112 * K, { sx: 1.34 * thighK, sz: 0.92, k: 0.03, skin: ['pelvis', 'spine_01', 'thigh_l', 'thigh_r'] });
  tg = 'torso';
  cone('spine_01', [0, 0, 0], [0, 0.085 * K, 0], 0.106 * K * waist, 0.104 * K * waist, { sx: 1.28, sz: 0.90, k: 0.03, skin: T });
  cone('spine_02', [0, 0, 0], [0, 0.09 * K, 0.002], 0.104 * K * waist, 0.112 * K * chest, { sx: 1.34, sz: 0.93, k: 0.03, skin: T });
  cone('spine_03', [0, -0.005 * K, 0], [0, 0.085 * K, 0], 0.112 * K * chest, 0.122 * K * chest, { sx: 1.40, sz: 0.97, k: 0.03, skin: T });
  cone('spine_04', [0, 0, 0], [0, 0.08 * K, -0.002], 0.122 * K * chest, 0.124 * K * chest, { sx: 1.44, sz: 0.97, k: 0.03, skin: T });
  ell('spine_05', [0, 0.018 * K, -0.008], [0.192 * K * chest, 0.078 * K, 0.104 * K], { k: 0.035, skin: ['spine_04', 'spine_05', 'clavicle_l', 'clavicle_r', 'neck_01'] });
  // trapezius slopes
  for (const [sd, s] of [['_l', 1], ['_r', -1]]) {
    ell('spine_05', [s * 0.085 * K, 0.055 * K, -0.02], [0.105 * K, 0.034 * K, 0.058 * K], { k: 0.03, skin: ['spine_05', 'neck_01', 'clavicle' + sd] });
    // pectorals / lats / glutes
    tg = 'torso';
    ell('spine_04', [s * 0.078 * K, 0.040 * K, 0.088 * K * chest], [0.078 * K * mus, 0.056 * K * mus, 0.040 * K * mus], { k: 0.03, skin: ['spine_03', 'spine_04', 'spine_05', 'upperarm' + sd] });
    ell('spine_03', [s * 0.140 * K, 0.030 * K, -0.024 * K], [0.046 * K * mus, 0.105 * K, 0.070 * K], { k: 0.035, skin: T });
    tg = 'glute' + sd;
    ell('pelvis', [s * 0.066 * K, -0.066 * K, -0.078 * K], [0.078 * K * thighK, 0.085 * K, 0.082 * K], { k: 0.04, skin: ['pelvis', 'thigh' + sd] });
    // abdominal wall / obliques (subtle)
    tg = 'torso';
    ell('spine_02', [s * 0.038 * K, 0.030 * K, 0.086 * K], [0.048 * K, 0.075 * K, 0.026 * K * mus], { k: 0.045, skin: T });
  }
  // neck
  tg = 'neck';
  cone('neck_01', [0, -0.045 * K, 0], [0, 0.10 * K, 0.010], 0.058 * K, 0.052 * K, { k: 0.03, skin: ['spine_05', 'neck_01', 'neck_02', 'head'] });

  for (const [sd, s] of [['_l', 1], ['_r', -1]]) {
    const ua = 0.310 * K * A, fa = 0.260 * K * A;
    const UA = ['clavicle' + sd, 'upperarm' + sd, 'upperarm_twist_01' + sd, 'upperarm_twist_02' + sd, 'lowerarm' + sd];
    // shoulder / deltoid
    tg = 'uarm' + sd;
    ell('upperarm' + sd, [s * 0.010 * K, -0.035 * K, 0.004], [0.047 * K * armK * mus, 0.070 * K, 0.050 * K * armK * mus], { k: 0.03, skin: ['spine_05', 'clavicle' + sd, 'upperarm' + sd, 'upperarm_twist_01' + sd] });
    cone('upperarm' + sd, [0, -0.01, 0], [0, -ua, 0], 0.050 * K * armK, 0.037 * K * armK, { k: 0.02, skin: UA });
    ell('upperarm' + sd, [s * 0.0, -ua * 0.42, 0.012 * K], [0.040 * K * armK * mus, 0.082 * K, 0.040 * K * armK * mus], { k: 0.025, skin: UA }); // biceps
    ell('upperarm' + sd, [s * 0.002, -ua * 0.40, -0.016 * K], [0.040 * K * armK * mus, 0.085 * K, 0.037 * K * armK * mus], { k: 0.025, skin: UA }); // triceps
    // forearm
    tg = 'farm' + sd;
    const FA = ['upperarm_twist_02' + sd, 'lowerarm' + sd, 'lowerarm_twist_01' + sd, 'lowerarm_twist_02' + sd, 'hand' + sd];
    cone('lowerarm' + sd, [0, 0, 0], [0, -fa, 0], 0.037 * K * armK, 0.0245 * K, { k: 0.02, skin: FA });
    ell('lowerarm' + sd, [s * 0.004, -fa * 0.26, 0.004], [0.036 * K * armK * mus, 0.080 * K, 0.038 * K * armK * mus], { k: 0.025, skin: FA });
    // leg
    tg = 'thigh' + sd;
    const th = 0.430 * K * L, sh = 0.410 * K * L;
    const LG = ['pelvis', 'thigh' + sd, 'thigh_twist_01' + sd, 'thigh_twist_02' + sd, 'calf' + sd];
    cone('thigh' + sd, [0, 0.005, 0], [0, -th, 0], 0.096 * K * thighK, 0.058 * K * thighK, { k: 0.03, skin: LG });
    ell('thigh' + sd, [s * 0.006, -th * 0.42, 0.030 * K], [0.074 * K * thighK * mus, 0.170 * K, 0.068 * K * thighK * mus], { k: 0.03, skin: LG });      // quadriceps
    ell('thigh' + sd, [s * 0.010, -th * 0.42, -0.030 * K], [0.064 * K * thighK, 0.165 * K, 0.056 * K * thighK], { k: 0.03, skin: LG });               // hamstrings
    ell('thigh' + sd, [s * 0.028 * K, -th * 0.40, 0.004], [0.048 * K * mus, 0.155 * K, 0.052 * K], { k: 0.03, skin: LG });                             // vastus lateralis
    tg = 'calf' + sd;
    const CF = ['thigh_twist_02' + sd, 'calf' + sd, 'calf_twist_01' + sd, 'calf_twist_02' + sd, 'foot' + sd];
    cone('calf' + sd, [0, 0.004, 0], [0, -sh, 0], 0.054 * K, 0.034 * K, { k: 0.025, skin: CF });
    ell('calf' + sd, [s * 0.006 * K, -sh * 0.28, -0.030 * K], [0.052 * K * mus, 0.115 * K, 0.050 * K * mus], { k: 0.03, skin: CF });                    // gastrocnemius
    ell('calf' + sd, [s * 0.000, -sh * 0.38, 0.014 * K], [0.030 * K, 0.150 * K, 0.028 * K], { k: 0.02, skin: CF });                                    // tibialis
    tg = 'foot' + sd;
    // ankle / foot base (skin foot volume; shoes or barefoot detail added separately)
    const FT = ['calf_twist_02' + sd, 'foot' + sd, 'ball' + sd];
    ell('foot' + sd, [0, -0.036 * K, -0.028 * K], [0.034 * K, 0.042 * K, 0.046 * K], { k: 0.02, skin: FT });
    ell('foot' + sd, [0, -0.040 * K, 0.055 * K], [0.038 * K, 0.030 * K, 0.095 * K], { k: 0.02, skin: FT });
    ell('foot' + sd, [0, -0.054 * K, 0.142 * K], [0.046 * K, 0.020 * K, 0.042 * K], { k: 0.015, skin: ['foot' + sd, 'ball' + sd, 'toe_big' + sd, 'toe_small' + sd] });
  }
  return sc;
}
