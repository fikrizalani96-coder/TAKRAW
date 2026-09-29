// Kampung Takraw: a Malay village court at golden hour. Packed-earth court with hand-drawn lime lines,
// bamboo poles and a fishing-net, stilt houses, coconut palms, banana plants, bamboo fence, villagers on
// benches, wandering chickens and drifting dust. All procedural.
import * as THREE from 'three';
import { COURT } from '../game/config.js';
import { canvasTex, noiseTex } from './textures.js';
import { buildNet } from './court.js';
import { makeRng } from '../util/math.js';

const QUAL = { high: { shadow: 2048, people: 60, palms: 16 }, medium: { shadow: 1024, people: 40, palms: 12 }, low: { shadow: 512, people: 22, palms: 8 } };

function dirtTexture() {
  const PX = 80, W = 28 * PX, H = 38 * PX;
  return canvasTex(W, H, (g) => {
    const rnd = (a, b) => a + Math.random() * (b - a);
    // dry grass everywhere, then the packed earth court fading into it
    g.fillStyle = '#7d8446'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${90 + rnd(0, 60)},${100 + rnd(0, 50)},${40 + rnd(0, 30)},${rnd(0.1, 0.4)})`; g.fillRect(rnd(0, W), rnd(0, H), rnd(2, 9), rnd(6, 26)); }
    const cx = W / 2, cy = H / 2;
    const grd = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.18, cx, cy, Math.min(W, H) * 0.58);
    grd.addColorStop(0, 'rgba(166,124,84,1)'); grd.addColorStop(0.72, 'rgba(158,118,80,0.98)'); grd.addColorStop(1, 'rgba(158,118,80,0)');
    g.save(); g.translate(cx, cy); g.scale(0.72, 1); g.translate(-cx, -cy); g.fillStyle = grd; g.fillRect(0, 0, W, H); g.restore();
    // court rectangle: slightly darker, well-trodden earth
    const sw = (COURT.W + 3.4) * PX, sl = (COURT.L + 3.4) * PX;
    for (let k = 0; k < 14; k++) { const ins = (k / 14) * 1.6 * PX - 0.8 * PX; g.fillStyle = 'rgba(132,96,62,0.042)'; g.fillRect(cx - sw / 2 + ins, cy - sl / 2 + ins, sw - ins * 2, sl - ins * 2); }   // feathered edge
    for (let i = 0; i < 12000; i++) { const x = rnd(cx - sw / 2, cx + sw / 2), y = rnd(cy - sl / 2, cy + sl / 2); g.fillStyle = Math.random() < 0.5 ? `rgba(90,58,34,${rnd(0.06, 0.22)})` : `rgba(190,140,92,${rnd(0.05, 0.18)})`; g.beginPath(); g.arc(x, y, rnd(1, 5), 0, 6.3); g.fill(); }
    // footprints and scuffs
    g.strokeStyle = 'rgba(80,50,30,0.16)';
    for (let i = 0; i < 260; i++) { const x = rnd(cx - sw / 2, cx + sw / 2), y = rnd(cy - sl / 2, cy + sl / 2); g.lineWidth = rnd(3, 9); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-40, 40)); g.stroke(); }
    // hand-drawn lime lines (ISTAF geometry, wobbly like real village markings)
    const m = (v) => v * PX;
    const wob = () => rnd(-1.6, 1.6);
    g.strokeStyle = 'rgba(244,240,226,0.92)'; g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (pts, w = 5) => { g.lineWidth = w + rnd(-0.6, 1.2); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + wob(), p[1] + wob()) : g.moveTo(p[0], p[1]))); g.stroke(); };
    const hw = COURT.halfW, hl = COURT.halfL;
    const seg = (x0, y0, x1, y1) => { const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 30)); const pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); line(pts); };
    seg(cx - m(hw), cy - m(hl), cx + m(hw), cy - m(hl)); seg(cx + m(hw), cy - m(hl), cx + m(hw), cy + m(hl)); seg(cx + m(hw), cy + m(hl), cx - m(hw), cy + m(hl)); seg(cx - m(hw), cy + m(hl), cx - m(hw), cy - m(hl));
    seg(cx - m(hw), cy, cx + m(hw), cy);
    const arc = (ax, ay, r, a0, a1) => { const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r]); } line(pts); };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) arc(cx + sx * m(hw), cy, m(COURT.quarterR), sx > 0 ? (sz > 0 ? Math.PI / 2 : Math.PI) : (sz > 0 ? 0 : -Math.PI / 2), sx > 0 ? (sz > 0 ? Math.PI : Math.PI * 1.5) : (sz > 0 ? Math.PI / 2 : 0));
    for (const sz of [-1, 1]) arc(cx, cy + sz * m(hl - COURT.serviceFromBack), m(COURT.serviceCircleR), 0, Math.PI * 2);
  }, { aniso: 8 });
}

function frondGeometry(len = 3.2, wid = 0.55, bend = 0.9, segs = 8) {
  const geo = new THREE.PlaneGeometry(wid, len, 2, segs);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) + len / 2) / len));          // 0 root .. 1 tip
    const w = 1 - Math.pow(t, 1.6) * 0.85;
    p.setX(i, p.getX(i) * w);
    p.setZ(i, -Math.pow(t, 2) * bend * len * 0.5 + (Math.abs(p.getX(i)) * 0.35));
    p.setY(i, t * len);
  }
  geo.computeVertexNormals();
  return geo;
}
function leafTexture() {
  return canvasTex(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2c6a26'); gr.addColorStop(0.5, '#4aa03a'); gr.addColorStop(1, '#2c6a26'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h * 0.05); g.lineTo(w * 0.92, h); g.lineTo(w * 0.08, h); g.lineTo(0, h * 0.05); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,60,15,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    for (let y = 10; y < h; y += 12) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w * 0.05, y + 22); g.moveTo(w / 2, y); g.lineTo(w * 0.95, y + 22); g.stroke(); }
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(w / 2, h); for (let i = 0; i <= 20; i++) { const y = h - (i / 20) * h; const xw = (w / 2) * (0.25 + 0.75 * Math.sin((i / 20) * Math.PI * 0.9 + 0.2)); g.lineTo(w / 2 + xw, y); } for (let i = 20; i >= 0; i--) { const y = h - (i / 20) * h; const xw = (w / 2) * (0.25 + 0.75 * Math.sin((i / 20) * Math.PI * 0.9 + 0.2)); g.lineTo(w / 2 - xw, y); } g.fill();
  }, { aniso: 4 });
}

function makePalm(leafMat, trunkMat, rng) {
  const g = new THREE.Group();
  const h = 8 + rng() * 5, lean = (rng() - 0.5) * 1.6;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.25, h * 0.33, 0), new THREE.Vector3(lean * 0.7, h * 0.7, 0.2), new THREE.Vector3(lean, h, 0)]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.2, 8, false), trunkMat); trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Group(); crown.position.set(lean, h, 0);
  const fg = frondGeometry(3.4 + rng(), 0.7, 0.9);
  for (let i = 0; i < 11; i++) {
    const f = new THREE.Mesh(fg, leafMat);
    f.rotation.set(0.35 + rng() * 0.5, (i / 11) * Math.PI * 2 + rng() * 0.3, 0, 'YXZ'); f.rotation.x = -(0.4 + rng() * 0.6);
    const holder = new THREE.Group(); holder.rotation.y = (i / 11) * Math.PI * 2 + rng() * 0.4; f.rotation.set(-(0.35 + rng() * 0.55) + 0.1, 0, 0); holder.add(f); f.castShadow = true; crown.add(holder);
  }
  for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6b8a2a, roughness: 0.8 })); n.position.set((rng() - 0.5) * 0.4, -0.25, (rng() - 0.5) * 0.4); crown.add(n); }
  g.add(crown); g.userData.crown = crown;
  return g;
}

function plankTexture(base, dark) {
  return canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 24) { g.fillStyle = dark; g.fillRect(x, 0, 2, h); for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x + Math.random() * 20, Math.random() * h, 1 + Math.random() * 2, 8 + Math.random() * 30); } } }, { repeat: [1, 1], aniso: 4 });
}
function tinTexture() {
  return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8c8577'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(150,70,30,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 5 + Math.random() * 30, 3 + Math.random() * 12); } }, { repeat: [3, 2], aniso: 4 });
}

function makeHouse(rng) {
  const g = new THREE.Group();
  const w = 6 + rng() * 2, d = 5 + rng() * 1.5, h = 2.6, stilt = 1.7;
  const wood = new THREE.MeshStandardMaterial({ map: plankTexture(rng() < 0.5 ? '#8a6a44' : '#7a8a6a', '#3a2a18'), roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 });
  for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, stilt, 8), dark); p.position.set(x, stilt / 2, z); p.castShadow = true; g.add(p); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.16, d + 0.4), dark); floor.position.y = stilt; floor.castShadow = true; floor.receiveShadow = true; g.add(floor);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); walls.position.y = stilt + h / 2 + 0.08; walls.castShadow = true; walls.receiveShadow = true; g.add(walls);
  const tin = new THREE.MeshStandardMaterial({ map: tinTexture(), roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.08, d / 2 + 0.9), tin); roof.position.set(0, stilt + h + 0.65, s * (d / 4 + 0.05)); roof.rotation.x = -s * 0.42; roof.castShadow = true; g.add(roof); }
  const gable = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.9, 0.05), wood); gable.position.set(0, stilt + h + 0.4, d / 2 - 0.05); g.add(gable); const gable2 = gable.clone(); gable2.position.z = -d / 2 + 0.05; g.add(gable2);
  const win = new THREE.MeshStandardMaterial({ color: 0x1a1108, roughness: 1 });
  for (const x of [-w / 4, w / 4]) { const wn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), win); wn.position.set(x, stilt + 1.5, d / 2 + 0.02); g.add(wn); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.06), win); door.position.set(0, stilt + 1.05, -d / 2 - 0.02); g.add(door);
  for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.28), dark); st.position.set(0, 0.2 + i * 0.32, -d / 2 - 0.5 - (4 - i) * 0.28); g.add(st); }
  return g;
}

export function buildKampung(opts = {}) {
  const quality = opts.quality || 'medium', Q = QUAL[quality];
  const rng = makeRng(opts.seed ?? 11);
  const g = new THREE.Group();
  const gender = opts.gender || 'men';

  // ---- sky dome & sun ----
  const skyTex = canvasTex(16, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a6ea8'); gr.addColorStop(0.42, '#9cc0d8'); gr.addColorStop(0.62, '#ffd9a0'); gr.addColorStop(0.72, '#ff9a4d'); gr.addColorStop(1, '#5a3a3a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { aniso: 1 });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; g.add(sky);
  const sunDir = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,140,0.7)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }, { aniso: 1 }), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  sunGlow.position.copy(sunDir).multiplyScalar(150); sunGlow.scale.set(60, 60, 1); g.add(sunGlow);
  // clouds
  const cloudTex = canvasTex(256, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 16; i++) { const x = 30 + Math.random() * 196, y = 40 + Math.random() * 50, r = 14 + Math.random() * 26; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,220,190,0.75)'); gr.addColorStop(1, 'rgba(255,190,150,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); } }, { aniso: 1 });
  const clouds = [];
  for (let i = 0; i < 6; i++) { const cl = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false })); cl.position.set(-90 + i * 36, 42 + rng() * 14, -110 + rng() * 40); cl.lookAt(0, 20, 0); g.add(cl); clouds.push(cl); }

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7a6a40, 1.0); g.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a6, 2.5); sun.position.copy(sunDir).multiplyScalar(30); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow); const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 20; sc.bottom = -20; sc.near = 5; sc.far = 90; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  g.add(sun); g.add(sun.target);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 0.55); rim.position.set(12, 10, -14); g.add(rim);

  // ---- ground ----
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x86a04a, map: noiseTex(256, 5, { repeat: [90, 90], amp: 0.45 }), roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03; grass.receiveShadow = true; g.add(grass);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(28, 38), new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 0.96, metalness: 0 })); dirt.rotation.x = -Math.PI / 2; dirt.receiveShadow = true; dirt.position.y = 0; g.add(dirt);

  // ---- net & poles ----
  const netApi = buildNet(gender, 'kampung'); g.add(netApi.group);

  // ---- vegetation ----
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1, map: noiseTex(128, 3, { repeat: [1, 6], amp: 0.5 }) });
  const palms = [];
  const spots = [[-13, -12], [14, -11], [-16, 3], [17, 8], [-12, 15], [13, 17], [-19, -4], [20, -3], [0, -22], [-8, -20], [9, -21], [-22, 14], [22, 14], [-5, 24], [7, 25], [-24, -14]];
  for (let i = 0; i < Q.palms && i < spots.length; i++) { const p = makePalm(leafMat, trunkMat, rng); p.position.set(spots[i][0] + (rng() - 0.5) * 2, 0, spots[i][1] + (rng() - 0.5) * 2); p.rotation.y = rng() * 6.28; g.add(p); palms.push(p); }
  const bananaGeo = frondGeometry(2.6, 0.9, 0.7, 6);
  for (let k = 0; k < 9; k++) {
    const cx = [-11, 11.5, -14.5, 15, -9, 8.5, 18, -18, 4][k], cz = [-9.5, -8, 9, 11, 19, -18, -10, 9, 21][k];
    for (let i = 0; i < 6; i++) { const holder = new THREE.Group(); holder.position.set(cx + (rng() - 0.5) * 0.8, 0, cz + (rng() - 0.5) * 0.8); holder.rotation.y = rng() * 6.28; const f = new THREE.Mesh(bananaGeo, leafMat); f.rotation.x = -(0.5 + rng() * 0.8); f.scale.setScalar(0.8 + rng() * 0.5); f.castShadow = true; holder.add(f); g.add(holder); }
  }
  // houses
  const houses = [[-15, -19, 0.35], [13, -21, -0.2], [-21.5, 2, Math.PI / 2 + 0.1], [22, 5, -Math.PI / 2], [-14, 22, Math.PI - 0.3], [12, 24, Math.PI + 0.2]];
  for (const [x, z, r] of houses.slice(0, quality === 'low' ? 4 : 6)) { const h = makeHouse(rng); h.position.set(x, 0, z); h.rotation.y = r; g.add(h); }
  // bamboo fence
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xb8a85a, roughness: 0.85 });
  const fence = (x0, z0, x1, z1) => { const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 0.32); const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.045, 1.4, 6), bamboo, n); const m = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const t = i / n; m.makeTranslation(x0 + (x1 - x0) * t, 0.7 + (rng() - 0.5) * 0.15, z0 + (z1 - z0) * t); inst.setMatrixAt(i, m); } inst.castShadow = true; g.add(inst); const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, Math.hypot(x1 - x0, z1 - z0), 6), bamboo); rail.position.set((x0 + x1) / 2, 1.0, (z0 + z1) / 2); rail.rotation.z = Math.PI / 2; rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(rail); };
  fence(-14, -17.5, 14, -17.5); fence(-14, 19.5, -4, 19.5); fence(5, 19.5, 14, 19.5);

  // ---- distant tree line & hills ----
  const tlMat = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
  const tl = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), tlMat, 70); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2 + rng() * 0.05, r = 62 + rng() * 22, s = 5 + rng() * 6; m4.makeScale(s, s * (0.8 + rng() * 0.5), s); m4.setPosition(Math.cos(a) * r, s * 0.5, Math.sin(a) * r); tl.setMatrixAt(i, m4); }
  g.add(tl);
  const hills = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 14, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x415a63, side: THREE.BackSide, fog: false })); hills.position.y = 5; g.add(hills);

  // ---- villagers (instanced simple humans, seated on benches and standing) ----
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.95 });
  const benchSpots = [[-7.6, -4.5, Math.PI / 2], [-7.6, 3.2, Math.PI / 2], [7.6, -3.0, -Math.PI / 2], [7.6, 5.5, -Math.PI / 2], [-4.0, -12.4, 0], [3.5, -12.6, 0]];
  const people = [];
  for (const [bx, bz, br] of benchSpots) {
    const b = new THREE.Group(); b.position.set(bx, 0, bz); b.rotation.y = br;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.42), woodMat); seat.position.y = 0.45; seat.castShadow = true; seat.receiveShadow = true; b.add(seat);
    for (const lx of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.36), woodMat); leg.position.set(lx, 0.22, 0); b.add(leg); }
    g.add(b);
    const n = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < n && people.length < Q.people; i++) people.push({ x: bx + Math.cos(br) * (-1.3 + i * 0.66), z: bz - Math.sin(br) * (-1.3 + i * 0.66), y: 0.5, ry: br + Math.PI / 2 * 0 + (br === 0 ? 0 : 0) + Math.PI, s: 0.85 + rng() * 0.2, seated: true });
  }
  for (let i = 0; people.length < Q.people; i++) { const side = rng() < 0.5 ? -1 : 1; people.push({ x: side * (5.2 + rng() * 2.4), z: -8 + rng() * 17, y: 0, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, s: 0.7 + rng() * 0.35, seated: false }); }
  const bodyGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.62, 8); bodyGeo.translate(0, 0.62, 0);
  const legGeo = new THREE.BoxGeometry(0.3, 0.5, 0.2); legGeo.translate(0, 0.25, 0.05);
  const headGeo = new THREE.SphereGeometry(0.115, 10, 8); headGeo.translate(0, 1.08, 0);
  const merged = mergeGeos([bodyGeo, headGeo, legGeo]);
  const pMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pu = { uTime: { value: 0 }, uExcite: { value: 0.1 } };
  pMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = pu.uTime; sh.uniforms.uExcite = pu.uExcite; sh.vertexShader = 'attribute float aPhase; uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += max(0.0, sin(uTime * 6.0 + aPhase)) * uExcite * 0.22;'); };
  const villagers = new THREE.InstancedMesh(merged, pMat, people.length);
  const ph = new Float32Array(people.length); const col = new THREE.Color();
  const tees = [0xc84b4b, 0x3b6bb0, 0xe0b03a, 0x3f8a5a, 0xe8e2d0, 0x8a4a9a, 0xd9793a, 0x2a3a4a];
  people.forEach((p, i) => { m4.makeRotationY(p.ry); m4.scale(new THREE.Vector3(p.s, p.s, p.s)); m4.setPosition(p.x, p.y, p.z); villagers.setMatrixAt(i, m4); col.setHex(tees[Math.floor(rng() * tees.length)]); villagers.setColorAt(i, col); ph[i] = rng() * 6.28; });
  villagers.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); villagers.instanceColor.needsUpdate = true; villagers.frustumCulled = false; g.add(villagers);

  // ---- chickens ----
  const chickens = [];
  const chMat = [new THREE.MeshLambertMaterial({ color: 0xb5651d }), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }), new THREE.MeshLambertMaterial({ color: 0x3a2a20 })];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), chMat[i % 3]); body.scale.set(1, 0.85, 1.35); body.position.y = 0.16; c.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), chMat[i % 3]); head.position.set(0, 0.29, 0.13); c.add(head);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: 0xd42a2a })); comb.position.set(0, 0.34, 0.13); c.add(comb);
    const side = i % 2 ? 1 : -1; c.position.set(side * (5.6 + rng() * 5), 0.0, -6 + rng() * 20); c.userData = { tx: c.position.x, tz: c.position.z, wait: rng() * 2, head }; c.castShadow = true; g.add(c); chickens.push(c);
  }
  // ---- dust motes in the golden light ----
  const dn = 260, dpos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dpos[i * 3] = (rng() - 0.5) * 30; dpos[i * 3 + 1] = rng() * 8; dpos[i * 3 + 2] = (rng() - 0.5) * 34; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe6b0, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(dust);

  let t = 0;
  const anim = {
    sun, hemi, crowdExcite: 0,
    update(dt, excite = 0) {
      t += dt; pu.uTime.value = t; this.crowdExcite += (excite - this.crowdExcite) * Math.min(1, dt * 2.5); pu.uExcite.value = 0.08 + this.crowdExcite * 0.9;
      for (const p of palms) { p.userData.crown.rotation.z = Math.sin(t * 0.7 + p.position.x) * 0.02; p.userData.crown.rotation.x = Math.sin(t * 0.55 + p.position.z) * 0.02; }
      for (const c of chickens) {
        const u = c.userData; u.wait -= dt;
        if (u.wait <= 0) { u.tx = Math.max(-11, Math.min(11, c.position.x + (Math.random() - 0.5) * 3)); u.tz = Math.max(-14, Math.min(14, c.position.z + (Math.random() - 0.5) * 3)); if (Math.abs(u.tx) < 4.6) u.tx = Math.sign(u.tx || 1) * 5.2; u.wait = 1.5 + Math.random() * 3; }
        const dx = u.tx - c.position.x, dz = u.tz - c.position.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { c.position.x += dx / d * 0.5 * dt; c.position.z += dz / d * 0.5 * dt; c.rotation.y = Math.atan2(dx, dz); u.head.position.z = 0.13 + Math.sin(t * 9 + c.position.x) * 0.02; }
      }
      const pa = dust.geometry.attributes.position;
      for (let i = 0; i < dn; i++) { pa.array[i * 3] += Math.sin(t * 0.3 + i) * 0.003; pa.array[i * 3 + 1] += 0.004 + Math.sin(t * 0.5 + i * 1.7) * 0.002; if (pa.array[i * 3 + 1] > 8) pa.array[i * 3 + 1] = 0.2; }
      pa.needsUpdate = true;
      clouds.forEach((c, i) => { c.position.x += dt * 0.4; if (c.position.x > 110) c.position.x = -110; });
    },
  };
  const court = { group: null, impact: (...a) => netApi.impact(...a), update: (dt) => netApi.update(dt), netTop: netApi.netTop };
  return { group: g, anim, sun, hemi, court, fog: { color: 0xe8b98a, near: 40, far: 170 }, ballColor: 0xd8b060, kampung: true };
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
