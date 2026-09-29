// Assembles complete skinned humans: body kits (heavy SDF meshing, cached) + per-player skeleton,
// materials, face, hair, kit colours, numbers, eyes/eyelids.
import * as THREE from 'three';
import { buildRig, makeDims } from './skeleton.js';
import { RigPoser, REST_POSE } from '../anim/pose.js';
import { computeBind, buildBodyScene } from './anatomy.js';
import { buildSkinnedGeometry, recolor, hideCovered } from './geo.js';
import { buildHeadScene, buildHairScene, makeEyeTexture } from './head.js';
import { buildHandScene, buildFootScene } from './hands.js';
import { jerseyScene, shortsScene, socksScene, bandScene, shoeScene, extractDecal } from './clothes.js';
import { bandColorFn, decalAtlas, SKIN_TONES, HAIR_COLORS } from './kits.js';
import { kitMaterial } from './kitMaterial.js';

export const QUALITY = {
  high: { body: 0.0092, head: 0.0046, hand: 0.0040, foot: 0.0050, cloth: 0.0095 },
  medium: { body: 0.0112, head: 0.0056, hand: 0.0048, foot: 0.0060, cloth: 0.0115 },
  low: { body: 0.0185, head: 0.0086, hand: 0.0072, foot: 0.0092, cloth: 0.0185 },
};

export const BUILDS = {
  tekong: { height: 1.76, chest: 1.04, waist: 1.02, thigh: 1.08, arm: 1.02, muscle: 1.06, leg: 0.99, torso: 1.01 },
  tosser: { height: 1.71, chest: 0.98, waist: 0.96, thigh: 1.0, arm: 1.0, muscle: 0.94, leg: 1.0, torso: 0.99 },
  killer: { height: 1.79, chest: 1.06, waist: 0.98, thigh: 1.06, arm: 1.04, muscle: 1.12, leg: 1.02, torso: 1.0 },
  official: { height: 1.74, chest: 1.04, waist: 1.14, thigh: 1.0, arm: 1.0, muscle: 0.8, leg: 0.98, torso: 1.02 },
  elder: { height: 1.68, chest: 0.98, waist: 1.12, thigh: 0.92, arm: 0.94, muscle: 0.6, leg: 0.96, torso: 1.02 },
  youth: { height: 1.55, chest: 0.9, waist: 0.9, thigh: 0.9, arm: 0.92, muscle: 0.7, leg: 0.98, torso: 0.98 },
};

const kitCache = new Map();
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Skin tint. Head features are painted by head-local position so they stay narrow and crisp. */
const HEAD_ORIGIN = [0, 1.595, 0.01];
function skinTint(tag, x, y, z, nx, ny, nz, K = 1) {
  const lx = x - HEAD_ORIGIN[0], ly = (y - HEAD_ORIGIN[1] * K) / K, lz = z - HEAD_ORIGIN[2];
  switch (tag) {
    case 'brow': return [0.86, 0.80, 0.78];
    case 'ear': return [1.03, 0.87, 0.83];
    case 'nose': return [1.02, 0.93, 0.91];
    case 'cheek': return [1.02, 0.94, 0.92];
    default: return [1, 1, 1];
  }
}

/**
 * Build (or fetch) the shared base geometry (body + hands) for a body build. Garments are built lazily per
 * outfit with `ensureOutfit`, so a match only pays for what it actually renders.
 */
export async function getBodyKit(buildName = 'tekong', quality = 'high', onProgress = null) {
  const key = `${buildName}|${quality}`;
  if (kitCache.has(key)) return kitCache.get(key);
  const p = (async () => {
    const q = QUALITY[quality];
    const B = BUILDS[buildName];
    const dims = makeDims({ height: B.height, torso: B.torso, leg: B.leg, arm: B.arm });
    const rig = buildRig(dims);
    const bind = computeBind(rig);
    const step = async (label, fn) => { const r = fn(); if (onProgress) onProgress(label); await tick(); return r; };
    const body = buildBodyScene(rig, bind, B);
    const yCut = new THREE.Vector3().setFromMatrixPosition(rig.bones.foot_l.matrixWorld).y - 0.003;
    const geo = {};
    geo.body = await step('body', () => buildSkinnedGeometry(body, body.bounds(), q.body, bind, rig, { clip: (x, y) => yCut - y }));
    geo.handL = await step('hand', () => { const s = buildHandScene(rig, bind, '_l', body); return buildSkinnedGeometry(s, s.bounds(), q.hand, bind, rig, { kw: 0.006, wide: 0.05 }); });
    geo.handR = await step('hand', () => { const s = buildHandScene(rig, bind, '_r', body); return buildSkinnedGeometry(s, s.bounds(), q.hand, bind, rig, { kw: 0.006, wide: 0.05 }); });
    return { key, dims, buildName, B, geo, garments: {}, decals: {}, quality, _ctx: { rig, bind, body, q, step }, _done: new Set() };
  })();
  kitCache.set(key, p);
  return p;
}

