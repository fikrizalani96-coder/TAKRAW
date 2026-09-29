// Match orchestrator: state machine, fixed-step physics, rules adjudication, skill execution and
// contact resolution. Fully headless-capable (rendering/animation attach through player.anim,
// events and hook objects).
import { COURT, ROLES, SURFACES, PHYS_DT, MATCH_FORMATS } from './config.js';
import { World, BallState } from './ball.js';
import { MatchRules, RallyRules } from './rules.js';
import { Player, fwdX, fwdZ, leftX, leftZ, wrapPi } from './player.js';
import { TeamBrain } from './brain.js';
import { SKILLS, pickClip } from './skilllib.js';
import { makeRng } from '../util/math.js';
import { getClip, allEntries } from '../anim/catalog.js';

const V = { lerp: (a, b, t) => a + (b - a) * t };
const DIFF = { rookie: { skill: 0.62, react: 1.25, aggr: 0.5 }, pro: { skill: 0.82, react: 1.0, aggr: 0.75 }, legend: { skill: 0.97, react: 0.85, aggr: 0.95 } };

export class Match {
  /**
   * opts: { format, surface:'official'|'kampung', gender, teams:[{code,name},{...}], humanTeam:-1|0|1, difficulty,
   *         seed, headless, assist, firstServer }
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.rng = makeRng(opts.seed ?? 12345);
    this.diff = DIFF[opts.difficulty || 'pro'];
    this.rules = new MatchRules(opts.format || 'istaf', { firstServer: opts.firstServer ?? 0 });
    this.surfaceName = opts.surface || 'official';
    this.world = new World({ gender: opts.gender || 'men', surface: SURFACES[this.surfaceName], hasCeiling: this.surfaceName === 'official' });
    this.ball = new BallState();
    this.teamInfo = opts.teams || [{ code: 'THA', name: 'Thailand' }, { code: 'MAS', name: 'Malaysia' }];
    this.humanTeam = opts.humanTeam ?? -1;
    this.assist = opts.assist ?? 0.75;
    this.time = 0; this.state = 'prematch'; this.stateTime = 0;
    this.rally = null; this.serve = null;
    this.listeners = {};
    this.pending = [];
    this.ballHeld = null;
    this.floorHandled = false;
    this.pred = null; this.predAt = -1;
    this.humanCtl = null;
    this.stats = [{ points: 0, spikes: 0, blocks: 0, aces: 0, faults: 0 }, { points: 0, spikes: 0, blocks: 0, aces: 0, faults: 0 }];
    this.lastResult = null;
    this.rallyTouches = 0; this.longestRally = 0;
    this.physAcc = 0;
    this.players = [[], []];
    const roles = [ROLES.TEKONG, ROLES.TOSSER, ROLES.KILLER];
    let id = 0;
    for (let t = 0; t < 2; t++) for (let i = 0; i < 3; i++) {
      const p = new Player({ id: id++, team: t, role: roles[i], index: i, number: opts.numbers?.[t]?.[i] ?? [7, 9, 11, 12, 14, 17][t * 3 + i], name: opts.names?.[t]?.[i], rating: this.ratingFor(t, i) });
      this.players[t].push(p);
    }
    this.all = [...this.players[0], ...this.players[1]];
    this.brains = [new TeamBrain(this, 0), new TeamBrain(this, 1)];
    this.setSides();
    this.placeFormation('serve', true);
  }

  ratingFor(team, idx) {
    const base = this.diff.skill;
    const isHuman = team === this.humanTeam;
    const teamMod = this.teamInfo[team]?.fame ? 0.02 * (this.teamInfo[team].fame - 3) : 0;
    const spread = [0.02, 0.0, 0.03][idx];
    return Math.max(0.45, Math.min(1, (isHuman ? 0.86 : base) + teamMod + spread));
  }

  // ---------------- events ----------------
  on(type, fn) { (this.listeners[type] ||= []).push(fn); return this; }
  emit(type, data = {}) { data.type = type; const l = this.listeners[type]; if (l) for (const f of l) f(data); const a = this.listeners['*']; if (a) for (const f of a) f(data); }
  setState(s) { this.state = s; this.stateTime = 0; this.emit('state', { state: s }); }

  // ---------------- setup ----------------
  setSides() {
    for (let t = 0; t < 2; t++) for (const p of this.players[t]) p.side = this.rules.sideOf(t);
  }
  placeFormation(kind, snap) {
    for (let t = 0; t < 2; t++) {
      const f = this.brains[t].formation(t === this.rules.serving ? (kind === 'serve' ? 'serve' : 'base') : (kind === 'serve' ? 'receive' : 'base'));
      this.players[t].forEach((p, i) => { if (snap) p.setPos(f[i].x, f[i].z, p.side > 0 ? Math.PI : 0); p.target = f[i]; });
    }
  }
  start() { this.beginServePrep(); }

  get servingTeam() { return this.rules.serving; }
  serverPlayer() { return this.players[this.rules.serving][0]; }
  tosserPlayer() { return this.players[this.rules.serving][1]; }
  sideTeam = (sign) => this.rules.teamOnSide(sign);

  // ---------------- serve procedure ----------------
  beginServePrep() {
    this.rally = new RallyRules(this.rules, this.rules.serving);
    this.serve = null; this.ballHeld = null; this.pending = []; this.floorHandled = false;
    this.rallyTouches = 0;
    for (const b of this.brains) b.reset();
    this.setSides();
    this.placeFormation('serve', false);
    for (const p of this.all) { p.busy = null; p.celebrating = false; p.mood = null; }
    const tos = this.tosserPlayer();
    this.ball.x = tos.x + 0.2; this.ball.y = 1.05; this.ball.z = tos.z; this.ball.vx = this.ball.vy = this.ball.vz = 0; this.ball.wx = this.ball.wy = this.ball.wz = 0;
    this.ballHeld = { player: tos };
    this.setState('serve-prep');
    this.emit('callscore', { score: [...this.rules.points], serving: this.rules.serving });
  }

  /** Called by AI timers or human input to begin a service. kind: 'kuda'|'sila'|'cara'|'toe'. aim: {x,z} on the opposing floor. */
  startService(kind = 'kuda', aim = null, human = false) {
    if (this.state !== 'serve-ready') return false;
    const t = this.rules.serving, side = this.rules.sideOf(t);
    const server = this.serverPlayer(), tosser = this.tosserPlayer();
    const surfKey = { kuda: 'serve.instep', sila: 'serve.inside', cara: 'serve.outside', toe: 'serve.toe' }[kind] || 'serve.instep';
    const sk = SKILLS[surfKey];
    const legPref = this.rng() < 0.75 ? 'R' : 'L';
    const power = kind === 'kuda' ? 'power' : kind === 'toe' ? 'soft' : 'medium';
    const y = kind === 'toe' ? 0.32 : kind === 'kuda' ? 1.15 : kind === 'sila' ? 0.98 : 1.05;
    const pick = pickClip(surfKey, { y, x: legPref === 'R' ? -0.06 : 0.06, z: sk.z }, { side: legPref, filter: (e) => e.id.includes('.' + power + '.') });
    server.heading = server.side > 0 ? Math.PI : 0;
    tosser.heading = tosser.side > 0 ? Math.PI : 0;
    const S = server.worldOf(pick.T[0], pick.T[2], pick.T[1]);
    // toss clip
    const tossPick = this.pickToss(tosser, S);
    const tRelease = this.time + tossPick.tc;
    const Ttoss = 0.95 + 0.1 * this.rng();
    const arrive = tRelease + Ttoss;
    const serveObj = { kind, aim, human, server, tosser, pick, S, tRelease, arrive, tossPick, released: false, kickStarted: false, pressed: false, side };
    this.serve = serveObj;
    tosser.busy = { kind: 'toss', tContact: tRelease, tStart: this.time, started: true, resolved: false, entry: tossPick.entry, info: tossPick, ts: 1, isToss: true, canReplan: false };
    tosser.anim?.play(tossPick.entry.id, { fadeIn: 0.12, contactAt: tossPick.tc });
    this.setState('toss');
    this.emit('serve-start', { kind });
    return true;
  }

