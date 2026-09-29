// Live 3D backdrop for the title screen: a fully rigged athlete performing a rotating showcase of techniques
// (roll spike, scissor spike, power serve, celebration) on a pink court disc under slow orbiting camera.
import * as THREE from 'three';
import { getBodyKit, ensureOutfit, getHeadGeo, createHuman } from '../character/humanFactory.js';
import { TEAMS } from '../character/kits.js';
import { randomFace } from '../character/head.js';
import { makeRng } from '../util/math.js';
import { Animator } from '../anim/animator.js';
import { getClip } from '../anim/catalog.js';
import { buildBallMesh } from '../world/ballmesh.js';

const SHOW = [
  ['atk.gulung.R.low.straight', 'spike'], ['serve.instep.R.power.line', 'serve'], ['atk.gunting.R.low.right', 'spike'],
  ['cel.fistpump.R.strong', 'idle'], ['atk.kuda.R.low.straight', 'spike'], ['atk.kilas.R.low.straight', 'spike'], ['cel.arms.up.v', 'idle'], ['atk.roda.R.low.left', 'spike'],
];

export class TitleBackdrop {
  constructor(renderer, quality = 'medium') {
    this.renderer = renderer; this.quality = quality; this.ready = false; this.t = 0; this.idx = 0; this.clipT = 0;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b1e); scene.fog = new THREE.Fog(0x070b1e, 8, 22);
    scene.add(new THREE.HemisphereLight(0xcfd9ff, 0x2a1f35, 0.9));
    const key = this.key = new THREE.DirectionalLight(0xfff0dd, 2.8); key.position.set(3.5, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(quality === 'low' ? 512 : 1024, quality === 'low' ? 512 : 1024);
    const sc = key.shadow.camera; sc.left = -3.5; sc.right = 3.5; sc.top = 4; sc.bottom = -2; sc.near = 1; sc.far = 16; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
    scene.add(key); scene.add(key.target);
    const rim = new THREE.DirectionalLight(0x5a8bff, 1.6); rim.position.set(-4, 3, -4); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 72), new THREE.MeshStandardMaterial({ color: 0xc8506a, roughness: 0.72 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    for (const r of [2.6, 5.4]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; scene.add(ring); }
    // soft glow sprites behind the athlete
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: 0x3d5cff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(14, 9, 1); glow.position.set(-2, 3.4, -7); scene.add(glow);
    this.ball = buildBallMesh(0.0668); this.ball.scale.setScalar(1.35); this.ball.visible = false; scene.add(this.ball);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  }

  async init() {
    const kit = await getBodyKit('killer', this.quality); await ensureOutfit(kit, 'sport');
    const face = randomFace(makeRng(7)); const head = await getHeadGeo(kit, 'title', face);
    const h = this.human = createHuman(kit, head, { skin: 2, hairStyle: 'short', hairColor: 0, face, faceKey: 'title', kit: TEAMS.THA.kit, number: 9, name: 'WONGSA', outfit: 'sport', accessories: { knee: true, wrist: true } });
    h.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(h.group);
    this.anim = new Animator(h);
    this.list = SHOW.filter(([id]) => getClip(id));
    this.next();
    this.ready = true;
  }

  next() {
    const [id, kind] = this.list[this.idx++ % this.list.length];
    const clip = getClip(id); this.clip = clip; this.kind = kind; this.clipT = 0;
    this.anim.play(clip, { fadeIn: 0.2, fadeOut: 0.3, loop: false });
    this.anim.setLocomotion(0, 0, 0.6);
    const c = clip.meta && clip.meta.contact;
    this.contact = c && c.T ? { T: c.T, tc: clip.events.contact } : null;
    this.dur = clip.duration + 1.1;
  }

  /** Ball choreography: drops into the contact point, then leaves the player's foot/hand. */
  driveBall(dt) {
    const c = this.contact, b = this.ball; if (!c) { b.visible = false; return; }
    const t = this.clipT, tc = c.tc, g = 9.81, T = c.T;
    b.visible = true;
    let x, y, z;
    if (t < tc) { const u = tc - t; x = T[0]; y = T[1] + 0.5 * g * u * u * 0.9 + u * 1.5; z = T[2] - u * 0.9; if (u > 0.7) b.visible = false; }
    else {
      const u = t - tc, vy = this.kind === 'spike' ? -4 : 6.5, vz = this.kind === 'spike' ? 16 : 11;
      x = T[0] + u * 0.6; z = T[2] + u * vz; y = T[1] + vy * u - 0.5 * g * u * u;
      if (y < 0.07) { y = 0.07; b.visible = u < 1.2; }
    }
    b.position.set(x, y, z); b.rotation.x += dt * 12; b.rotation.y += dt * 5;
    if (this.anim.act && t <= tc + 0.02) this.anim.setContactTarget({ x: T[0], y: T[1], z: T[2] }, 1);
  }

  resize(w, h) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }

  update(dt) {
    if (!this.ready) return;
    this.t += dt; this.clipT += dt;
    if (this.clipT > this.dur) this.next();
    this.anim.update(dt); this.driveBall(dt);
    this.human.group.updateMatrixWorld(true);
    const w = innerWidth, h = innerHeight, wide = w > h * 1.15;
    this.resize(w, h);
    const a = 0.75 + 0.35 * Math.sin(this.t * 0.22), d = wide ? 6.4 : 7.4;
    this.cam.position.set(Math.sin(a) * d, 1.15 + 0.25 * Math.sin(this.t * 0.31), Math.cos(a) * d);
    this.cam.lookAt(0, 1.15, 0.2);
    if (wide) this.cam.setViewOffset(w, h, -Math.round(w * 0.27), 0, w, h); else this.cam.setViewOffset(w, h, 0, Math.round(h * 0.16), w, h);
    this.renderer.render(this.scene, this.cam);
    this.cam.clearViewOffset();
  }
}

function radial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
