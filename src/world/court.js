// The playing court: ISTAF-exact markings, floor surface, net (soft, reacts to hits), posts, chair.
import * as THREE from 'three';
import { COURT } from '../game/config.js';
import { canvasTex, drawLogo, noiseTex } from './textures.js';

export const FLOOR_W = 22, FLOOR_L = 32;   // rendered floor (free zone included)

/** Paint the court floor. style: 'official' (pink synthetic) — kampung has its own dirt court. */
export function makeCourtTexture(gender = 'men', o = {}) {
  const PX = 100;                              // pixels per metre
  const W = FLOOR_W * PX, H = FLOOR_L * PX;
  return canvasTex(W, H, (g) => {
    const cx = W / 2, cy = H / 2;
    const m = (v) => v * PX;
    // free zone (deep navy with subtle geometry)
    g.fillStyle = '#16204a'; g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#1c2a63'); grad.addColorStop(1, '#0f1738'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) { const t = i / 26; g.fillStyle = i % 3 === 0 ? '#c8283f' : i % 3 === 1 ? '#2f4fb5' : '#e8b93a'; g.beginPath(); g.moveTo(0, H * t); g.lineTo(m(2.6 + (i % 4) * 0.4), H * t + m(1.4)); g.lineTo(0, H * t + m(2.2)); g.fill(); g.beginPath(); g.moveTo(W, H * (1 - t)); g.lineTo(W - m(2.6 + (i % 4) * 0.4), H * (1 - t) - m(1.4)); g.lineTo(W, H * (1 - t) - m(2.2)); g.fill(); }
    g.restore();
    // playing surface (pink/red synthetic) with a soft border of the free zone
    const surfW = COURT.W + 2 * 1.6, surfL = COURT.L + 2 * 1.6;
    const sg = g.createLinearGradient(0, cy - m(surfL / 2), 0, cy + m(surfL / 2)); sg.addColorStop(0, '#e05a74'); sg.addColorStop(0.5, '#e8607a'); sg.addColorStop(1, '#dc536e');
    g.fillStyle = sg; g.fillRect(cx - m(surfW / 2), cy - m(surfL / 2), m(surfW), m(surfL));
    // floor sheen / scuffs
    g.globalAlpha = 0.07; g.strokeStyle = '#ffffff';
    for (let i = 0; i < 900; i++) { const x = cx - m(surfW / 2) + Math.random() * m(surfW), y = cy - m(surfL / 2) + Math.random() * m(surfL); g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90); g.stroke(); }
    g.globalAlpha = 1;
    // court area slightly lighter
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(cx - m(COURT.W / 2), cy - m(COURT.L / 2), m(COURT.W), m(COURT.L));
    // ---- ISTAF markings (4 cm lines) ----
    g.strokeStyle = '#ffffff'; g.lineWidth = m(COURT.lineW); g.lineCap = 'butt';
    const hw = COURT.halfW, hl = COURT.halfL;
    g.strokeRect(cx - m(hw), cy - m(hl), m(COURT.W), m(COURT.L));           // boundary
    g.beginPath(); g.moveTo(cx - m(hw), cy); g.lineTo(cx + m(hw), cy); g.stroke();      // net line (centre line)
    // quarter circles (r 0.9 m) at the four net corners, drawn inside the court
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const ax = cx + sx * m(hw), az = cy;   // corner on the net line
      g.beginPath();
      // arc from the sideline to the net line on the side sz
      const a0 = sx > 0 ? (sz > 0 ? Math.PI / 2 : Math.PI) : (sz > 0 ? 0 : Math.PI * 1.5);
      const start = sx > 0 ? (sz > 0 ? Math.PI * 0.5 : Math.PI) : (sz > 0 ? 0 : Math.PI * 1.5);
      g.arc(ax, az, m(COURT.quarterR), sx > 0 ? (sz > 0 ? Math.PI / 2 : Math.PI) : (sz > 0 ? 0 : -Math.PI / 2), sx > 0 ? (sz > 0 ? Math.PI : Math.PI * 1.5) : (sz > 0 ? Math.PI / 2 : 0));
      g.stroke();
    }
    // service circles (r 0.30 m), centre 2.45 m from each back line on the centre line
    for (const sz of [-1, 1]) { g.beginPath(); g.arc(cx, cy + sz * m(hl - COURT.serviceFromBack), m(COURT.serviceCircleR), 0, Math.PI * 2); g.stroke(); }
    // end-zone logos
    for (const sz of [-1, 1]) { g.save(); g.translate(cx, cy + sz * m(hl + 2.2)); g.rotate(sz < 0 ? Math.PI : 0); drawLogo(g, 0, 0, m(5.2), { text: '#ffffff' }); g.restore(); }
    // side stripes
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(cx - m(surfW / 2) - m(0.25), cy - m(surfL / 2), m(0.06), m(surfL)); g.fillRect(cx + m(surfW / 2) + m(0.19), cy - m(surfL / 2), m(0.06), m(surfL));
  }, { aniso: 16 });
}