  pickToss(tosser, S) {
    const d = Math.hypot(S.x - tosser.x, S.z - tosser.z);
    const hand = 'R';
    // toss catalogue: hand x loft x dist
    const entries = getCatalogToss();
    const dist = d > 4.5 ? 0.95 : d > 3.2 ? 0.5 : 0.1;
    let best = null, bs = 1e9;
    for (const e of entries) { const s = Math.abs(e.params.dist - dist) + Math.abs(e.params.loft - 0.55) * 0.8 + (e.params.hand === hand ? 0 : 0.3); if (s < bs) { bs = s; best = e; } }
    const clip = getClip(best.id);
    return { entry: best, clip, tc: clip.events.contact, T: clip.meta.contact.T, side: hand };
  }

  updateServe(dt) {
    const sv = this.serve; if (!sv) return;
    // ball held in the tosser's hand until release
    if (!sv.released && this.time >= sv.tRelease) this.releaseToss();
    if (sv.released && !sv.kickStarted) {
      // AI kick timing (human presses trigger earlier through humanServeKick)
      if (!sv.human) {
        const jitter = (1 - sv.server.rating) * (this.rng() - 0.5) * 0.14;
        const tStart = sv.arrive - sv.pick.tc + jitter;
        if (this.time >= tStart) this.beginKick(sv.pick.tc);
      } else if (this.time >= sv.arrive - sv.pick.tc + 0.10 && this.assist > 0.3) {
        this.beginKick(sv.pick.tc, 0.85);      // late auto-kick when the human did not press
      }
    }
    if (sv.kickStarted && !sv.contactDone && this.time >= sv.tContact) this.resolveServeContact();
  }