/** Build the garment meshes an outfit needs: 'sport' | 'suit' | 'kampung' (kampung also builds bare feet). */
export async function ensureOutfit(kit, outfit = 'sport', barefoot = false) {
  const { rig, bind, body, q, step } = kit._ctx;
  const K = kit.dims.scale, dims = kit.dims, G = kit.garments;
  const mk = async (name, scene, extra = {}) => { if (G[name]) return; G[name] = { cs: scene, top: scene.top }; G[name].geo = await step(name, () => buildSkinnedGeometry(scene, scene.bounds(), q.cloth, bind, rig, { kw: 0.016, ...extra })); };
  const pelY = rig.bones.pelvis.matrixWorld.elements[13];
  const shoes = async () => {
    if (G.shoeL) return;
    const sL = shoeScene(rig, bind, '_l'), sR = shoeScene(rig, bind, '_r');
    G.shoeL = { geo: await step('shoe', () => buildSkinnedGeometry(sL, sL.bounds(), q.foot, bind, rig, { kw: 0.01, wide: 0.05 })) };
    G.shoeR = { geo: await step('shoe', () => buildSkinnedGeometry(sR, sR.bounds(), q.foot, bind, rig, { kw: 0.01, wide: 0.05 })) };
  };
  if (barefoot || outfit === 'kampung') {
    if (!kit.geo.footL) {
      kit.geo.footL = await step('foot', () => { const s = buildFootScene(rig, bind, '_l'); return buildSkinnedGeometry(s, s.bounds(), q.foot, bind, rig, { kw: 0.008, wide: 0.05 }); });
      kit.geo.footR = await step('foot', () => { const s = buildFootScene(rig, bind, '_r'); return buildSkinnedGeometry(s, s.bounds(), q.foot, bind, rig, { kw: 0.008, wide: 0.05 }); });
    }
  }
  if (outfit === 'sport') {
    await mk('jersey', jerseyScene(rig, bind, body));
    await mk('shorts', shortsScene(rig, bind, body));
    const socks = socksScene(rig, bind, body); socks.top = 0.28 * K * dims.leg; await mk('socks', socks, { kw: 0.01 });
    await mk('knee', bandScene(rig, bind, body, 'knee'), { kw: 0.01 });
    await mk('wrist', bandScene(rig, bind, body, 'wrist'), { kw: 0.008 });
    if (!barefoot) await shoes();
    G.socks.top = 0.28 * K * dims.leg;
    if (!kit.decals.back && !kit.decals._built) {
      kit.decals._built = true;
      const yb = (y) => y * K;
      kit.decals.back = extractDecal(G.jersey.geo, { min: { x: -0.16 * K, y: yb(1.10), z: -1 }, max: { x: 0.16 * K, y: yb(1.43), z: 0.0 } }, (nx, ny, nz) => nz < -0.3,
        (x, y) => [0.5 * (0.5 - x / (0.32 * K)), (y - yb(1.10)) / (yb(1.43) - yb(1.10))]);
      kit.decals.front = extractDecal(G.jersey.geo, { min: { x: -0.07 * K, y: yb(1.22), z: 0 }, max: { x: 0.07 * K, y: yb(1.36), z: 1 } }, (nx, ny, nz) => nz > 0.3,
        (x, y) => [0.5 + 0.25 * (0.5 + x / (0.14 * K)), 1 - (100 + (1 - (y - yb(1.22)) / (yb(1.36) - yb(1.22))) * 200) / 512]);
      kit.decals.shorts = extractDecal(G.shorts.geo, { min: { x: 0.04 * K, y: yb(0.70), z: 0 }, max: { x: 0.17 * K, y: yb(0.86), z: 1 } }, (nx, ny, nz) => nz > 0.25,
        (x, y) => [0.75 + 0.25 * ((x - 0.04 * K) / (0.13 * K)), 1 - (28 + (1 - (y - yb(0.70)) / (yb(0.86) - yb(0.70))) * 200) / 512]);
    }
  } else if (outfit === 'suit') {
    await mk('jacket', jerseyScene(rig, bind, body, { sleeve: 1.6, loose: 1.9, waistLoose: 0.018, hem: pelY - 0.15 * K }));
    await mk('trousers', shortsScene(rig, bind, body, { hem: 0.10 * K, baggy: 0.55 }));
    if (!barefoot) await shoes();
  } else {
    await mk('tee', jerseyScene(rig, bind, body, { sleeve: 0.5, loose: 1.5, waistLoose: 0.020, hem: pelY - 0.075 * K }));
    await mk('kshorts', shortsScene(rig, bind, body, { hem: 0.44 * K * dims.leg, baggy: 1.2 }));
  }
  return kit;
}

