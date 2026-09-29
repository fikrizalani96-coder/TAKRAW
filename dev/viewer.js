import * as THREE from 'three';
import { buildRig, makeDims } from '../src/character/skeleton.js';
import { RigPoser, REST_POSE, STAND_POSE, P } from '../src/anim/pose.js';
import { computeBind, buildBodyScene } from '../src/character/anatomy.js';
import { buildSkinnedGeometry } from '../src/character/geo.js';

const q = new URLSearchParams(location.search);
const log = (s) => { document.getElementById('log').textContent += s + '\n'; };
const W = +q.get('w') || innerWidth, H = +q.get('h') || innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x30343c);
scene.add(new THREE.HemisphereLight(0xdde6ff, 0x554433, 1.0));
const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(3, 5, 4); scene.add(dl);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x884455 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);

const t0 = performance.now();
const rig = buildRig(makeDims({ height: +q.get('height') || 1.78 }));
const bind = computeBind(rig);
const sc = buildBodyScene(rig, bind, { muscle: +q.get('muscle') || 1 });
const b = sc.bounds();
const geo = buildSkinnedGeometry(sc, b, +q.get('h_') || 0.007, bind, rig, { color: () => [0.85, 0.62, 0.48] });
log(`joints ${rig.list.length}  verts ${geo.getAttribute('position').count}  tris ${geo.index.count / 3}  ${(performance.now() - t0).toFixed(0)}ms`);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
const skel = new THREE.Skeleton(rig.list);
const mesh = new THREE.SkinnedMesh(geo, mat);
mesh.add(rig.root); mesh.bind(skel, new THREE.Matrix4());
scene.add(mesh);
const poseName = q.get('pose') || 'rest';
const poses = {
  rest: REST_POSE, stand: STAND_POSE,
  arms: P({ LR: { sh_f: 100, sh_a: 20, el_f: 30 } }, STAND_POSE),
  kick: P({ L: { hp_f: 100, kn_f: 30, an_p: 40 }, R: { hp_f: 10, kn_f: 30 }, spine: [10], LR: { sh_a: 40, el_f: 40 } }, STAND_POSE),
  crouch: P({ hy: -0.25, spine: [30], LR: { hp_f: 70, kn_f: 100, an_p: -10, sh_f: 50, el_f: 60 } }, STAND_POSE),
  twist: P({ spine: [10, 0, 30], chest: [0, 0, 30], neck: [0, 0, 20], LR: { sh_t: 40 } }, STAND_POSE),
};
new RigPoser(rig).apply(poses[poseName] || REST_POSE);
rig.root.updateMatrixWorld(true);
const az = (+q.get('az') || 20) * Math.PI / 180, dist = +q.get('dist') || 4.2, cy = +q.get('cy') || 0.95;
cam.position.set(Math.sin(az) * dist, cy + 0.2, Math.cos(az) * dist); cam.lookAt(0, cy, 0);
renderer.render(scene, cam);
window.__ready = true; window.__info = document.getElementById('log').textContent;