  releaseToss() {
    const sv = this.serve, b = this.ball;
    sv.released = true; this.ballHeld = null;
    const tos = sv.tosser;
    const R = tos.worldOf(sv.tossPick.T[0], sv.tossPick.T[2], sv.tossPick.T[1]);
    b.x = R.x; b.y = R.y; b.z = R.z;
    const v = this.world.solveFlightTime(R.x, R.y, R.z, sv.S.x, sv.S.y, sv.S.z, sv.arrive - this.time, null, 5);
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.wx = b.wy = b.wz = 0;
    this.emit('toss', { at: R });
  }

  /** Server begins the kick so contact happens tcServe seconds from now. */
  beginKick(tc, quality = 1) {
    const sv = this.serve; if (sv.kickStarted) return;
    sv.kickStarted = true; sv.tContact = this.time + tc; sv.autoQ = quality;
    const server = sv.server;
    server.busy = { kind: 'serve', tContact: sv.tContact, tStart: this.time, started: true, resolved: false, entry: sv.pick.entry, info: sv.pick, ts: 1, isServe: true, T: sv.pick.T, skillKey: 'serve.instep', canReplan: false };
    server.anim?.play(sv.pick.entry.id, { fadeIn: 0.08, contactAt: tc });
    this.emit('kick-start', {});
  }
  /** Human pressed the serve button: ideal moment is (arrive - tc); returns timing error seconds. */
  humanServePress() {
    const sv = this.serve; if (!sv || !sv.released || sv.kickStarted) return null;
    this.beginKick(sv.pick.tc);
    return (this.time + sv.pick.tc) - sv.arrive;
  }

  resolveServeContact() {
    const sv = this.serve, b = this.ball, server = sv.server;
    sv.contactDone = true;
    const ideal = server.worldOf(sv.pick.T[0], sv.pick.T[2], sv.pick.T[1]);
    const d = Math.hypot(b.x - ideal.x, b.y - ideal.y, b.z - ideal.z);
    const R = 0.55;
    let q = Math.max(0, 1 - Math.pow(d / R, 1.3)) * (sv.autoQ ?? 1);
    if (d > R * 1.3) {
      this.emit('whiff', { player: server }); server.busy.resolved = true;
      // ball keeps falling; serving team faults when it lands
      this.setState('rally'); return;
    }
    this.rally.serveTouch(this.rules.serving, server.id);
    this.rallyTouches = 1;
    server.lastTouchTime = this.time;
    const t = this.rules.serving, oppT = 1 - t, os = this.rules.sideOf(oppT);
    let tgt = sv.aim || this.brains[t].chooseAttackTarget(true);
    // serve target: deep zones
    const isKuda = sv.kind === 'kuda', sp = { kuda: 20.5, sila: 14.5, cara: 16.5, toe: 9.5 }[sv.kind] * (0.9 + 0.1 * server.stats.power);
    const noise = this.noise(server, q, 0.55);
    const target = { x: clamp(tgt.x + noise.x, -3.3, 3.3), z: os * clamp(Math.abs(tgt.z) + noise.z, 0.6, 7.3) };
    const spin = this.spinFor(sv.kind, os);
    const minClear = 0.07 - 0.35 * (1 - q) * (1 - q);       // mishits can clip the tape
    let sol = this.solveHit(b, target, os, sp, spin, minClear);
    if (sol && q > 0.55) sol = { ...sol, ...this.world.ensureClear(b, sol, spin) };
    if (sol) { b.vx = sol.vx; b.vy = sol.vy; b.vz = sol.vz; b.wx = spin[0]; b.wy = spin[1]; b.wz = spin[2]; }
    this.floorHandled = false;
    server.busy.resolved = true;
    this.setState('rally');
    this.emit('touch', { player: server, kind: 'serve', quality: q, speed: Math.hypot(b.vx, b.vy, b.vz), team: t, serve: true, skill: 'serve.' + sv.kind });
    this.onTouched(server, true);
  }