const bodyVariantCache = new Map();
function bodyGeoFor(kit, outfit) {
  const key = kit.key + '|' + outfit;
  if (bodyVariantCache.has(key)) return bodyVariantCache.get(key);
  const G = kit.garments;
  const cloths = outfit === 'sport' ? [G.jersey.cs, G.shorts.cs] : outfit === 'suit' ? [G.jacket.cs, G.trousers.cs] : [G.tee.cs, G.kshorts.cs];
  const g = hideCovered(kit.geo.body, cloths);
  bodyVariantCache.set(key, g);
  return g;
}

const headCache = new Map();
export async function getHeadGeo(bodyKit, faceKey, face) {
  const key = `${bodyKit.key}|${faceKey}`;
  if (headCache.has(key)) return headCache.get(key);
  const rig = buildRig(bodyKit.dims);
  const bind = computeBind(rig);
  const q = QUALITY[bodyKit.quality];
  const sc = buildHeadScene(rig, bind, face);
  const geo = buildSkinnedGeometry(sc, sc.bounds(), q.head, bind, rig, { kw: 0.007, wide: 0.05, tint: (t, x, y, z, nx, ny, nz) => skinTint(t, x, y, z, nx, ny, nz, bodyKit.dims.scale), aoRadius: 0.02, aoStrength: 0.8 });
  addFaceUVs(geo, bodyKit.dims.scale);
  headCache.set(key, geo);
  return geo;
}
/** Planar front projection UVs (head-local x,y). Vertices behind the face plane are pushed off the top edge. */
const FACE_S = 0.24, FACE_CY = 0.03;
function addFaceUVs(geo, K) {
  const pos = geo.getAttribute('position'), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i) - HEAD_ORIGIN[0], ly = (pos.getY(i) - HEAD_ORIGIN[1] * K) / K, lz = pos.getZ(i) - HEAD_ORIGIN[2];
    uv[i * 2] = 0.5 + lx / FACE_S; uv[i * 2 + 1] = 0.5 + (ly - FACE_CY) / FACE_S + (lz < 0.0 ? 4 : 0);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const faceTexCache = new Map();
