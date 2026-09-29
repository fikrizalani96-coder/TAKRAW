// Head, face, ears, neck-top and hair volumes (SDF, head-bone local space).
import * as THREE from 'three';
import { Prims, SDFScene } from './sdf.js';

/** Face parameter presets; each value is a multiplier around 1. */
export function randomFace(rng) {
  const g = () => 1 + rng.gauss() * 0.06;
  return {
    faceW: g(), jawW: g(), chin: g(), noseL: g(), noseW: g(), noseB: g(), brow: g(), cheek: g(), lip: g(), ear: g(), foreheadH: g(), headL: g(),
  };
}

export function buildHeadScene(rig, bind, face = {}) {
  const f = { faceW: 1, jawW: 1, chin: 1, noseL: 1, noseW: 1, noseB: 1, brow: 1, cheek: 1, lip: 1, ear: 1, foreheadH: 1, headL: 1, ...face };
  const K = rig.dims.scale;
  const H = bind.frames.head;
  const sc = new SDFScene();
  const ell = (c, r, o) => sc.add(Prims.ellipsoid(H, [c[0] * K, c[1] * K, c[2] * K], [r[0] * K, r[1] * K, r[2] * K], o));
  const cone = (a, b, r1, r2, o) => sc.add(Prims.cone(H, [a[0] * K, a[1] * K, a[2] * K], [b[0] * K, b[1] * K, b[2] * K], r1 * K, r2 * K, o));
  const HS = ['head', 'neck_02', 'neck_01'];
  const JS = ['jaw', 'head'];

  // cranium and face mass
  ell([0, 0.080, -0.006], [0.076 * f.faceW, 0.088 * f.foreheadH, 0.098 * f.headL], { k: 0.03, skin: HS, tag: 'skin' });
  ell([0, 0.052, 0.030], [0.070 * f.faceW, 0.082, 0.070], { k: 0.03, skin: HS, tag: 'skin' });
  // mandible & chin (jaw bone)
  ell([0, 0.006, 0.040], [0.062 * f.jawW, 0.056, 0.064], { k: 0.03, skin: JS, tag: 'skin' });
  ell([0, -0.020, 0.074], [0.032 * f.chin * f.jawW, 0.030 * f.chin, 0.032 * f.chin], { k: 0.03, skin: JS, tag: 'skin' });
  for (const s of [-1, 1]) {
    ell([s * 0.050 * f.jawW, -0.004, 0.030], [0.022, 0.034, 0.045], { k: 0.03, skin: JS, tag: 'skin' });           // jaw angle
    ell([s * 0.050 * f.faceW, 0.040, 0.060], [0.024 * f.cheek, 0.021, 0.022 * f.cheek], { k: 0.02, skin: HS, tag: 'cheek' }); // cheekbone
    ell([s * 0.078 * f.faceW, 0.048, -0.004], [0.0105 * f.ear, 0.034 * f.ear, 0.024 * f.ear], { k: 0.012, skin: HS, tag: 'ear' }); // ear
    ell([s * 0.030, 0.066, 0.086], [0.030, 0.011, 0.014], { k: 0.012, skin: HS, tag: 'brow' });                      // brow ridge
    ell([s * 0.014, 0.024, 0.100], [0.0085 * f.noseW, 0.0085, 0.0095], { k: 0.008, skin: HS, tag: 'nose' });        // nostril wing
    // eye sockets (carved)
    sc.add(Prims.ellipsoid(H, [s * 0.032 * K, 0.070 * K, 0.086 * K], [0.0175 * K, 0.0155 * K, 0.0155 * K], { op: 'sub', k: 0.010, skin: HS }));
  }
  ell([0, 0.078, 0.086], [0.040, 0.013, 0.020], { k: 0.02, skin: HS, tag: 'brow' });
  // nose
  cone([0, 0.066, 0.086], [0, 0.030 * f.noseL, 0.108 + 0.004 * (f.noseL - 1)], 0.0085 * f.noseW * f.noseB, 0.0105 * f.noseW, { k: 0.012, skin: HS, tag: 'nose' });
  ell([0, 0.027 * f.noseL, 0.113 + 0.005 * (f.noseL - 1)], [0.0115 * f.noseW, 0.0105, 0.0115], { k: 0.010, skin: HS, tag: 'nose' });
  // mouth
  ell([0, -0.004, 0.091], [0.023 * f.lip, 0.0075 * f.lip, 0.0120], { k: 0.008, skin: HS, tag: 'lip' });
  ell([0, -0.021, 0.088], [0.021 * f.lip, 0.0085 * f.lip, 0.0120], { k: 0.008, skin: ['jaw', 'head'], tag: 'lip' });
  // philtrum/chin cleft area softening & throat
  ell([0, -0.080, 0.036], [0.011, 0.016, 0.013], { k: 0.02, skin: HS, tag: 'skin' });
  // neck (overlaps the body's neck; slightly larger to avoid coincident surfaces)
  cone([0, -0.135, -0.014], [0, -0.010, -0.004], 0.0605, 0.0565, { k: 0.03, skin: HS, tag: 'skin' });
  return sc;
}

