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
  low: { body: 0.0140, head: 0.0068, hand: 0.0058, foot: 0.0074, cloth: 0.0145 },
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
  if (ly > -0.06 && ly < 0.14 && lz > 0.06) {
    // eyebrows: thin arcs above the eyes
    const ax = Math.abs(lx);
    if (ax > 0.010 && ax < 0.054) {
      const yb = 0.087 + (ax - 0.010) * 0.10 - (ax > 0.040 ? (ax - 0.040) * 1.8 : 0);
      const d = Math.abs(ly - yb);
      if (d < 0.0042) { const t = 1 - d / 0.0042; return [1 - 0.72 * t, 1 - 0.75 * t, 1 - 0.74 * t]; }
    }
    // lips
    const lipC = -0.0125;
    if (ax < 0.024 && lz > 0.085) {
      const upper = ly > lipC && ly < lipC + 0.0095, lower = ly <= lipC && ly > lipC - 0.0115;
      const edge = Math.abs(ly - lipC);
      if (edge < 0.0012) return [0.55, 0.32, 0.30];
      if ((upper || lower) && ax < 0.021 - Math.abs(ly - lipC) * 0.5) return [1.0, 0.74, 0.70];
    }
  }
  switch (tag) {
    case 'ear': return [1.03, 0.87, 0.83];
    case 'nose': return [1.02, 0.93, 0.91];
    case 'cheek': return [1.02, 0.94, 0.92];
    default: return [1, 1, 1];
  }
}