/** Painted face detail (brows, lips, lid creases, nostrils, nasolabial folds, stubble); white = neutral so it multiplies the skin tone. */
function faceTexture(hairHex, beard = 0.5) {
  const key = hairHex + '|' + beard;
  if (faceTexCache.has(key)) return faceTexCache.get(key);
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  const X = (lx) => (0.5 + lx / FACE_S) * N, Y = (ly) => (0.5 - (ly - FACE_CY) / FACE_S) * N, L = (m) => m / FACE_S * N;
  g.globalCompositeOperation = 'multiply';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const hc = new THREE.Color(hairHex), hr = Math.round(40 + hc.r * 150), hg = Math.round(32 + hc.g * 130), hb = Math.round(28 + hc.b * 120);
  const blob = (x, y, rx, ry, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, 1); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.save(); g.translate(x, y); g.scale(rx, ry); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 1, 0, 6.3); g.fill(); g.restore(); };
  for (const s of [-1, 1]) {
    // cheek warmth + eye-socket shadow + under-eye
    blob(X(s * 0.046), Y(0.034), L(0.024), L(0.02), ['rgba(238,160,150,0.55)', 'rgba(255,255,255,0)']);
    blob(X(s * 0.032), Y(0.071), L(0.024), L(0.017), ['rgba(190,140,125,0.55)', 'rgba(255,255,255,0)']);
    blob(X(s * 0.032), Y(0.056), L(0.02), L(0.008), ['rgba(200,150,140,0.35)', 'rgba(255,255,255,0)']);
    // upper lid crease
    g.strokeStyle = 'rgba(120,70,60,0.55)'; g.lineWidth = L(0.0012);
    g.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12, lx = s * (0.014 + t * 0.036), ly = 0.0865 + 0.005 * Math.sin(t * Math.PI) - 0.0025 * t; i ? g.lineTo(X(lx), Y(ly)) : g.moveTo(X(lx), Y(ly)); } g.stroke();
    // eyebrows: many fine hairs, thick in the middle
    for (let k = 0; k < 46; k++) {
      const t0 = Math.random() * 0.95, ax = 0.011 + t0 * 0.043;
      const yb = 0.0965 + (ax - 0.010) * 0.10 - (ax > 0.040 ? (ax - 0.040) * 1.8 : 0) + (Math.random() - 0.5) * 0.0055 * (1 - t0 * 0.4);
      g.strokeStyle = `rgba(${hr},${hg},${hb},${0.35 + Math.random() * 0.4})`; g.lineWidth = L(0.0011);
      g.beginPath(); g.moveTo(X(s * ax), Y(yb)); g.lineTo(X(s * (ax + 0.0035)), Y(yb + 0.0022 - t0 * 0.0016)); g.stroke();
    }
    // nostrils, nasolabial folds, mouth corners
    blob(X(s * 0.0115), Y(0.0245), L(0.0034), L(0.0022), ['rgba(60,28,22,0.9)', 'rgba(255,255,255,0)']);
    g.strokeStyle = 'rgba(150,100,90,0.15)'; g.lineWidth = L(0.0018);
    g.beginPath(); g.moveTo(X(s * 0.021), Y(0.024)); g.quadraticCurveTo(X(s * 0.030), Y(0.010), X(s * 0.030), Y(-0.002)); g.stroke();
    blob(X(s * 0.0225), Y(-0.0125), L(0.0028), L(0.0022), ['rgba(110,50,46,0.7)', 'rgba(255,255,255,0)']);
  }
  // lips (upper thinner, lower fuller) with a dark seam
  const lipC = -0.0125;
  g.fillStyle = 'rgba(214,142,130,0.92)';
  g.beginPath(); g.moveTo(X(-0.0225), Y(lipC)); g.quadraticCurveTo(X(-0.012), Y(lipC + 0.0085), X(-0.003), Y(lipC + 0.0078)); g.quadraticCurveTo(X(0), Y(lipC + 0.0062), X(0.003), Y(lipC + 0.0078)); g.quadraticCurveTo(X(0.012), Y(lipC + 0.0085), X(0.0225), Y(lipC)); g.quadraticCurveTo(X(0), Y(lipC + 0.0005), X(-0.0225), Y(lipC)); g.fill();
  g.fillStyle = 'rgba(218,148,136,0.92)';
  g.beginPath(); g.moveTo(X(-0.0225), Y(lipC)); g.quadraticCurveTo(X(-0.012), Y(lipC - 0.0125), X(0), Y(lipC - 0.0128)); g.quadraticCurveTo(X(0.012), Y(lipC - 0.0125), X(0.0225), Y(lipC)); g.quadraticCurveTo(X(0), Y(lipC - 0.0012), X(-0.0225), Y(lipC)); g.fill();
  g.strokeStyle = 'rgba(85,35,32,0.9)'; g.lineWidth = L(0.0013);
  g.beginPath(); g.moveTo(X(-0.0235), Y(lipC + 0.0004)); g.quadraticCurveTo(X(-0.010), Y(lipC - 0.0014), X(0), Y(lipC - 0.0004)); g.quadraticCurveTo(X(0.010), Y(lipC - 0.0014), X(0.0235), Y(lipC + 0.0004)); g.stroke();
  blob(X(0), Y(lipC - 0.0175), L(0.014), L(0.005), ['rgba(190,140,130,0.4)', 'rgba(255,255,255,0)']);   // under-lip shadow
  // light stubble on chin, jaw and upper lip
  if (beard > 0) {
    g.fillStyle = `rgba(70,70,80,${0.06 * beard})`;
    for (let k = 0; k < 2600; k++) {
      const lx = (Math.random() - 0.5) * 0.11, ly = -0.06 + Math.random() * 0.056;
      const jaw = Math.abs(lx) < 0.032 + (ly + 0.06) * 0.7; if (!jaw) continue;
      g.fillRect(X(lx), Y(ly), 1.4, 1.4);
    }
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  faceTexCache.set(key, t);
  return t;
}