  /**
   * Hit solver with depth adaptation: try the requested landing depth at `speed`, then progressively
   * shorter depths (a flat fast ball can only land so deep and still clear the net), then fall back to a lob.
   */
  solveHit(b, target, os, speed, spin, minClear, lobOpts = {}) {
    const w = this.world;
    // fastest legal arc: reduce speed first (a flat power ball must be struck high to clear the tape),
    // then shorten the depth; finally a lob.
    for (const sf of [1, 0.9, 0.8, 0.7, 0.6]) for (const f of [1, 0.85, 0.7]) {
      const z = os * Math.max(1.2, Math.abs(target.z) * f);
      const sol = w.solveSpeed(b.x, b.y, b.z, target.x, z, speed * sf, spin);
      if (sol && sol.clearance > minClear) return sol;
    }
    return w.solveOverNet(b.x, b.y, b.z, target.x, 0.12, target.z, { minClear: Math.max(0.2, minClear + 0.25), spin, ...lobOpts })
      || w.solveFlightTime(b.x, b.y, b.z, target.x, 0.12, target.z, 1.2);
  }

  /** Spin vector for a serve travelling toward sign `dir` on z (topspin: omega_x = sign(vz) * w). */
  spinFor(kind, dir) {
    const w = { kuda: 55, sila: -25, cara: 30, toe: -10 }[kind] ?? 0;
    const side = kind === 'cara' ? 26 : 0;
    return [dir * w, side, 0];
  }

  noise(player, q, scale = 1) {
    const sigma = (0.06 + 0.7 * (1 - q)) * (1.35 - player.rating * 0.7) * scale;
    return { x: this.rng.gauss() * sigma, z: this.rng.gauss() * sigma * 0.8 };
  }

  // ---------------- skill execution (rally) ----------------
  startSkill(player, plan, opts = {}) {
    const now = this.time;
    const tContact = opts.tContact ?? plan.t;
    const tc = Math.max(0.08, tContact - now);
    const busy = { kind: 'plan', plan, tContact, tStart: now, started: true, resolved: false, entry: plan.pick.entry, info: plan.pick, ts: 1, T: plan.T, skillKey: plan.skillKey, intent: plan.intent, isBlock: plan.skillKey.startsWith('block'), canReplan: false, aim: opts.aim, quality: opts.quality ?? 1 };
    const clipTc = plan.pick.tc;
    busy.ts = Math.min(2.2, Math.max(0.55, clipTc / tc));
    busy.dur = plan.pick.clip.duration / busy.ts;
    busy.tEnd = now + busy.dur;
    if (busy.ts === 0.55 || busy.ts === 2.2) busy.tContact = now + clipTc / busy.ts;
    player.busy = busy;
    if (plan === this.brains[player.team].plan) this.brains[player.team].plan.started = true;
    player.heading = plan.heading ?? player.heading;
    player.anim?.play(plan.pick.entry.id, { fadeIn: 0.08, contactAt: busy.tContact - now });
    this.emit('skill-start', { player, skill: plan.skillKey, entry: plan.pick.entry });
    return busy;
  }

  updateBusy(p, dt) {
    const b = p.busy;
    if (!b) return;
    // freeze locomotion (dives apply travel)
    const meta = b.info?.meta || {};
    if (meta.travel && b.started) {
      const tt = (this.time - b.tStart) * b.ts, tp = Math.max(0, tt - dt * b.ts);
      const w = (u) => { const k = Math.min(1, Math.max(0, (u - meta.travel.t0) / (meta.travel.t1 - meta.travel.t0))); return k * k * (3 - 2 * k); };
      const dk = w(tt) - w(tp);
      p.x += (leftX(p.heading) * meta.travel.dx + fwdX(p.heading) * meta.travel.dz) * dk;
      p.z += (leftZ(p.heading) * meta.travel.dx + fwdZ(p.heading) * meta.travel.dz) * dk;
      p.vx = p.vz = 0;
    } else p.stop(dt);
    // contact target for IK: the ball at contact time
    if (!b.resolved && p.anim) {
      const pt = this.ballAt(b.tContact - this.time);
      p.anim.setContactTarget({ x: pt.x, y: pt.y, z: pt.z }, 1);
    }
    // net fault during jumps
    if (meta.air && !b.isServe) {
      const tt = (this.time - b.tStart) * b.ts;
      if (tt > meta.air.t0 && tt < meta.air.t1 && Math.abs(p.z) < 0.26 && this.rally && !this.rally.result && this.state === 'rally') {
        const r = this.rally.netFault(p.team, 'Net touch by ' + (p.name || 'player'));
        this.endRally(r);
      }
    }
    if (!b.resolved && this.time >= b.tContact && !b.isServe && !b.isToss) this.resolveContact(p, b);
    const end = b.isToss ? b.tStart + 1.2 : b.isServe ? b.tStart + b.info.clip.duration + 0.1 : b.tEnd;
    if (this.time >= end && (b.resolved || this.time >= b.tContact + 0.2)) p.busy = null;
  }

