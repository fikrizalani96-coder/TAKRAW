import * as THREE from 'three';
import { getBodyKit, getHeadGeo, createHuman } from '../src/character/humanFactory.js';
import { TEAMS } from '../src/character/kits.js';
import { randomFace } from '../src/character/head.js';
import { makeRng } from '../src/util/math.js';
import { Animator } from '../src/anim/animator.js';
import '../src/anim/catalog.js';
import { getClip, clipCount } from '../src/anim/clip.js';

const q = new URLSearchParams(location.search);
const log = (s) => { document.getElementById('log').textContent += s + '\n'; };
const W = +q.get('w') || innerWidth, H = +q.get('h') || innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b2f38);
scene.add(new THREE.HemisphereLight(0xdde6ff, 0x554433, 1.1));
const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(2, 4, 4); scene.add(dl);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xc8506a, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(40, 80, 0xffffff, 0x884455); grid.position.y = 0.002; scene.add(grid);
const team = TEAMS[q.get('team') || 'THA'];
const kitB = await getBodyKit(q.get('build') || 'killer', q.get('quality') || 'low'); await (await import('../src/character/humanFactory.js')).ensureOutfit(kitB, 'sport');
const rng = makeRng(3);
const face = randomFace(rng);
const headGeo = await getHeadGeo(kitB, 'f1', face);
const human = createHuman(kitB, headGeo, { skin: 1, hairStyle: 'short', hairColor: 0, face, faceKey: 'f1', kit: team.kit, number: 25, name: 'WONGSA', outfit: 'sport', accessories: { knee: true } });
scene.add(human.group);
const anim = new Animator(human);
const mode = q.get('mode') || 'gait';
const N = +q.get('n') || 8;
const cols = +q.get('cols') || N;
const tw = Math.floor(W / cols), th = Math.floor(H / Math.ceil(N / cols));
const cam = new THREE.PerspectiveCamera(30, tw / th, 0.05, 80);
const az = (+q.get('az') || 90) * Math.PI / 180;
const dist = +q.get('dist') || 4.6;
const frames = [];
if (mode === 'gait') {
  const vf = +q.get('vf') || 0, vl = +q.get('vl') || 0;
  anim.setLocomotion(vf, vl, +q.get('crouch') || 0.5);
  const sp = Math.hypot(vf, vl);
  // warm up then step through one cycle
  for (let i = 0; i < 5; i++) anim.update(1 / 60);
  const cyc = 1 / (0.7 + 0.145 * sp);
  for (let i = 0; i < N; i++) { const steps = Math.round(cyc / N * 60); for (let k = 0; k < steps; k++) anim.update(1 / 60); frames.push({ cx: 0 }); render(i); }
} else {
  // clip mode: sample a clip at N times, one tile each
  const id = q.get('clip');
  const clip = getClip(id);
  if (!clip) throw new Error('no clip ' + id);
  log(`${id} dur ${clip.duration.toFixed(2)}s contact ${clip.events?.contact}  catalogue ${clipCount()}`);
  anim.play(clip, { fadeIn: 0.001, hold: true });
  anim.setLocomotion(0, 0);
  const dur = clip.duration;
  let tcur = 0;
  for (let i = 0; i < N; i++) {
    const target = (i / (N - 1)) * dur;
    while (tcur < target - 1e-6) { const dt = Math.min(1 / 60, target - tcur); anim.update(dt); tcur += dt; }
    if (q.get('ball')) { const cm = clip.meta?.contact; }
    render(i, i === 0 ? 0 : target);
  }
}
function render(i, t) {
  const col = i % cols, row = Math.floor(i / cols);
  const x = col * tw, y = H - (row + 1) * th;
  renderer.setViewport(x, y, tw, th); renderer.setScissor(x, y, tw, th);
  const cy = +q.get('cy') || 0.9;
  human.group.updateMatrixWorld(true);
  cam.position.set(Math.sin(az) * dist, cy + 0.25, Math.cos(az) * dist); cam.lookAt(0, cy, 0);
  renderer.render(scene, cam);
}
log(`joints ${human.rig.list.length} clips ${clipCount()}`);
window.__ready = true; window.__info = document.getElementById('log').textContent;