/** Hair styles as inflated cranium shells clipped by a hairline. Returns {scene, clip}. */
export function buildHairScene(rig, bind, style = 'short') {
  const K = rig.dims.scale;
  const H = bind.frames.head;
  const sc = new SDFScene();
  const E = (c, r, o = {}) => sc.add(Prims.ellipsoid(H, [c[0] * K, c[1] * K, c[2] * K], [r[0] * K, r[1] * K, r[2] * K], { k: 0.02, skin: ['head', 'neck_02'], tag: 'hair', ...o }));
  const inv = H.inv.elements;
  // world -> head-local (in K-units) for the hairline clip
  const toLocal = (x, y, z) => [
    (inv[0] * x + inv[4] * y + inv[8] * z + inv[12]) / K,
    (inv[1] * x + inv[5] * y + inv[9] * z + inv[13]) / K,
    (inv[2] * x + inv[6] * y + inv[10] * z + inv[14]) / K,
  ];
  // Hairline: positive where there is NO hair (below the line). Higher at the forehead centre,
  // lower over the ears and nape.
  const hairline = (lx, ly, lz) => {
    const yFront = 0.136 - 0.52 * Math.abs(lx);
    const ySide = Math.max(0.012, 0.078 - (0.03 - lz) * 0.55);
    const t = Math.min(1, Math.max(0, lz / 0.05)); const ts = t * t * (3 - 2 * t);
    return (ySide * (1 - ts) + yFront * ts) - ly;
  };
  let clip = null;
  if (style === 'buzz') {
    E([0, 0.083, -0.006], [0.0805, 0.0925, 0.1025]);
    clip = (x, y, z) => { const l = toLocal(x, y, z); return hairline(l[0], l[1], l[2]); };
  } else if (style === 'short') {
    E([0, 0.084, -0.006], [0.0865, 0.100, 0.109]);
    E([0, 0.135, 0.005], [0.066, 0.030, 0.085], { k: 0.035 });
    clip = (x, y, z) => { const l = toLocal(x, y, z); return hairline(l[0], l[1], l[2]); };
  } else if (style === 'undercut') {
    E([0, 0.083, -0.006], [0.0805, 0.0925, 0.1025]);
    E([0, 0.148, 0.010], [0.060, 0.038, 0.085], { k: 0.03 });
    clip = (x, y, z) => { const l = toLocal(x, y, z); return hairline(l[0], l[1], l[2]); };
  } else if (style === 'swept') {
    E([0, 0.084, -0.006], [0.087, 0.100, 0.110]);
    E([0.006, 0.140, 0.020], [0.068, 0.036, 0.095], { k: 0.04 });
    E([0.0, 0.118, 0.085], [0.052, 0.020, 0.030], { k: 0.03 });
    clip = (x, y, z) => { const l = toLocal(x, y, z); return hairline(l[0], l[1], l[2]); };
  } else if (style === 'songkok') {
    // Malay songkok / peci: black velvet cap
    E([0, 0.135, 0.0], [0.084, 0.058, 0.098], { k: 0.01, tag: 'cap' });
    clip = (x, y, z) => { const l = toLocal(x, y, z); return 0.098 - l[1]; };
  } else if (style === 'headband') {
    E([0, 0.084, -0.006], [0.0805, 0.0925, 0.1025]);
    clip = (x, y, z) => { const l = toLocal(x, y, z); return hairline(l[0], l[1], l[2]); };
  } else return null;
  return { scene: sc, clip };
}

/** Eyeball + lid geometry helpers (rigid meshes attached to eye bones). */
export function makeEyeTexture(irisHex = 0x4a2f1c) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2ede6'; g.fillRect(0, 0, 256, 128);
  // veins hint
  g.strokeStyle = 'rgba(190,90,80,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(40 + Math.random() * 50, 64 + (Math.random() - 0.5) * 50); g.lineTo(64 + Math.random() * 30, 64 + (Math.random() - 0.5) * 30); g.stroke(); }
  const cx = 64, cy = 64; // u = 0.25 faces +Z on THREE.SphereGeometry
  const col = '#' + irisHex.toString(16).padStart(6, '0');
  const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 24);
  grad.addColorStop(0, '#1a0f08'); grad.addColorStop(0.32, col); grad.addColorStop(0.9, '#120a05'); grad.addColorStop(1, '#0a0503');
  g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#050302'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(cx - 8, cy - 9, 3.2, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