  ballAt(t) {
    if (!this.pred || this.predAt < 0) { this.pred = this.world.predict(this.ball, 3.5); this.predAt = this.time; }
    if (t <= 0) return this.ball;
    const pts = this.pred.pts, tp = this.time - this.predAt;
    const tt = t + tp;
    let i = 0; while (i < pts.length - 1 && pts[i + 1].t < tt) i++;
    const a = pts[i], bb = pts[Math.min(i + 1, pts.length - 1)];
    const u = bb.t > a.t ? Math.min(1, Math.max(0, (tt - a.t) / (bb.t - a.t))) : 0;
    return { x: a.x + (bb.x - a.x) * u, y: a.y + (bb.y - a.y) * u, z: a.z + (bb.z - a.z) * u };
  }

  /** Resolve a ball contact for a rally skill. */
  resolveContact(p, b) {
    b.resolved = true;
    const ball = this.ball;
    if (!this.rally || this.rally.result || this.state !== 'rally') return;
    const T = b.T;
    const ideal = p.worldOf(T[0], T[2], T[1]);
    const d = Math.hypot(ball.x - ideal.x, ball.y - ideal.y, ball.z - ideal.z);
    const sk = SKILLS[b.skillKey];
    const R = sk.reach * (0.9 + 0.2 * p.stats.reach);
    if (d > R * 1.3) { this.emit('whiff', { player: p, skill: b.skillKey, dist: d }); return; }
    let q = Math.max(0.05, 1 - Math.pow(d / R, 1.35)) * (b.quality ?? 1);
    if (b.isBlock) return this.resolveBlockContact(p, b, q);
    const fault = this.rally.touch(p.team, p.id, false);
    p.lastTouchTime = this.time; this.rallyTouches++;
    this.applyIntent(p, b, q, fault);
    this.emit('touch', { player: p, kind: sk.cat, quality: q, speed: ball.speed || Math.hypot(ball.vx, ball.vy, ball.vz), team: p.team, skill: b.skillKey });
    if (fault) { this.endRally(fault); return; }
    this.onTouched(p, false);
  }

  onTouched(p) {
    this.lastHitTime = this.time;
    this.longestRally = Math.max(this.longestRally, this.rallyTouches);
    this.pred = null; this.predAt = -1; this.floorHandled = false;
    for (const br of this.brains) { br.plan = null; br.nextReplan = 0; br.blocks = []; }
    for (const q of this.all) if (q.busy && !q.busy.isBlock && q !== p && !q.busy.resolved) { /* keep started skills of others (blocks) */ }
  }

  /** Compute the ball's new velocity from the touch intent. */
  applyIntent(p, b, q, fault) {
    const w = this.world, ball = this.ball, intent = b.intent || { kind: 'over', target: this.brains[p.team].chooseAttackTarget(false), power: 0.3 };
    const t = p.team, side = this.rules.sideOf(t), os = -side;
    const noise = this.noise(p, q, intent.kind === 'attack' ? 1 : 0.8);
    const tg = intent.target || { x: 0, z: os * 3, y: 0.12 };
    const aim = b.aim;
    let vel = null, spin = [0, 0, 0];
    const same = (z) => z * side > 0;
    switch (intent.kind) {
      case 'control': case 'pass': case 'set': {
        const y = tg.y;
        const target = { x: clamp(tg.x + noise.x, -5, 5), z: clamp(tg.z + noise.z, side > 0 ? 0.6 : -8, side > 0 ? 8 : -0.6) };
        let T = intent.T ?? 1.2;
        let v = w.solveFlightTime(ball.x, ball.y, ball.z, target.x, y, target.z, T, null, 5);
        // ensure the set is descending at arrival for attackable sets
        if (intent.kind === 'set' && v.vy - 9.81 * T > -2.5) { T += 0.2; v = w.solveFlightTime(ball.x, ball.y, ball.z, target.x, y, target.z, T, null, 5); }
        vel = v; spin = [side * (-6), 0, 0];
        break;
      }
      case 'attack': {
        const target = { x: clamp((aim ? aim.x : tg.x) + noise.x, -3.6, 3.6), z: os * clamp(Math.abs(aim ? aim.z : tg.z) + noise.z, 0.4, 7.6) };
        const speed = (14.5 + 8.5 * (intent.power ?? 0.8)) * (0.92 + 0.08 * p.stats.power);
        spin = [os * 55, 0, 0];
        // low quality -> poor clearance (net risk)
        vel = this.solveHit(ball, target, os, speed, spin, 0.06 - 0.3 * (1 - q) * (1 - q));
        if (q > 0.5) vel = { ...vel, ...w.ensureClear(ball, vel, spin) };
        if (q < 0.4 && this.rng() < (0.4 - q) * 0.9) { vel = { ...vel, vy: vel.vy - 1.5 - this.rng() * 1.5 }; }   // sloppy contact: into the net / short
        this.stats[t].spikes++;
        break;
      }
      case 'over': default: {
        const target = { x: clamp(tg.x * 0.8 + noise.x, -3.3, 3.3), z: os * clamp(Math.abs(tg.z) * 0.8 + 0.6 + noise.z, 0.9, 7.2) };
        vel = w.solveOverNet(ball.x, ball.y, ball.z, target.x, 0.12, target.z, { minClear: 0.5 - 0.35 * (1 - q), Tmin: 0.7 }) || w.solveFlightTime(ball.x, ball.y, ball.z, target.x, 0.12, target.z, 1.4);
        spin = [side * -8, 0, 0];
        break;
      }
    }
    ball.vx = vel.vx; ball.vy = vel.vy; ball.vz = vel.vz; ball.wx = spin[0]; ball.wy = spin[1]; ball.wz = spin[2];
    if (intent.kind === 'attack') this.scheduleBlocks(p);
  }

