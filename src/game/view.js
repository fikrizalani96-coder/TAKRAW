// GameView: binds a Match to the 3D scene (players, officials, ball, court, effects, markers) and
// turns match events into animations, sound and camera reactions.
import * as THREE from 'three';
import { getBodyKit, getHeadGeo, ensureOutfit, createHuman } from '../character/humanFactory.js';
import { TEAMS, playerName } from '../character/kits.js';
import { randomFace } from '../character/head.js';
import { Animator } from '../anim/animator.js';
import { buildBallMesh } from '../world/ballmesh.js';
import { buildCourt, buildUmpireChair } from '../world/court.js';
import { buildArena } from '../world/arena.js';
import { buildKampung } from '../world/kampung.js';
import { makeRng } from '../util/math.js';
import { COURT, ROLES } from './config.js';
import { fwdX, fwdZ, leftX, leftZ } from './player.js';

const WIN = ['cel.fistpump.R.strong', 'cel.fistpump.L.wild', 'cel.arms.up.v', 'cel.arms.up.wild', 'cel.jump.fist.R', 'cel.jump.fist.L', 'cel.jump.bump.R', 'cel.chest.thump.R', 'cel.flex.both', 'cel.point.sky.R', 'cel.clap.overhead', 'cel.fistpump.R.wild', 'cel.dance.2', 'cel.highfive.up.R'];
const BIG_WIN = ['cel.flip.back', 'cel.kneeslide.fwd', 'cel.cartwheel', 'cel.arms.up.kneel', 'cel.flip.front', 'cel.jump.fist.R'];
const LOSE = ['react.hands.head', 'react.hands.knees', 'react.slump', 'react.headshake', 'react.wipe.face.R', 'react.arms.disbelief.R', 'react.point.self.R', 'react.apology.R', 'react.kick.ground.R', 'idle.tired', 'idle.hands-hips'];
const PREP = ['serve.prep.a', 'serve.prep.b', 'serve.prep.c', 'serve.prep.d', 'serve.prep.e', 'serve.prep.f'];
const HAIR = ['short', 'buzz', 'undercut', 'swept', 'short', 'buzz'];
const LOOPING = new Set(['cel.clap.overhead', 'cel.clap.front', 'cel.airplane', 'cel.dance.1', 'cel.dance.2', 'cel.dance.3', 'cel.dance.4', 'cel.dance.5', 'cel.dance.6']);

const colDist = (a, b) => { const A = new THREE.Color(a), B = new THREE.Color(b); return Math.hypot(A.r - B.r, A.g - B.g, A.b - B.b); };