const hairCache = new Map();
export function getHairGeo(bodyKit, style, faceKey, face) {
  if (!style || style === 'bald') return null;
  const key = `${bodyKit.key}|${style}|${faceKey}`;
  if (hairCache.has(key)) return hairCache.get(key);
  const rig = buildRig(bodyKit.dims);
  const bind = computeBind(rig);
  const q = QUALITY[bodyKit.quality];
  const h = buildHairScene(rig, bind, style);
  if (!h) return null;
  const geo = buildSkinnedGeometry(h.scene, h.scene.bounds(), q.head, bind, rig, { clip: h.clip, kw: 0.01, wide: 0.05, aoRadius: 0.02, tint: (tag, x, y, z) => { const n = 0.85 + 0.15 * Math.sin(x * 420 + z * 310) * Math.sin(y * 380 + x * 200); return tag === 'cap' ? [0.9, 0.9, 0.9] : [n, n, n]; } });
  hairCache.set(key, geo);
  return geo;
}

const stdMat = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

/**
 * spec: { skin, hairStyle, hairColor, face, faceKey, kit, number, name, outfit: 'sport'|'suit'|'kampung',
 *         barefoot, accessories: {knee,wrist}, colors }
 */
export function createHuman(bodyKit, headGeo, spec) {
  const rig = buildRig(bodyKit.dims);
  const poser = new RigPoser(rig);
  poser.apply(REST_POSE);
  const group = new THREE.Group();
  group.add(rig.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(rig.list);
  const skinTone = SKIN_TONES[spec.skin ?? 1];
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, vertexColors: true, roughness: 0.58, metalness: 0 });
  skinMat.onBeforeCompile = (sh) => { // cheap subsurface-ish warm rim for skin
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `
      float rim = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
      gl_FragColor.rgb += vec3(0.16, 0.05, 0.03) * rim * 0.55;
      #include <dithering_fragment>`);
  };
  const meshes = [];
  const add = (geo, mat, name, opts = {}) => {
    if (!geo) return null;
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name; m.frustumCulled = false; m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
    group.add(m); meshes.push(m);
    return m;
  };
  const kit = spec.kit;
  const outfit = spec.outfit || 'sport';
  const G = bodyKit.garments;
  const K = bodyKit.dims.scale;
  const parts = {};
  parts.body = add(bodyGeoFor(bodyKit, spec.outfit || 'sport'), skinMat, 'body');
  const headMat = skinMat.clone(); headMat.onBeforeCompile = skinMat.onBeforeCompile;
  headMat.customProgramCacheKey = () => 'skin-head';
  headMat.map = faceTexture(HAIR_COLORS[spec.hairColor ?? 0], spec.beard ?? 0.55); headMat.needsUpdate = true;
  parts.head = add(headGeo, headMat, 'head');
  parts.handL = add(bodyKit.geo.handL, skinMat, 'handL');
  parts.handR = add(bodyKit.geo.handR, skinMat, 'handR');
  const barefoot = spec.barefoot || outfit === 'kampung';
  if (barefoot) { parts.footL = add(bodyKit.geo.footL, skinMat, 'footL'); parts.footR = add(bodyKit.geo.footR, skinMat, 'footR'); }

  const clothMat = (rough = 0.86) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0, side: THREE.FrontSide });
  let atlasTex = null;
  const mats = { skin: skinMat };
  if (outfit === 'sport') {
    const fr = computeBindFrames(rig);
    const ctx = { kit, K, armInvL: fr.frames.upperarm_l.inv, armInvR: fr.frames.upperarm_r.inv };
    mats.jersey = kitMaterial('jersey', { ...ctx, cs: G.jersey.cs }, 0.86); parts.jersey = add(G.jersey.geo, mats.jersey, 'jersey');
    mats.shorts = kitMaterial('shorts', { ...ctx, cs: G.shorts.cs }, 0.8); parts.shorts = add(G.shorts.geo, mats.shorts, 'shorts');
    if (!barefoot) {
      mats.socks = kitMaterial('socks', { ...ctx, top: G.socks.top }, 0.9); parts.socks = add(G.socks.geo, mats.socks, 'socks');
      mats.shoe = kitMaterial('shoe', ctx, 0.5);
      parts.shoeL = add(G.shoeL.geo, mats.shoe, 'shoeL'); parts.shoeR = add(G.shoeR.geo, mats.shoe, 'shoeR');
    }
    if (spec.accessories?.knee) parts.knee = add(recolor(G.knee.geo, bandColorFn(0x141418)), clothMat(0.7), 'knee');
    if (spec.accessories?.wrist) parts.wrist = add(recolor(G.wrist.geo, bandColorFn(0xf2f2f2)), clothMat(0.9), 'wrist');
    atlasTex = decalAtlas(kit, spec.number ?? 0, spec.name || '');
    mats.decal = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.decal.color.setScalar(0.92);
    for (const k of ['back', 'front']) if (bodyKit.decals[k]) add(bodyKit.decals[k], mats.decal, 'decal_' + k, { cast: false, receive: false });
    if (bodyKit.decals.shorts) add(bodyKit.decals.shorts, mats.decal, 'decal_shorts', { cast: false, receive: false });
  } else if (outfit === 'suit') {
    const navy = spec.suitColor ?? 0x1b2745, trs = spec.trouserColor ?? 0x24262c;
    const c = (h) => { const cc = new THREE.Color(h); return [cc.r, cc.g, cc.b]; };
    const jc = c(navy), sh = c(0xf2f2f2);
    mats.jersey = clothMat(0.75);
    parts.jersey = add(recolor(G.jacket.geo, (x, y, z, nx, ny, nz) => (y > 1.22 * K && y < 1.5 * K && z > 0 && Math.abs(x) < 0.05 * K && nz > 0.4 ? sh : jc)), mats.jersey, 'jacket');
    mats.shorts = clothMat(0.8);
    parts.shorts = add(recolor(G.trousers.geo, () => c(trs)), mats.shorts, 'trousers');
    mats.shoe = clothMat(0.45);
    const dark = c(0x0d0d10);
    if (!barefoot) { parts.shoeL = add(recolor(G.shoeL.geo, () => dark), mats.shoe, 'shoeL'); parts.shoeR = add(recolor(G.shoeR.geo, () => dark), mats.shoe, 'shoeR'); }
  } else { // kampung casual wear
    const c = (h) => { const cc = new THREE.Color(h); return [cc.r, cc.g, cc.b]; };
    const tee = c(spec.teeColor ?? 0x4a7a5a), sh = c(spec.shortsColor ?? 0x2b3f6a);
    mats.jersey = clothMat(0.92);
    parts.jersey = add(recolor(G.tee.geo, (x, y, z) => { const v = 0.94 + 0.06 * Math.sin(y * 90 + x * 7); return [tee[0] * v, tee[1] * v, tee[2] * v]; }), mats.jersey, 'tee');
    mats.shorts = clothMat(0.9);
    parts.shorts = add(recolor(G.kshorts.geo, () => sh), mats.shorts, 'shorts');
  }
  // hair
  const hg = getHairGeo(bodyKit, spec.hairStyle, spec.faceKey, spec.face);
  if (hg) {
    const isCap = spec.hairStyle === 'songkok';
    mats.hair = new THREE.MeshStandardMaterial({ color: isCap ? 0x0f0f12 : HAIR_COLORS[spec.hairColor ?? 0], vertexColors: true, roughness: isCap ? 0.9 : 0.78, metalness: 0 });
    parts.hair = add(hg, mats.hair, 'hair');
  }
  // eyes (rigid meshes on the eye bones) and eyelids
  const eyeTex = makeEyeTexture(spec.irisColor ?? 0x4a2f1c);
  const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.15, metalness: 0 });
  const lidMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.6, metalness: 0 });
  const eyes = {};
  for (const sd of ['_l', '_r']) {
    const eyeGeo = new THREE.SphereGeometry(0.0116 * K, 20, 14);
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.castShadow = false;
    rig.bones['eye' + sd].add(eye);
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.0127 * K, 16, 10, 0, Math.PI * 2, 0, 1.27), lidMat);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(0.0127 * K, 16, 10, 0, Math.PI * 2, Math.PI - 0.95, 0.95), lidMat);
    rig.bones['eyelid_up' + sd].add(up); rig.bones['eyelid_lo' + sd].add(lo);
    eyes[sd] = eye;
  }
  for (const m of meshes) m.bind(skeleton, new THREE.Matrix4());
  return { group, rig, poser, skeleton, meshes, parts, mats, eyes, spec, bodyKit, dispose() { atlasTex?.dispose(); eyeTex.dispose(); } };
}

// Bind frames (inverse matrices of upperarm) are needed by the jersey colour function.
function computeBindFrames(rig) {
  new RigPoser(rig).apply(REST_POSE);
  rig.root.updateMatrixWorld(true);
  const frames = {};
  for (const n of ['upperarm_l', 'upperarm_r']) frames[n] = { inv: rig.bones[n].matrixWorld.clone().invert() };
  return { frames };
}