/** Build (or fetch) the shared geometry for a body build at a quality level. */
export async function getBodyKit(buildName = 'tekong', quality = 'high', onProgress = null) {
  const key = `${buildName}|${quality}`;
  if (kitCache.has(key)) return kitCache.get(key);
  const p = (async () => {
    const q = QUALITY[quality];
    const B = BUILDS[buildName];
    const dims = makeDims({ height: B.height, torso: B.torso, leg: B.leg, arm: B.arm });
    const rig = buildRig(dims);
    const bind = computeBind(rig);
    const K = dims.scale;
    const step = async (label, fn) => { const r = fn(); if (onProgress) onProgress(label); await tick(); return r; };
    const body = buildBodyScene(rig, bind, B);
    const yCut = new THREE.Vector3().setFromMatrixPosition(rig.bones.foot_l.matrixWorld).y - 0.003;
    const geo = {};
    geo.body = await step('body', () => buildSkinnedGeometry(body, body.bounds(), q.body, bind, rig, { clip: (x, y) => yCut - y }));
    geo.handL = await step('hand', () => { const s = buildHandScene(rig, bind, '_l', body); return buildSkinnedGeometry(s, s.bounds(), q.hand, bind, rig, { kw: 0.006, wide: 0.05 }); });
    geo.handR = await step('hand', () => { const s = buildHandScene(rig, bind, '_r', body); return buildSkinnedGeometry(s, s.bounds(), q.hand, bind, rig, { kw: 0.006, wide: 0.05 }); });
    geo.footL = await step('foot', () => { const s = buildFootScene(rig, bind, '_l'); return buildSkinnedGeometry(s, s.bounds(), q.foot, bind, rig, { kw: 0.008, wide: 0.05 }); });
    geo.footR = await step('foot', () => { const s = buildFootScene(rig, bind, '_r'); return buildSkinnedGeometry(s, s.bounds(), q.foot, bind, rig, { kw: 0.008, wide: 0.05 }); });
    // garments
    const garments = {};
    const mk = async (label, scene, extra = {}) => {
      const g = await step(label, () => buildSkinnedGeometry(scene, scene.bounds(), q.cloth, bind, rig, { kw: 0.016, ...extra }));
      return g;
    };
    garments.jersey = { cs: jerseyScene(rig, bind, body), };
    garments.jersey.geo = await mk('jersey', garments.jersey.cs);
    garments.tee = { cs: jerseyScene(rig, bind, body, { sleeve: 0.5, loose: 1.5, waistLoose: 0.020, hem: rig.bones.pelvis.matrixWorld.elements[13] - 0.075 * K }) };
    garments.tee.geo = await mk('tee', garments.tee.cs);
    garments.jacket = { cs: jerseyScene(rig, bind, body, { sleeve: 1.6, loose: 1.9, waistLoose: 0.018, hem: rig.bones.pelvis.matrixWorld.elements[13] - 0.15 * K }) };
    garments.jacket.geo = await mk('jacket', garments.jacket.cs);
    garments.shorts = { cs: shortsScene(rig, bind, body) };
    garments.shorts.geo = await mk('shorts', garments.shorts.cs);
    garments.kshorts = { cs: shortsScene(rig, bind, body, { hem: 0.44 * K * dims.leg, baggy: 1.2 }) };
    garments.kshorts.geo = await mk('kshorts', garments.kshorts.cs);
    garments.trousers = { cs: shortsScene(rig, bind, body, { hem: 0.10 * K, baggy: 0.55 }) };
    garments.trousers.geo = await mk('trousers', garments.trousers.cs);
    garments.socks = { cs: socksScene(rig, bind, body), top: 0.28 * K * dims.leg };
    garments.socks.geo = await mk('socks', garments.socks.cs, { kw: 0.01 });
    garments.knee = { cs: bandScene(rig, bind, body, 'knee') };
    garments.knee.geo = await mk('knee', garments.knee.cs, { kw: 0.01 });
    garments.wrist = { cs: bandScene(rig, bind, body, 'wrist') };
    garments.wrist.geo = await mk('wrist', garments.wrist.cs, { kw: 0.008 });
    const shoeL = shoeScene(rig, bind, '_l'), shoeR = shoeScene(rig, bind, '_r');
    garments.shoeL = { geo: await step('shoe', () => buildSkinnedGeometry(shoeL, shoeL.bounds(), q.foot, bind, rig, { kw: 0.01, wide: 0.05 })) };
    garments.shoeR = { geo: await step('shoe', () => buildSkinnedGeometry(shoeR, shoeR.bounds(), q.foot, bind, rig, { kw: 0.01, wide: 0.05 })) };
    // decals on the sport jersey and shorts (uv into a shared atlas)
    const yb = (y) => y * K;
    const back = extractDecal(garments.jersey.geo, { min: { x: -0.16 * K, y: yb(1.10), z: -1 }, max: { x: 0.16 * K, y: yb(1.43), z: 0.0 } }, (nx, ny, nz) => nz < -0.3,
      (x, y) => [0.5 * (0.5 - x / (0.32 * K)), (y - yb(1.10)) / (yb(1.43) - yb(1.10))]);
    const front = extractDecal(garments.jersey.geo, { min: { x: -0.07 * K, y: yb(1.22), z: 0 }, max: { x: 0.07 * K, y: yb(1.36), z: 1 } }, (nx, ny, nz) => nz > 0.3,
      (x, y) => [0.5 + 0.25 * (0.5 + x / (0.14 * K)), 1 - (100 + (1 - (y - yb(1.22)) / (yb(1.36) - yb(1.22))) * 200) / 512]);
    const shortsD = extractDecal(garments.shorts.geo, { min: { x: 0.04 * K, y: yb(0.70), z: 0 }, max: { x: 0.17 * K, y: yb(0.86), z: 1 } }, (nx, ny, nz) => nz > 0.25,
      (x, y) => [0.75 + 0.25 * ((x - 0.04 * K) / (0.13 * K)), 1 - (28 + (1 - (y - yb(0.70)) / (yb(0.86) - yb(0.70))) * 200) / 512]);
    return { key, dims, buildName, B, geo, garments, decals: { back, front, shorts: shortsD }, quality };
  })();
  kitCache.set(key, p);
  return p;
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
  headCache.set(key, geo);
  return geo;
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
  parts.head = add(headGeo, skinMat, 'head');
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
    const eyeGeo = new THREE.SphereGeometry(0.0125 * K, 20, 14);
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.castShadow = false;
    rig.bones['eye' + sd].add(eye);
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.0138 * K, 16, 10, 0, Math.PI * 2, 0, 1.15), lidMat);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(0.0138 * K, 16, 10, 0, Math.PI * 2, Math.PI - 0.85, 0.85), lidMat);
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
