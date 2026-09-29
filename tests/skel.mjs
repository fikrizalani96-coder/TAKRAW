import * as THREE from 'three';
import { buildRig, makeDims, countJoints } from '../src/character/skeleton.js';
import { RigPoser, REST_POSE, CHANNELS, NCH, P, STAND_POSE, mirrorPose } from '../src/anim/pose.js';
const rig = buildRig(makeDims({ height: 1.75 }));
new RigPoser(rig).apply(REST_POSE);
rig.root.updateMatrixWorld(true);
const w = (n) => new THREE.Vector3().setFromMatrixPosition(rig.bones[n].matrixWorld);
const f = (v) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
console.log('joints', countJoints(), 'channels', NCH);
for (const n of ['pelvis','spine_05','neck_01','head','jaw','eye_l','upperarm_l','lowerarm_l','hand_l','middle_03_l','thumb_03_l','thigh_l','calf_l','foot_l','ball_l','toe_big_l'])
  console.log(n.padEnd(14), f(w(n)));
// pose sanity: arm raised forward 90deg -> hand should be in front
const p = P({ L: { sh_f: 90 } }, STAND_POSE);
new RigPoser(rig).apply(p); rig.root.updateMatrixWorld(true);
console.log('L arm fwd90 hand', f(w('hand_l')), '(expect z>0, y~1.4)');
const p2 = P({ L: { sh_a: 90 } });
new RigPoser(rig).apply(p2); rig.root.updateMatrixWorld(true);
console.log('L arm abd90 hand', f(w('hand_l')), '(expect x>0, y~1.4)');
const p3 = P({ L: { hp_f: 90, kn_f: 90 } });
new RigPoser(rig).apply(p3); rig.root.updateMatrixWorld(true);
console.log('L thigh flex90 knee', f(w('calf_l')), 'foot', f(w('foot_l')), '(expect knee z>0 same height as hip, foot below knee)');
const p4 = P({ L: { sh_f: 90, el_f: 90, fa_p: 90 } });
new RigPoser(rig).apply(p4); rig.root.updateMatrixWorld(true);
console.log('L arm fwd90 elbow90 hand', f(w('hand_l')), '(expect hand above elbow, z~elbow)');
const p5 = P({ spine: [45] }); new RigPoser(rig).apply(p5); rig.root.updateMatrixWorld(true);
console.log('spine flex45 head', f(w('head')), '(expect z>0)');
const p6 = P({ R: { sh_a: 90 } }); new RigPoser(rig).apply(p6); rig.root.updateMatrixWorld(true);
console.log('R arm abd90 hand', f(w('hand_r')), '(expect x<0)');
