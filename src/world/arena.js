// Official indoor arena: LED boards, tiered stands with an animated instanced crowd, roof trusses
// with lighting rigs, video wall and banners. Everything is procedural.
import * as THREE from 'three';
import { canvasTex, adBoardTex, drawLogo, shade } from './textures.js';
import { makeRng } from '../util/math.js';
import { FLOOR_W, FLOOR_L } from './court.js';

const QUAL = { high: { crowd: 1.0, shadow: 2048 }, medium: { crowd: 0.6, shadow: 1024 }, low: { crowd: 0.3, shadow: 512 } };

export function buildArena(opts = {}) {
  const quality = opts.quality || 'high';
  const Q = QUAL[quality];
  const rng = makeRng(opts.seed ?? 7);
  const g = new THREE.Group();
  const anim = { update: () => {}, crowdExcite: 0 };
  const teams = opts.teamColors || [0x1c3f9c, 0x15171c];

  // -------- lights --------
  const hemi = new THREE.HemisphereLight(0xc7d6ff, 0x6a3a4a, 0.95); g.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2e6, 2.3);
  sun.position.set(6, 22, 12); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 16; sc.bottom = -16; sc.near = 5; sc.far = 50; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  g.add(sun); g.add(sun.target);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.6); fill.position.set(-8, 12, -10); g.add(fill);

  // -------- surrounding floor beyond the free zone --------
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x0d1330, roughness: 0.8 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; g.add(outer);

  // -------- LED boards --------
  const bx = FLOOR_W / 2 - 0.4, bz = FLOOR_L / 2 - 0.4;
  const boardMats = [];
  const mkBoard = (len, x, z, ry, off) => {
    const t = adBoardTex(off); t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 8.8, 1);
    const m = new THREE.MeshBasicMaterial({ map: t }); boardMats.push(m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.16), [new THREE.MeshStandardMaterial({ color: 0x0a0d18 }), new THREE.MeshStandardMaterial({ color: 0x0a0d18 }), new THREE.MeshStandardMaterial({ color: 0x0a0d18 }), new THREE.MeshStandardMaterial({ color: 0x0a0d18 }), m, m]);
    b.position.set(x, 0.45, z); b.rotation.y = ry; g.add(b); return b;
  };
  mkBoard(FLOOR_L - 0.4, -bx, 0, Math.PI / 2 * 1 + Math.PI, 0); mkBoard(FLOOR_L - 0.4, bx, 0, Math.PI / 2, 3);
  mkBoard(FLOOR_W - 0.4, 0, -bz, 0, 6); mkBoard(FLOOR_W - 0.4, 0, bz, Math.PI, 8);

  // -------- stands --------
  const rows = 16, stepH = 0.42, stepD = 0.8;
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1a2148, roughness: 0.9 });
  const seatColors = [0x2b3f8a, 0x8a2b3f, 0x2f8a6b, 0xb0892a];
  const side = (sx) => { // long sides (along z)
    const len = FLOOR_L + 10;
    const geo = new THREE.BoxGeometry(stepD, stepH, len);
    const inst = new THREE.InstancedMesh(geo, standMat, rows);
    const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) { m4.makeTranslation(sx * (FLOOR_W / 2 + 1.5 + r * stepD), stepH / 2 + r * stepH, 0); inst.setMatrixAt(r, m4); }
    // stepped block below each row
    g.add(inst);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(rows * stepD, rows * stepH, len), new THREE.MeshStandardMaterial({ color: 0x12173a, roughness: 1 }));
    fill.position.set(sx * (FLOOR_W / 2 + 1.5 + rows * stepD / 2 - stepD / 2), rows * stepH / 2 - 0.05, 0); fill.scale.set(1, 0.5, 1); g.add(fill);
  };
  side(-1); side(1);
  const endStand = (sz) => {
    const len = FLOOR_W + 6;
    const geo = new THREE.BoxGeometry(len, stepH, stepD);
    const inst = new THREE.InstancedMesh(geo, standMat, rows);
    const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) { m4.makeTranslation(0, stepH / 2 + r * stepH, sz * (FLOOR_L / 2 + 1.5 + r * stepD)); inst.setMatrixAt(r, m4); }
    g.add(inst);
  };
  endStand(-1); endStand(1);

  // -------- crowd (instanced, animated in the vertex shader) --------
  const spots = [];
  const addRow = (fn, n, spacing) => { for (let i = 0; i < n; i++) spots.push(fn(i)); };
  for (let r = 0; r < rows; r++) {
    const y = stepH + r * stepH + 0.02;
    for (const sx of [-1, 1]) { const x = sx * (FLOOR_W / 2 + 1.5 + r * stepD), n = Math.floor((FLOOR_L + 8) / 0.62); for (let i = 0; i < n; i++) spots.push({ x, y, z: -((FLOOR_L + 8) / 2) + i * 0.62 + (r % 2) * 0.3, ry: -sx * Math.PI / 2 }); }
    for (const sz of [-1, 1]) { const z = sz * (FLOOR_L / 2 + 1.5 + r * stepD), n = Math.floor((FLOOR_W + 4) / 0.62); for (let i = 0; i < n; i++) spots.push({ x: -((FLOOR_W + 4) / 2) + i * 0.62 + (r % 2) * 0.3, y, z, ry: sz > 0 ? Math.PI : 0 }); }
  }
  const keep = spots.filter(() => rng() < Q.crowd * 0.92);
  const N = keep.length;
  const bodyGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.62, 8); bodyGeo.translate(0, 0.31 + 0.16, 0);
  const headGeo = new THREE.SphereGeometry(0.115, 10, 8); headGeo.translate(0, 0.98, 0);
  const armGeo = new THREE.BoxGeometry(0.09, 0.42, 0.09); armGeo.translate(0.24, 0.72, 0);
  const merged = mergeGeos([bodyGeo, headGeo, armGeo]);
  const phase = new Float32Array(N), excite = new Float32Array(N);
  const crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0.15 } };
  crowdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uExcite = uniforms.uExcite;
    sh.vertexShader = 'attribute float aPhase; attribute float aExc; uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float jump = max(0.0, sin(uTime * (5.0 + aExc * 3.0) + aPhase)) * uExcite * (0.25 + aExc * 0.3);
      transformed.y += jump;
      float arm = step(0.2, position.x) * step(0.5, position.y);
      transformed.y += arm * uExcite * (0.25 + 0.2 * sin(uTime * 7.0 + aPhase * 3.0)) ;
      transformed.x += sin(uTime * 1.3 + aPhase) * 0.02;`);
  };
  const crowd = new THREE.InstancedMesh(merged, crowdMat, N);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const palette = [teams[0], teams[1], 0xe8e8e8, 0xd6a441, 0x2f6f5f, 0x8a3b3b, 0x3a4a7a, 0xb85c38, 0x222831, 0xf0e6d0];
  for (let i = 0; i < N; i++) {
    const s = keep[i];
    m4.makeRotationY(s.ry); m4.setPosition(s.x, s.y, s.z); m4.scale(new THREE.Vector3(0.9 + rng() * 0.2, 0.92 + rng() * 0.18, 0.9 + rng() * 0.2));
    crowd.setMatrixAt(i, m4);
    const c = rng() < 0.32 ? teams[rng() < 0.5 ? 0 : 1] : palette[Math.floor(rng() * palette.length)];
    col.setHex(c).offsetHSL(0, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.12); crowd.setColorAt(i, col);
    phase[i] = rng() * 6.28; excite[i] = rng();
  }
  crowd.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  crowd.geometry.setAttribute('aExc', new THREE.InstancedBufferAttribute(excite, 1));
  crowd.instanceColor.needsUpdate = true; crowd.frustumCulled = false;
  g.add(crowd);

  // -------- roof trusses and light rigs --------
  const roofY = 15;
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.6 });
  for (let x = -18; x <= 18; x += 4.5) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, FLOOR_L + 24), beamMat); b.position.set(x, roofY, 0); g.add(b); }
  for (let z = -20; z <= 20; z += 5) { const b = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W + 26, 0.28, 0.2), beamMat); b.position.set(0, roofY - 0.4, z); g.add(b); }
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x06070d })); roof.rotation.x = Math.PI / 2; roof.position.y = roofY + 3; g.add(roof);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  const glowTex = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,248,230,1)'); gr.addColorStop(0.3, 'rgba(255,240,210,0.45)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }, { aniso: 1 });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
  for (let x = -12; x <= 12; x += 4.5) for (let z = -16; z <= 16; z += 5) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.7), lightMat); box.position.set(x, roofY - 0.9, z + 0.4); g.add(box);
    const sp = new THREE.Sprite(glowMat); sp.scale.set(5.5, 5.5, 1); sp.position.set(x, roofY - 1.0, z + 0.4); g.add(sp);
  }

  // -------- video wall + banners --------
  const wallTex = canvasTex(2048, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0e1c4a'); gr.addColorStop(1, '#5a1230'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.5; for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#d1284a' : '#2f5bd6'; c.beginPath(); c.moveTo(w * (i / 9), 0); c.lineTo(w * (i / 9) + 260, 0); c.lineTo(w * (i / 9) - 60, h); c.lineTo(w * (i / 9) - 320, h); c.fill(); } c.globalAlpha = 1;
    drawLogo(c, w * 0.5, h * 0.42, 720, { text: '#e9eeff' });
    // golden kicking silhouette
    c.fillStyle = '#e0b660'; c.beginPath(); c.moveTo(w * 0.16, h * 0.78); c.quadraticCurveTo(w * 0.2, h * 0.3, w * 0.27, h * 0.22); c.lineTo(w * 0.31, h * 0.26); c.quadraticCurveTo(w * 0.24, h * 0.42, w * 0.22, h * 0.8); c.fill();
  }, { aniso: 8 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.75), new THREE.MeshBasicMaterial({ map: wallTex })); wall.position.set(0, 5.2, -FLOOR_L / 2 - 1.2); g.add(wall);
  const wall2 = wall.clone(); wall2.position.set(0, 5.2, FLOOR_L / 2 + 1.2); wall2.rotation.y = Math.PI; g.add(wall2);
  const banner = (x, z, ry) => {
    const t = canvasTex(256, 768, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#182a63'); gr.addColorStop(1, '#a01d3c'); c.fillStyle = gr; c.fillRect(0, 0, w, h); drawLogo(c, w / 2, h * 0.34, 230, { text: '#ffffff' }); c.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 6; i++) c.fillRect(0, h * 0.62 + i * 26, w, 8); });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7.4), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); b.position.set(x, 9.6, z); b.rotation.y = ry; g.add(b);
  };
  for (const z of [-11, -3, 5, 13]) { banner(-FLOOR_W / 2 - 2.5, z, Math.PI / 2); banner(FLOOR_W / 2 + 2.5, z, -Math.PI / 2); }

  // -------- per-frame --------
  let t = 0;
  anim.update = (dt, excite = 0) => {
    t += dt; uniforms.uTime.value = t;
    anim.crowdExcite += (excite - anim.crowdExcite) * Math.min(1, dt * 2.5);
    uniforms.uExcite.value = 0.12 + anim.crowdExcite * 0.85;
    boardMats.forEach((m, i) => { m.map.offset.x = (t * 0.02 * (i % 2 ? 1 : -1)) % 1; });
  };
  anim.sun = sun; anim.hemi = hemi;
  return { group: g, anim, sun, hemi };
}

function mergeGeos(list) {
  let n = 0, ni = 0;
  for (const gg of list) { n += gg.attributes.position.count; ni += gg.index ? gg.index.count : gg.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, io = 0;
  for (const gg of list) {
    pos.set(gg.attributes.position.array, o * 3); nor.set(gg.attributes.normal.array, o * 3);
    const cnt = gg.attributes.position.count;
    if (gg.index) for (let i = 0; i < gg.index.count; i++) idx[io++] = gg.index.array[i] + o; else for (let i = 0; i < cnt; i++) idx[io++] = i + o;
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