export function buildCourt(opts = {}) {
  const gender = opts.gender || 'men';
  const g = new THREE.Group();
  const tex = makeCourtTexture(gender);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_L), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);

  const netApi = buildNet(gender, 'official');
  g.add(netApi.group);
  return { ...netApi, group: g, floor, net: netApi.net, netTop: netApi.netTop, postH: netApi.postH, __net: netApi };
}

/** Net, posts, tapes and antennas. style: 'official' (steel posts, red pads) | 'kampung' (bamboo poles, fishing net). */
export function buildNet(gender = 'men', style = 'official') {
  const g = new THREE.Group();
  const kam = style === 'kampung';
  const netTop = COURT.netTop[gender], postH = COURT.postH[gender];
  const postX = COURT.halfW + COURT.postOffset;
  // posts + padded bases
  const postMat = new THREE.MeshStandardMaterial({ color: kam ? 0xb7ad54 : 0xd8dde6, roughness: kam ? 0.8 : 0.35, metalness: kam ? 0 : 0.7 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xc41e3a, roughness: 0.8 });
  for (const sx of [-1, 1]) {
    if (kam) {
      // bamboo poles (segmented, leaning a little) with guy ropes to stakes
      const h = postH + 0.25;
      const pole = new THREE.Group();
      for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.048 - k * 0.002, 0.052 - k * 0.002, h / 6 - 0.012, 10), postMat); seg.position.y = (k + 0.5) * h / 6; seg.castShadow = true; pole.add(seg); const node = new THREE.Mesh(new THREE.CylinderGeometry(0.056 - k * 0.002, 0.056 - k * 0.002, 0.024, 10), new THREE.MeshStandardMaterial({ color: 0x8a7f3a, roughness: 0.9 })); node.position.y = (k + 1) * h / 6 - 0.006; pole.add(node); }
      pole.position.set(sx * (postX + 0.04), 0, 0); pole.rotation.z = -sx * 0.03; g.add(pole);
      const ropeMat = new THREE.LineBasicMaterial({ color: 0xcaa86a });
      for (const dz of [-1, 1]) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * postX, postH * 0.95, 0), new THREE.Vector3(sx * (postX + 1.3), 0.02, dz * 1.4)]); g.add(new THREE.Line(geo, ropeMat)); const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), postMat); stake.position.set(sx * (postX + 1.3), 0.1, dz * 1.4); stake.rotation.z = sx * 0.4; g.add(stake); }
      continue;
    }
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, postH, 16), postMat); p.position.set(sx * postX, postH / 2, 0); p.castShadow = true; g.add(p);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), padMat); pad.position.set(sx * (postX + 0.05), 0.45, 0); pad.castShadow = true; pad.receiveShadow = true; g.add(pad);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), new THREE.MeshStandardMaterial({ color: 0x141a33, roughness: 0.6 })); base.position.set(sx * (postX + 0.05), 0.025, 0); g.add(base);
  }
  // net mesh (grid of cells 7 cm) as a displaceable plane
  const NX = 64, NY = 12;
  const netW = postX * 2 - 0.1, netH = COURT.netWidth;
  const netGeo = new THREE.PlaneGeometry(netW, netH, NX, NY);
  const netTex = canvasTex(512, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = kam ? 'rgba(200,190,150,0.92)' : 'rgba(245,245,245,0.92)'; c.lineWidth = kam ? 4 : 3;
    for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }, { repeat: [netW / 0.5, 1], aniso: 8 });
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(0, netTop - netH / 2 - 0.02, 0); net.castShadow = false; g.add(net);
  // top and bottom tapes, boundary tapes above the sidelines
  const tapeMat = new THREE.MeshStandardMaterial({ color: kam ? 0xd9cfa4 : 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
  const top = new THREE.Mesh(new THREE.BoxGeometry(netW + 0.1, 0.05, 0.012), tapeMat); top.position.set(0, netTop - 0.025, 0); g.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(netW + 0.1, 0.03, 0.01), tapeMat); bot.position.set(0, netTop - netH + 0.0, 0); g.add(bot);
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, netH, 0.012), tapeMat); t.position.set(sx * COURT.halfW, netTop - netH / 2 - 0.02, 0); g.add(t); }
  // boundary antennas (ball must cross between them)
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 })); a.position.set(sx * COURT.halfW, netTop + 0.35, 0); g.add(a); }

  // net physics: simple damped spring displacement of the mesh near an impact
  const pos = netGeo.attributes.position;
  const rest = Float32Array.from(pos.array);
  const disp = new Float32Array(pos.count), vel = new Float32Array(pos.count);
  const api = {
    group: g, net, netTop, postH,
    impact(x, y, z, speed) {
      const lx = x, ly = y - (net.position.y);
      const push = Math.min(0.5, 0.06 + speed * 0.022) * -Math.sign(z || 1);
      for (let i = 0; i < pos.count; i++) {
        const dx = rest[i * 3] - lx, dy = rest[i * 3 + 1] - ly;
        const d2 = dx * dx + dy * dy, fall = Math.exp(-d2 / 0.28);
        vel[i] += push * fall * 14;
      }
    },
    update(dt) {
      const k = 120, dmp = 5.5;
      for (let i = 0; i < pos.count; i++) {
        const a = -k * disp[i] - dmp * vel[i];
        vel[i] += a * dt; disp[i] += vel[i] * dt;
        pos.array[i * 3 + 2] = disp[i];
      }
      pos.needsUpdate = true;
    },
  };
  return api;
}

/** Umpire's chair (high referee stand). Seat height ~1.6 m. */
export function buildUmpireChair() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.4, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.6 });
  const seatY = 1.32;
  for (const [x, z] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, seatY, 8), metal); leg.position.set(x, seatY / 2, z); leg.castShadow = true; g.add(leg); }
  for (let i = 1; i < 5; i++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.02, 0.02), metal); rung.position.set(0, seatY * i / 5, 0.32); g.add(rung); }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), dark); platform.position.set(0, seatY, 0); platform.castShadow = true; g.add(platform);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.46), new THREE.MeshStandardMaterial({ color: 0x2a3a78, roughness: 0.7 })); seat.position.set(0, seatY + 0.07, -0.04); g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a3a78, roughness: 0.7 })); back.position.set(0, seatY + 0.3, -0.27); g.add(back);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.22), metal); foot.position.set(0, seatY - 0.32, 0.36); g.add(foot);
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.34), dark); table.position.set(0, seatY + 0.42, 0.38); table.rotation.x = -0.25; g.add(table);
  g.userData = { seatY };
  return g;
}