export class GameView {
  /**
   * app: { renderer, scene, camera, audio, quality, camRig }
   * cfg: { env:'official'|'kampung', teams:[code,code], gender, seed }
   */
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg; this.scene = app.scene; this.quality = app.quality || 'medium';
    this.rng = makeRng(cfg.seed ?? 99);
    this.humans = {}; this.officials = []; this.match = null;
    this.ballQuat = new THREE.Quaternion(); this.trail = []; this.fx = []; this.time = 0;
    this.markers = {}; this.excite = 0.15;
    this.landMark = null; this.pendingStop = [];
    this.timeScale = 1; this.slowT = 0; this.slowTo = 1; this.slowmo = true;
  }

  async init(progress = () => {}) {
    const cfg = this.cfg, scene = this.scene, q = this.quality;
    const teamKits = [TEAMS[cfg.teams[0]].kit, TEAMS[cfg.teams[1]].kit];
    if (colDist(teamKits[0].primary, teamKits[1].primary) < 0.42) teamKits[1] = { ...teamKits[1], primary: teamKits[1].secondary, secondary: teamKits[1].primary, shorts: teamKits[1].secondary === 0xffffff ? 0x222222 : teamKits[1].shorts };
    this.teamKits = teamKits;
    // environment
    progress('Building venue…', 0.02);
    if (cfg.env === 'kampung') this.env = buildKampung({ quality: q, seed: cfg.seed });
    else this.env = buildArena({ quality: q, seed: cfg.seed, teamColors: [teamKits[0].primary, teamKits[1].primary] });
    scene.add(this.env.group);
    if (this.env.fog) scene.fog = new THREE.Fog(this.env.fog.color, this.env.fog.near, this.env.fog.far);
    this.court = cfg.env === 'kampung' ? this.env.court : buildCourt({ gender: cfg.gender });
    if (cfg.env !== 'kampung') scene.add(this.court.group);
    if (cfg.env !== 'kampung') { this.chair = buildUmpireChair(); this.chair.position.set(4.35, 0, 0); this.chair.rotation.y = -Math.PI / 2; scene.add(this.chair); }
    // ball
    this.ballMesh = buildBallMesh(0.0668, this.env.ballColor ? { color: this.env.ballColor } : {}); this.ballMesh.scale.setScalar(1.35); scene.add(this.ballMesh);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    this.trailLine = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.0 })); this.trailLine.frustumCulled = false; scene.add(this.trailLine);
    this.buildMarkers();
    // humans
    const builds = ['tekong', 'tosser', 'killer'];
    const outfit = cfg.env === 'kampung' ? 'kampung' : 'sport';
    const kits = {};
    let step = 0; const total = 3 + 1 + 6 + 4;
    for (const b of builds) { progress(`Sculpting athletes (${b})…`, 0.1 + 0.5 * (step++ / total)); kits[b] = await getBodyKit(b, q); await ensureOutfit(kits[b], outfit); }
    this.kits = kits;
    this.playersData = [[], []];
    for (let t = 0; t < 2; t++) {
      const code = cfg.teams[t];
      const nums = t === 0 ? [7, 9, 11] : [10, 17, 23];
      for (let i = 0; i < 3; i++) {
        progress(`Dressing ${TEAMS[code].name}…`, 0.1 + 0.5 * (step++ / total));
        const rng = makeRng((cfg.seed ?? 1) * 31 + t * 7 + i * 3 + 5);
        const face = randomFace(rng);
        const kit = kits[builds[i]];
        const faceKey = `f${t}${i}`;
        const head = await getHeadGeo(kit, faceKey, face);
        const nm = playerName(code, rng);
        const tone = TEAMS[code].tone[Math.floor(rng() * TEAMS[code].tone.length)];
        const p = this.match ? this.match.players[t][i] : null;
        const spec = { skin: tone, hairStyle: HAIR[(t * 3 + i + Math.floor(rng() * 3)) % HAIR.length], hairColor: Math.floor(rng() * 4), face, faceKey, kit: teamKits[t], number: nums[i], name: nm.last, outfit, barefoot: outfit === 'kampung', accessories: { knee: rng() < 0.7, wrist: rng() < 0.4 },
          irisColor: [0x4a2f1c, 0x3a2414, 0x5a3a20][Math.floor(rng() * 3)] };
        if (outfit === 'kampung') { const tees = t === 0 ? [0x2f6fb5, 0x2a8fb0, 0x3a5aa0] : [0xb83a32, 0xc4602a, 0xa03040]; spec.teeColor = tees[i]; spec.shortsColor = t === 0 ? 0x1c2c58 : 0x3a1c1c; }
        this.playersData[t][i] = { spec, kit, head, name: nm, number: nums[i] };
      }
    }
    // officials
    const offKit = await getBodyKit('official', q); await ensureOutfit(offKit, 'suit');
    progress('Preparing officials…', 0.8);
    this.offKit = offKit;
    this.officialSpecs = [];
    this.setupOfficials(offKit);
    await this.spawnOfficials();
    progress('Ready', 1);
  }

  /** Create the human meshes and attach them to the match's players. */
  bindMatch(match) {
    this.match = match;
    for (let t = 0; t < 2; t++) for (let i = 0; i < 3; i++) {
      const d = this.playersData[t][i];
      const h = createHuman(d.kit, d.head, d.spec);
      this.scene.add(h.group);
      const an = new Animator(h);
      const p = match.players[t][i];
      p.anim = an; p.visual = h; p.name = d.name.last; p.number = d.number; p.fullName = `${d.name.first} ${d.name.last}`;
      this.humans[p.id] = h;
      h.group.position.set(p.x, 0, p.z); h.group.rotation.y = p.heading;
    }
    match.on('touch', (e) => this.onTouch(e));
    match.on('bounce', (e) => this.onBounce(e));
    match.on('net', (e) => { this.court && this.court.impact && this.court.impact(e.x, e.y, e.z, e.speed); this.app.audio.net(e.speed); this.app.camRig.addShake(0.15); });
    match.on('cord', (e) => { this.court && this.court.impact && this.court.impact(e.x, e.y, e.z, e.speed * 0.6); this.app.audio.cord(e.speed); });
    match.on('point', (e) => this.onPoint(e));
    match.on('state', (e) => this.onState(e));
    match.on('landed', (e) => this.onLanded(e));
    match.on('serve-start', () => {});
    match.on('whiff', (e) => { if (e.player.anim) e.player.anim.setFace(-0.2, 0.3, 0.4); });
  }

  setupOfficials(kit) {
    const scene = this.scene; const cfg = this.cfg;
    const list = cfg.env === 'kampung'
      ? [{ id: 'referee', pos: [-3.9, 0.0], face: Math.PI / 2, clip: 'ref.idle', hair: 'songkok', suit: 0xe8e4d8, trs: 0x3a3f4a, build: 'official' }]
      : [
        { id: 'umpire', pos: [4.35, 0.03], y: 1.03, face: -Math.PI / 2, clip: 'ref.stand.chair', hair: 'short', suit: 0x1b2745, trs: 0x24262c },
        { id: 'referee', pos: [-4.1, 0.0], face: Math.PI / 2, clip: 'ref.idle', hair: 'buzz', suit: 0x2a4a7a, trs: 0x1f2126 },
        { id: 'line1', pos: [-4.6, 7.4], face: Math.PI * 0.6, clip: 'line.flag.idle.R', hair: 'short', suit: 0x22262e, trs: 0x22262e },
        { id: 'line2', pos: [4.6, -7.4], face: -Math.PI * 0.4, clip: 'line.flag.idle.L', hair: 'undercut', suit: 0x22262e, trs: 0x22262e },
      ];
    this.officialDefs = list;
  }

  async spawnOfficials() {
    for (const d of this.officialDefs) {
      const rng = makeRng(hashS(d.id));
      const face = randomFace(rng);
      const head = await getHeadGeo(this.offKit, 'o' + d.id, face);
      const spec = { skin: Math.floor(rng() * 4), hairStyle: d.hair, hairColor: Math.floor(rng() * 4), face, faceKey: 'o' + d.id, outfit: 'suit', suitColor: d.suit, trouserColor: d.trs, kit: this.teamKits[0] };
      const h = createHuman(this.offKit, head, spec);
      h.group.position.set(d.pos[0], d.y || 0, d.pos[1]); h.group.rotation.y = d.face;
      h.group.traverse((o) => { if (o.isMesh) o.castShadow = this.quality !== 'low' || d.id === 'umpire'; });   // saves a skinned shadow pass per official on phones
      this.scene.add(h.group);
      const an = new Animator(h); an.play(d.clip, { fadeIn: 0.01, loop: true });
      this.officials.push({ def: d, human: h, anim: an, timer: 0 });
    }
  }

  buildMarkers() {
    const mk = (inner, outer, color, opacity = 0.9) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 5; m.visible = false; this.scene.add(m); return m;
    };
    this.markers.active = mk(0.46, 0.56, 0xffe14d, 0.95);
    this.markers.landing = mk(0.22, 0.30, 0xffffff, 0.75);
    this.markers.stand = mk(0.30, 0.40, 0x35e0ff, 0.9);
    // aim reticle: ring + cross
    const g = new THREE.Group(); g.visible = false; this.scene.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 36), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.95, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    for (const r of [0, Math.PI / 2]) { const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.06), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.95, depthWrite: false })); bar.rotation.x = -Math.PI / 2; bar.rotation.z = r; bar.position.y = 0.03; g.add(bar); }
    this.markers.aim = g;
    // landing mark (ink spot) after a point
    const spot = new THREE.Mesh(new THREE.RingGeometry(0.10, 0.19, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); spot.rotation.x = -Math.PI / 2; spot.position.y = 0.03; spot.visible = false; this.scene.add(spot); this.landMark = spot;
    // impact rings
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 32), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); r.visible = false; this.scene.add(r); this.fx.push({ mesh: r, t: 1, life: 0.4 }); }
  }

  // ---------------- events ----------------
  onTouch(e) {
    const a = this.app.audio, kind = e.skill && e.skill.startsWith('spike') ? 'spike' : e.serve ? 'serve' : /head/.test(e.skill || '') ? 'head' : /chest|shoulder|back/.test(e.skill || '') ? 'chest' : /thigh|knee/.test(e.skill || '') ? 'body' : e.block ? 'body' : 'foot';
    const power = Math.min(1, (e.speed || 8) / 26);
    a.hit(kind, power);
    const big = kind === 'spike' || (kind === 'serve' && power > 0.6);
    if (kind === 'spike' && power > 0.55 && this.slowmo) { this.slowT = 0.32; this.slowTo = 0.42; }   // cinematic beat on the kill
    if (big) { this.app.camRig.addShake(0.35 * power); this.app.camRig.addKick(0.5); this.excite = Math.min(1, this.excite + 0.25); }
    const fx = this.fx.find((f) => f.t >= 1);
    if (fx && e.speed > 9) { fx.t = 0; fx.life = 0.35; fx.mesh.position.set(this.match.ball.x, this.match.ball.y, this.match.ball.z); fx.mesh.visible = true; fx.big = big; }
    if (e.player && e.player.anim) e.player.anim.setFace(0, big ? 0.55 : 0.15, 0.3);
  }
  /** Ease the simulation clock toward the slow-motion target (called with real dt). */
  tickSlow(dt) {
    const target = this.slowT > 0 ? this.slowTo : 1;
    if (this.slowT > 0) this.slowT -= dt;
    this.timeScale += (target - this.timeScale) * Math.min(1, dt * (target < this.timeScale ? 30 : 8));
    return this.timeScale;
  }
  onBounce(e) { this.app.audio.bounce(e.speed); }
  onLanded(e) {
    if (this.landMark) { this.landMark.position.set(e.x, 0.03, e.z); this.landMark.visible = true; this.landMark.material.color.set(e.result && /out/i.test(e.result.reason) ? 0xff5050 : 0xffffff); }
    // line judge signal
    const off = this.officials.find((o) => o.def.id === (e.z > 0 ? 'line1' : 'line2'));
    if (off) { const isOut = e.result && /out/i.test(e.result.reason); off.anim.play(isOut ? 'line.flag.out.R' : 'line.flag.up.R', { fadeIn: 0.15, fadeOut: 0.3 }); off.timer = 2.0; }
  }
  onState(e) {
    const m = this.match;
    if (e.state === 'serve-prep') {
      if (this.landMark) this.landMark.visible = false;
      this.app.audio.whistle(false);
    }
    if (e.state === 'serve-ready') {
      const t = m.rules.serving, side = m.rules.sideOf(t);
      const server = m.players[t][0], tosser = m.players[t][1];
      server.anim.play(PREP[Math.floor(this.rng() * PREP.length)] + (this.rng() < 0.3 ? '.m' : ''), { fadeIn: 0.3, loop: true });
      tosser.anim.play('ball.hold.ready.R', { fadeIn: 0.3, loop: true });
      const ref = this.officials.find((o) => o.def.id === 'referee');
      if (ref) { ref.anim.play(side > 0 ? 'ref.point.serve.L' : 'ref.point.serve.R', { fadeIn: 0.2, fadeOut: 0.4 }); ref.timer = 1.8; }
      for (const p of m.all) if (p !== server && p !== tosser) p.anim.play('idle.ready' + (this.rng() < 0.5 ? '' : '.m'), { fadeIn: 0.4, loop: true });
    }
    if (e.state === 'setbreak') { this.app.audio.whistle(true); }
    if (e.state === 'matchend') { this.app.audio.whistle(true); }
  }
  onPoint(e) {
    const m = this.match, a = this.app.audio;
    a.whistle(false); a.cheer(e.winner === m.humanTeam || m.humanTeam < 0 ? 1 : 0.55);
    this.excite = 1;
    this.app.camRig.addShake(0.2);
    const bigWin = e.rally >= 6 || /Ace/i.test(e.reason) || e.out.setOver;
    for (const p of m.all) {
      if (p.busy) { /* finish skill first */ }
      const win = p.team === e.winner;
      let id;
      if (win) { const pool = bigWin ? BIG_WIN.concat(WIN) : WIN; id = pool[Math.floor(this.rng() * pool.length)]; }
      else id = LOSE[Math.floor(this.rng() * LOSE.length)];
      const delay = 0.25 + this.rng() * 0.6;
      this.pendingStop.push({ t: this.time + delay, fn: () => { p.busy = null; p.anim.setFace(win ? 0.7 : -0.4, win ? 0.5 : 0.1, win ? 0 : 0.4); p.anim.play(id, { fadeIn: 0.25, fadeOut: 0.35, loop: LOOPING.has(id) }); if (LOOPING.has(id)) this.pendingStop.push({ t: this.time + 2.2, fn: () => p.anim.stopAction(0.4) }); } });
    }
    // referee signals the point
    const ref = this.officials.find((o) => o.def.id === 'referee'); const side = m.rules.sideOf(e.winner);
    if (ref) { ref.anim.play(side > 0 ? 'ref.point.award.L' : 'ref.point.award.R', { fadeIn: 0.2, fadeOut: 0.4 }); ref.timer = 2.0; }
    const ump = this.officials.find((o) => o.def.id === 'umpire'); if (ump) { ump.anim.play('umpire.flip.score', { fadeIn: 0.2, fadeOut: 0.4 }); ump.timer = 1.6; }
  }

  // ---------------- per-frame ----------------
  update(dt) {
    this.time += dt;
    const m = this.match; if (!m) return;
    for (let i = this.pendingStop.length - 1; i >= 0; i--) if (this.time >= this.pendingStop[i].t) { this.pendingStop[i].fn(); this.pendingStop.splice(i, 1); }
    const ball = m.ball;
    // ---- ball ----
    this.ballMesh.position.set(ball.x, ball.y, ball.z);
    const w = Math.hypot(ball.wx, ball.wy, ball.wz);
    if (w > 0.01) { const ax = new THREE.Vector3(ball.wx / w, ball.wy / w, ball.wz / w); this.ballQuat.setFromAxisAngle(ax, w * dt); this.ballMesh.quaternion.premultiply(this.ballQuat); }
    else if (Math.hypot(ball.vx, ball.vz) > 0.5) { const ax = new THREE.Vector3(ball.vz, 0, -ball.vx).normalize(); this.ballMesh.quaternion.premultiply(this.ballQuat.setFromAxisAngle(ax, Math.hypot(ball.vx, ball.vz) / 0.0668 * dt * 0.5)); }
    // trail
    const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
    this.trail.unshift([ball.x, ball.y, ball.z]); if (this.trail.length > 24) this.trail.pop();
    const pos = this.trailLine.geometry.attributes.position;
    for (let i = 0; i < 24; i++) { const p = this.trail[Math.min(i, this.trail.length - 1)]; pos.setXYZ(i, p[0], p[1], p[2]); }
    pos.needsUpdate = true; this.trailLine.material.opacity = Math.min(0.55, Math.max(0, (sp - 11) / 18));
    // ---- players ----
    for (const p of m.all) {
      const h = p.visual, an = p.anim; if (!h) continue;
      h.group.position.set(p.x, 0, p.z); h.group.rotation.y = p.heading;
      const f = fwdX(p.heading) * p.vx + fwdZ(p.heading) * p.vz, l = leftX(p.heading) * p.vx + leftZ(p.heading) * p.vz;
      const spd = Math.hypot(p.vx, p.vz);
      const crouchTarget = spd > 4.6 ? 0.12 : spd > 2.6 ? 0.3 : 0.62;
      p._crouch = (p._crouch ?? 0.6) + (crouchTarget - (p._crouch ?? 0.6)) * Math.min(1, dt * 6);
      if (p.busy || p.celebrating) an.setLocomotion(0, 0, 0.6); else an.setLocomotion(f, l, p._crouch);
      // gaze: the ball when relevant, otherwise the net
      const g = this._gaze || (this._gaze = new THREE.Vector3());
      if (m.state === 'rally' || m.state === 'toss') g.set(ball.x, Math.max(0.8, ball.y), ball.z); else g.set(0, 1.4, 0);
      an.setGaze(g, 0.85);
      h.group.updateMatrixWorld(true);
      an.update(dt);
      // feed the human-jump height into gameplay (block/attack reach)
      p.y = an.jumpY;
    }
    for (const o of this.officials) { o.human.group.updateMatrixWorld(true); o.anim.update(dt); if (o.timer > 0) { o.timer -= dt; if (o.timer <= 0) { o.anim.play(o.def.clip, { fadeIn: 0.3, loop: true }); } } }
    // ---- fx ----
    for (const fx of this.fx) { if (fx.t >= 1) continue; fx.t += dt / fx.life; const s = 0.4 + fx.t * (fx.big ? 2.4 : 1.4); fx.mesh.scale.setScalar(s); fx.mesh.material.opacity = (1 - fx.t) * (fx.big ? 0.65 : 0.45); fx.mesh.quaternion.copy(this.app.camera.quaternion); if (fx.t >= 1) fx.mesh.visible = false; }
    this.court && this.court.update && this.court.update(dt);
    this.excite += (0.18 - this.excite) * Math.min(1, dt * 0.4);
    this.env.anim && this.env.anim.update(dt, this.excite);
    this.updateMarkers(dt);
  }

  updateMarkers(dt) {
    const m = this.match, hc = m.humanCtl, k = this.markers, t = this.time;
    const show = hc && this.app.showAids !== false && m.state !== 'point' && m.state !== 'matchend';
    k.active.visible = !!(show && hc.active);
    if (k.active.visible) { k.active.position.set(hc.active.x, 0.03, hc.active.z); k.active.scale.setScalar(1 + 0.06 * Math.sin(t * 6)); }
    // landing marker for the ball when it will land on the human's half
    let land = false;
    if (show && m.state === 'rally') { const pred = m.predictBall(); if (pred.landing && pred.landing.z * hc.side > 0) { k.landing.position.set(pred.landing.x, 0.03, pred.landing.z); land = true; k.landing.scale.setScalar(1 + 0.12 * Math.sin(t * 9)); } }
    k.landing.visible = land;
    const sug = show ? hc.suggestion : null;
    k.stand.visible = !!(sug && !sug.started);
    if (k.stand.visible) { k.stand.position.set(sug.stand.x, 0.035, sug.stand.z); k.stand.scale.setScalar(1 + 0.1 * Math.sin(t * 7)); k.stand.material.opacity = sug.armed ? 0.35 : 0.9; }
    const aimCtx = show && (hc.context === 'serve' || hc.context === 'kick' || hc.context === '3');
    k.aim.visible = !!(aimCtx);
    if (k.aim.visible) { k.aim.position.set(hc.aim.x, 0, hc.aim.z); k.aim.scale.setScalar(hc.aimTouched ? 1 : 0.8); k.aim.rotation.y = t * 0.8; }
  }
}
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