  // ---------------- blocking ----------------
  scheduleBlocks(attacker) {
    const w = this.world;
    const pred = w.predict(this.ball, 1.5, 1 / 60);
    const cross = pred.netCross;
    if (!cross) return;
    const defTeam = 1 - attacker.team;
    for (const d of this.players[defTeam]) {
      if (!d.busy || !d.busy.isBlock || d.busy.resolved || d.busy.blockChecked) continue;
      d.busy.blockChecked = true;
      const tb = d.busy.tContact - this.time;
      const dt = cross.t - tb;
      if (Math.abs(dt) > 0.17) continue;
      if (Math.abs(cross.x - d.x) > 0.66 || cross.y > 2.65 || cross.y < w.netTop - 0.15) continue;
      const timing = 1 - Math.abs(dt) / 0.17, lateral = 1 - Math.abs(cross.x - d.x) / 0.66;
      const chance = (0.30 + 0.55 * d.stats.block * d.rating) * (0.55 + 0.45 * timing) * (0.6 + 0.4 * lateral);
      if (this.rng() < chance) this.pending.push({ time: this.time + cross.t, kind: 'block', player: d, attacker });
      else d.busy.resolved = true;
    }
  }
  resolveBlockContact(p, b, q) { /* AI block contact is driven from `pending` at the ball's crossing time */ }

