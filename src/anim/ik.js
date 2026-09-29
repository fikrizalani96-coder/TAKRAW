// Runtime IK on THREE.Bone chains: analytic two-bone IK (legs/arms), aim (single bone),
// look-at for neck/head/eyes, and grounding of the whole body against the floor.
import * as THREE from 'three';

const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const m0 = new THREE.Matrix4();

const worldPos = (b, out) => out.setFromMatrixPosition(b.matrixWorld);
function worldQuat(b, out) { b.matrixWorld.decompose(v4, out, v3); return out; }
function parentWorldQuat(b, out) {
  if (b.parent) { b.parent.matrixWorld.decompose(v4, out, v3); } else out.identity();
  return out;
}

/** Rotate bone `b` (world space) by delta quaternion, keeping its position. */
function applyWorldDelta(b, delta, weight = 1) {
  worldQuat(b, q0);
  q1.copy(delta).multiply(q0);              // new world rotation
  parentWorldQuat(b, q2).invert();
  q1.premultiply(q2);                        // new local rotation
  if (weight < 1) b.quaternion.slerp(q1, weight); else b.quaternion.copy(q1);
  b.updateMatrixWorld(true);
}

/**
 * Two-bone IK. a=root joint, b=middle joint, c=end effector (all Bones, world matrices up to date).
 * target/pole are world Vector3. Returns residual distance (target minus reachable).
 */
export function twoBoneIK(a, b, c, target, pole, weight = 1, keepEndWorldRot = false) {
  if (weight <= 0) return 0;
  worldPos(a, v0); worldPos(b, v1); worldPos(c, v2);
  const l1 = v0.distanceTo(v1), l2 = v1.distanceTo(v2);
  v3.copy(target).sub(v0);
  let d = v3.length();
  const reach = l1 + l2 - 1e-4, minR = Math.abs(l1 - l2) + 1e-3;
  const residual = Math.max(0, d - reach);
  const dc = Math.min(Math.max(d, minR), reach);
  const dir = v3.normalize().clone();
  // bend direction: pole projected perpendicular to dir (fallback to current bend)
  let bend;
  if (pole) bend = pole.clone().sub(v0); else bend = v1.clone().sub(v0);
  bend.addScaledVector(dir, -bend.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1).addScaledVector(dir, -dir.z);
  bend.normalize();
  const x = (dc * dc + l1 * l1 - l2 * l2) / (2 * dc);
  const h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  const newB = v0.clone().addScaledVector(dir, x).addScaledVector(bend, h);
  const endRot = keepEndWorldRot ? worldQuat(c, new THREE.Quaternion()) : null;
  // rotate a so that a->b points at newB
  const cur1 = v1.clone().sub(v0).normalize();
  const nw1 = newB.clone().sub(v0).normalize();
  const dq1 = new THREE.Quaternion().setFromUnitVectors(cur1, nw1);
  applyWorldDelta(a, dq1, weight);
  worldPos(b, v1); worldPos(c, v2);
  // rotate b so that b->c points at target (clamped)
  const tgt = v0.clone().addScaledVector(dir, dc);
  const cur2 = v2.clone().sub(v1).normalize();
  const nw2 = tgt.clone().sub(v1).normalize();
  const dq2 = new THREE.Quaternion().setFromUnitVectors(cur2, nw2);
  applyWorldDelta(b, dq2, weight);
  if (endRot) {
    parentWorldQuat(c, q2).invert();
    q1.copy(endRot).premultiply(q2);
    if (weight < 1) c.quaternion.slerp(q1, weight); else c.quaternion.copy(q1);
    c.updateMatrixWorld(true);
  }
  return residual;
}

/** Aim bone so that its child direction points at the target. */
export function aimBone(bone, child, target, weight = 1) {
  worldPos(bone, v0); worldPos(child, v1);
  const cur = v1.clone().sub(v0).normalize();
  const want = v2.copy(target).sub(v0).normalize();
  const dq = new THREE.Quaternion().setFromUnitVectors(cur, want);
  applyWorldDelta(bone, dq, weight);
}

/** Rotate the eyes toward a world target with angular limits (radians). */
export function eyesLookAt(eyeBone, target, maxYaw = 0.6, maxPitch = 0.45, weight = 1) {
  eyeBone.quaternion.identity();
  eyeBone.updateMatrixWorld(true);
  v0.copy(target);
  eyeBone.worldToLocal(v0);
  const yaw = Math.atan2(v0.x, v0.z), pitch = Math.atan2(-v0.y, Math.hypot(v0.x, v0.z));
  const yy = Math.max(-maxYaw, Math.min(maxYaw, yaw)) * weight, pp = Math.max(-maxPitch, Math.min(maxPitch, pitch)) * weight;
  q0.setFromEuler(new THREE.Euler(pp, yy, 0, 'YXZ'));
  eyeBone.quaternion.copy(q0);
}

// Points (bone-local) that can touch the ground: [bone, x, y, z, radius]
export const GROUND_POINTS = [
  ['foot_l', 0, -0.078, -0.04, 0.0], ['foot_r', 0, -0.078, -0.04, 0.0],
  ['ball_l', 0, -0.030, 0.04, 0.0], ['ball_r', 0, -0.030, 0.04, 0.0],
  ['toe_big_l', 0, -0.026, 0.02, 0.0], ['toe_big_r', 0, -0.026, 0.02, 0.0],
  ['calf_l', 0, 0.0, 0.03, 0.062], ['calf_r', 0, 0.0, 0.03, 0.062],
  ['hand_l', 0, -0.07, 0, 0.032], ['hand_r', 0, -0.07, 0, 0.032],
  ['lowerarm_l', 0, -0.12, 0, 0.038], ['lowerarm_r', 0, -0.12, 0, 0.038],
  ['upperarm_l', 0, -0.05, 0, 0.055], ['upperarm_r', 0, -0.05, 0, 0.055],
  ['pelvis', 0, -0.06, -0.06, 0.115], ['spine_03', 0, 0.0, -0.04, 0.125], ['head', 0, 0.09, 0.0, 0.105],
  ['thigh_l', 0, -0.20, 0.0, 0.085], ['thigh_r', 0, -0.20, 0.0, 0.085],
];

/** Lowest world height among ground-contact points (call after world matrices are updated). */
export function lowestPoint(rig, points = GROUND_POINTS) {
  let lo = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const b = rig.bones[p[0]];
    v0.set(p[1], p[2], p[3]).applyMatrix4(b.matrixWorld);
    const y = v0.y - p[4];
    if (y < lo) lo = y;
  }
  return lo;
}