  runPending() {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const pd = this.pending[i];
      if (this.time < pd.time) continue;
      this.pending.splice(i, 1);
      if (pd.kind === 'block' && this.rally && !this.rally.result && this.state === 'rally') this.blockTouch(pd.player);
    }
  }
  blockTouch(d) {
    const ball = this.ball, side = this.rules.sideOf(d.team);
    const fault = this.rally.touch(d.team, d.id, true);
    d.busy && (d.busy.resolved = true);
    d.lastTouchTime = this.time;
    const solid = this.rng() < 0.55 + 0.25 * d.stats.block * d.rating;
    const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
    if (solid) {      // stuff block: back down onto the attackers' side (they are on -side)
      ball.vx *= 0.35; ball.vz = -side * sp * 0.3; ball.vy = -(2.5 + this.rng() * 3.5);
    } else {          // soft touch: pops up and stays on the blockers' side (block is not a touch)
      ball.vx *= 0.3; ball.vz = side * (1.2 + this.rng()); ball.vy = 3.8 + this.rng() * 2;
    }
    ball.wx = ball.wy = ball.wz = 0;
    this.stats[d.team].blocks++;
    this.emit('touch', { player: d, kind: 'block', quality: 1, speed: sp, team: d.team, skill: 'block', block: true, solid });
    if (fault) { this.endRally(fault); return; }
    this.onTouched(d, true);
  }

  // ---------------- rally end / scoring ----------------
  endRally(res) {
    if (!res || this.state === 'point' || this.state === 'setbreak' || this.state === 'matchend') return;
    const winner = res.winner;
    this.lastResult = res;
    const setPointsBefore = [...this.rules.points];
    const out = this.rules.awardPoint(winner, res.reason);
    this.stats[winner].points++;
    if (/fault|Four|three times|Net touch/i.test(res.reason)) this.stats[1 - winner].faults++;
    if (this.serve && winner === this.serve.side && this.rallyTouches <= 1 && /landed/i.test(res.reason)) this.stats[winner].aces++;
    for (const p of this.all) { p.mood = p.team === winner ? 'win' : 'lose'; }
    this.pointInfo = { winner, reason: res.reason, out, score: [...this.rules.points], setPointsBefore };
    this.setState('point');
    this.emit('point', { winner, reason: res.reason, out, score: [...this.rules.points], sets: [...this.rules.sets], rally: this.rallyTouches });
  }

  afterPoint() {
    const o = this.pointInfo.out;
    if (o.matchOver) { this.setState('matchend'); this.emit('match-end', { winner: this.rules.matchWinner, sets: [...this.rules.sets], history: this.rules.setHistory }); return; }
    if (o.setOver) {
      this.emit('set-end', { winner: this.rules.setWinner, sets: [...this.rules.sets], points: [...this.rules.points] });
      this.setState('setbreak'); return;
    }
    if (o.changeSides) this.emit('change-sides', {});
    this.beginServePrep();
  }
  nextSet() {
    this.rules.nextSet(this.rng() < 0.5 ? 0 : 1);
    this.emit('side-change', {});
    this.beginServePrep();
  }

  // ---------------- physics ----------------
  stepBall(dt) {
    this.physAcc += dt;
    const ev = [];
    let n = 0;
    while (this.physAcc >= PHYS_DT && n < 40) {
      this.physAcc -= PHYS_DT; n++;
      if (this.ballHeld) { this.holdBall(); continue; }
      const pz = this.ball.z;
      ev.length = 0;
      this.world.step(this.ball, PHYS_DT, ev);
      if (this.rally && !this.rally.result && (pz > 0) !== (this.ball.z > 0) && this.state === 'rally') {
        const r = this.rally.ballCrossed(this.ball.x, this.ball.y, Math.sign(pz));
        if (r) this.endRally(r);
        this.pred = null;
      }
      for (const e of ev) this.onBallEvent(e);
    }
  }
  holdBall() {
    const h = this.ballHeld, p = h.player;
    let pos;
    const hand = p.anim && p.anim.worldPoint ? p.anim.worldPoint('hand_r', 0, -0.1, 0) : null;
    if (hand) pos = hand; else pos = p.worldOf(-0.14 * p.side * 0 + (p.side > 0 ? 0.2 : -0.2), 0.32, 1.02);
    this.ball.x = pos.x; this.ball.y = pos.y; this.ball.z = pos.z; this.ball.vx = this.ball.vy = this.ball.vz = 0;
  }
  onBallEvent(e) {
    if (e.type === 'net') this.emit('net', e);
    if (e.type === 'cord') this.emit('cord', e);
    if (e.type === 'post') { this.emit('post', e); if (this.rally && !this.rally.result && this.state === 'rally') this.endRally(this.rally.ballDead('Ball hit the net post')); }
    if (e.type === 'ceiling') { this.emit('ceiling', e); if (this.rally && !this.rally.result && (this.state === 'rally' || this.state === 'toss')) this.endRally(this.rally.ballDead('Ball hit the ceiling')); }
    if (e.type === 'under') { if (this.rally && !this.rally.result && this.state === 'rally') this.endRally(this.rally.ballDead('Ball passed under the net')); }
    if (e.type === 'floor') {
      this.emit('bounce', e);
      if (!this.floorHandled && (this.state === 'rally' || this.state === 'toss') && this.rally && !this.rally.result) {
        this.floorHandled = true;
        const r = this.rally.ballLanded(e.x, e.z, this.sideTeam);
        this.emit('landed', { x: e.x, z: e.z, result: r });
        this.endRally(r);
      }
    }
  }

  predictBall() {
    if (!this.pred || this.predAt < 0 || this.time - this.predAt > 0.05) { this.pred = this.world.predict(this.ball, 3.4); this.predAt = this.time; }
    return this.pred;
  }

  // ---------------- main update ----------------
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt; this.stateTime += dt;
    this.stepBall(dt);
    this.runPending();
    switch (this.state) {
      case 'serve-prep': this.updateServePrep(dt); break;
      case 'serve-ready': this.updateServeReady(dt); break;
      case 'toss': this.updateServe(dt); break;
      case 'rally': this.updateRally(dt); if (this.serve && !this.serve.contactDone) this.updateServe(dt); break;
      case 'point': if (this.stateTime > (this.pointInfo.out.setOver ? 4.2 : 3.0)) this.afterPoint(); break;
      case 'setbreak': if (this.stateTime > 5) this.nextSet(); break;
      default: break;
    }
    this.movePlayers(dt);
    for (const p of this.all) this.updateBusy(p, dt);
    if (this.state === 'rally' && this.ballDeadOnFloor()) { /* rally ends on first floor contact; nothing more here */ }
  }
  ballDeadOnFloor() { return false; }

  updateServePrep(dt) {
    let ok = true;
    for (let t = 0; t < 2; t++) for (const p of this.players[t]) if (Math.hypot(p.x - p.target.x, p.z - p.target.z) > 0.18 || p.speed > 0.5) ok = false;
    if ((ok && this.stateTime > 2.2) || this.stateTime > 6) { this.serveClock = 0; this.setState('serve-ready'); }
  }
  updateServeReady(dt) {
    this.serveClock = (this.serveClock || 0) + dt;
    const t = this.rules.serving;
    const humanServes = t === this.humanTeam;
    if (!humanServes) {
      if (this.serveClock > 1.0 + 1.2 * this.rng() * (1.6 - this.diff.aggr)) {
        const kinds = ['kuda', 'kuda', 'sila', 'cara', 'kuda'];
        this.startService(kinds[Math.floor(this.rng() * kinds.length)], null, false);
      }
    } else if (this.serveClock > 14) {
      this.startService('sila', null, false);        // service clock: auto-serve
    }
  }

  updateRally(dt) {
    const pred = this.predictBall();
    for (const b of this.brains) b.update(dt, pred);
    // start planned AI skills
    for (const br of this.brains) {
      const plan = br.plan;
      if (plan && !plan.started && !plan.player.busy) {
        const isH = plan.player.human && this.humanCtl;
        // AI plans start on time; human plans start when armed by a button press or, with assist, at the last moment
        if (this.time >= plan.tStart - 0.003 && (!isH || plan.armed || this.assist > 0.3)) {
          this.startSkill(plan.player, plan, { aim: plan.aim, quality: isH && !plan.armed ? 0.93 : 1 });
        }
      }
      // blockers
      for (const bl of br.blocks) {
        if (bl.started || bl.player.busy) continue;
        const skill = this.blockSkillFor(bl.player);
        const pick = pickClip(skill, { y: 2.05, x: 0 }, { side: 'R' });
        if (!pick) continue;
        const tStart = bl.tContact + 0.09 - pick.tc;
        if (this.time >= tStart - 0.02 && bl.tContact > this.time - 0.1 && (!bl.player.human || bl.armed || this.assist > 0.3)) {
          const plan = { player: bl.player, pick, T: pick.T, skillKey: skill, t: this.time + pick.tc, tStart: this.time, heading: bl.player.side > 0 ? Math.PI : 0, intent: { kind: 'block' }, stand: { x: bl.x, z: bl.player.z } };
          bl.started = true;
          this.startSkill(bl.player, plan, { tContact: this.time + pick.tc, quality: bl.player.human && !bl.armed ? 0.85 : 1 });
        }
      }
    }
  }
  blockSkillFor(p) { return p.role === ROLES.KILLER ? 'block.foot' : this.rng() < 0.5 ? 'block.foot' : 'block.double'; }

  // ---------------- player movement ----------------
  movePlayers(dt) {
    const ball = this.ball;
    for (let t = 0; t < 2; t++) {
      const brain = this.brains[t];
      for (const p of this.players[t]) {
        if (p.busy) { p.integrate(dt); this.faceBusy(p, dt); continue; }
        if (p.human && this.humanCtl && this.humanCtl.move(p, dt)) { p.integrate(dt); p.confine(0.34); continue; }
        const inRally = this.state === 'rally';
        let tgt = inRally && brain.targets ? brain.targets[p.index] : p.target;
        if (this.state === 'point' || this.state === 'setbreak' || this.state === 'matchend') tgt = null;
        if (tgt) {
          const urgent = tgt.plan || tgt.block;
          p.steerTo(tgt.x, tgt.z, dt, urgent ? p.stats.speed : p.stats.speed * 0.72);
        } else p.stop(dt);
        p.integrate(dt);
        p.confine(0.5);
        // facing: toward the ball when it is on our side, else the net
        const s = p.side;
        if (inRally && ball.z * s > 0 && Math.hypot(ball.x - p.x, ball.z - p.z) < 6) p.faceToward(ball.x, ball.z, dt, 5);
        else p.faceTo(s > 0 ? Math.PI : 0, dt, 6);
      }
    }
    // gentle separation so players never overlap
    for (let a = 0; a < this.all.length; a++) for (let b = a + 1; b < this.all.length; b++) {
      const A = this.all[a], B = this.all[b];
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-4 && !(A.busy && B.busy)) { const push = (0.55 - d) * 0.5; const nx = dx / d, nz = dz / d; if (!A.busy) { A.x -= nx * push; A.z -= nz * push; } if (!B.busy) { B.x += nx * push; B.z += nz * push; } }
    }
  }
  faceBusy(p, dt) { /* heading is fixed at skill start */ }
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let _tossCache = null;
function getCatalogToss() {
  if (_tossCache) return _tossCache;
  _tossCache = allTossEntries();
  return _tossCache;
}
function allTossEntries() { return allEntries().filter((e) => e.id.startsWith('toss.')); }
