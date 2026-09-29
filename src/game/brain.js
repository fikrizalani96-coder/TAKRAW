// Team brain: decides who plays the ball next, with which skill, from where and when
// (interception search over the predicted ball flight), where the ball should go (intent), and
// where everyone else positions themselves (support, cover, block).
import { COURT, ROLES } from './config.js';
import { SKILLS, pickClip } from './skilllib.js';
import { fwdX, fwdZ, leftX, leftZ, wrapPi } from './player.js';

const RECEIVE = ['dig.foot', 'dig.chest', 'dig.thigh', 'dig.knee', 'dig.head', 'dig.shoulder', 'dig.back', 'dig.slide', 'dig.split', 'dig.dive'];
const SETS = ['set.foot', 'set.chest', 'set.head', 'dig.foot', 'dig.chest', 'dig.thigh', 'dig.head', 'dig.slide'];
const ATTACK_AIR = ['spike.kuda', 'spike.gulung', 'spike.gunting', 'spike.sila', 'spike.cara', 'spike.kilas', 'spike.roda', 'spike.tumit'];
const ATTACK = [...ATTACK_AIR, 'atk.head', 'atk.kick', 'dig.foot', 'dig.chest', 'dig.head', 'dig.thigh', 'dig.knee', 'dig.slide'];
const SKILL_BIAS = {
  'dig.foot': 0, 'dig.chest': 0.05, 'dig.thigh': 0.12, 'dig.knee': 0.14, 'dig.head': 0.12, 'dig.shoulder': 0.3, 'dig.back': 0.35, 'dig.slide': 0.38, 'dig.split': 0.42, 'dig.dive': 0.45,
  'set.foot': 0, 'set.chest': 0.06, 'set.head': 0.08,
  'atk.head': 0.14, 'atk.kick': 0.1,
};
const SPIKE_W = { 'spike.kuda': 1.0, 'spike.gulung': 0.42, 'spike.gunting': 0.45, 'spike.sila': 0.3, 'spike.cara': 0.3, 'spike.kilas': 0.14, 'spike.roda': 0.14, 'spike.tumit': 0.12 };
const ROLE_BIAS = {
  1: { [ROLES.TEKONG]: 0, [ROLES.TOSSER]: 0.10, [ROLES.KILLER]: 0.28 },
  2: { [ROLES.TOSSER]: 0, [ROLES.TEKONG]: 0.22, [ROLES.KILLER]: 0.34 },
  3: { [ROLES.KILLER]: 0, [ROLES.TOSSER]: 0.3, [ROLES.TEKONG]: 0.42 },
};
const COMFORT = {
  'dig.foot': [0.35, 0.85], 'dig.chest': [1.12, 1.4], 'dig.thigh': [0.65, 0.95], 'dig.knee': [0.55, 0.95], 'dig.head': [1.7, 2.1], 'set.foot': [0.6, 1.05], 'set.chest': [1.1, 1.4], 'set.head': [1.7, 2.1],
  'atk.kick': [0.8, 1.2], 'atk.head': [1.7, 2.1],
};
for (const k of ATTACK_AIR) COMFORT[k] = [2.35, 2.75];

/** Time to cover d metres from the current velocity with the player's acceleration and top speed. */
function travelTime(player, d, vmax) {
  if (d <= 0.02) return 0;
  const a = player.stats.accel * 0.9;
  const v0 = Math.min(vmax, player.speed * 0.6);
  const dAcc = (vmax * vmax - v0 * v0) / (2 * a);
  if (d <= dAcc) return (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a;
  return (vmax - v0) / a + (d - dAcc) / vmax;
}

const memo = new Map();
function pickCached(skillKey, y, side, extra) {
  const key = skillKey + '|' + Math.round(y * 25) + '|' + (side || '') + '|' + (extra || '');
  let r = memo.get(key);
  if (!r) { r = pickClip(skillKey, { y, x: 0, z: SKILLS[skillKey].z }, { side }); memo.set(key, r || false); }
  return r || null;
}

export class TeamBrain {
  constructor(match, team) {
    this.m = match; this.team = team;
    this.plan = null; this.blocks = []; this.nextReplan = 0; this.setPlanFor = -1;
    this.supportIdx = 0;
  }
  get players() { return this.m.players[this.team]; }
  get side() { return this.m.rules.sideOf(this.team); }
  get opp() { return this.m.brains[1 - this.team]; }

  reset() { this.plan = null; this.blocks = []; this.nextReplan = 0; }

  // ---------------- formations ----------------
  formation(kind) {
    const s = this.side;
    switch (kind) {
      case 'serve': return [{ x: 0, z: s * (COURT.halfL - COURT.serviceFromBack) }, { x: -s * 2.68, z: s * 0.62 }, { x: s * 2.68, z: s * 0.62 }];
      case 'receive': return [{ x: 0.3 * s, z: s * 4.6 }, { x: -s * 1.7, z: s * 1.5 }, { x: s * 2.0, z: s * 1.25 }];
      default: return [{ x: 0, z: s * 4.3 }, { x: -s * 1.6, z: s * 1.5 }, { x: s * 1.9, z: s * 1.25 }];
    }
  }

  // ---------------- interception search ----------------
  /** Best intercept for `player` using `skillKey` on the predicted flight. */
  findIntercept(player, skillKey, pred, o = {}) {
    const sk = SKILLS[skillKey];
    const m = this.m, now = m.time, s = this.side;
    // reaction is spent once, from the moment the ball was last struck (not on every replan)
    const react = Math.max(0, player.stats.react * (1.9 - player.rating * 0.9) * (o.reactScale ?? 1) - (now - (m.lastHitTime ?? -9)));
    const vmax = player.stats.speed * (0.75 + 0.25 * player.rating) * (o.speedScale ?? 0.92);
    let best = null;
    const comfort = COMFORT[skillKey];
    const hMin = sk.hMin, hMax = sk.hMax;
    for (const pt of pred.pts) {
      if (pt.t < 0.06) continue;
      if (pt.y < hMin || pt.y > hMax) continue;
      if (pt.z * s < 0.32) continue;
      if (Math.abs(pt.x) > COURT.halfW + 3.4 || Math.abs(pt.z) > COURT.halfL + 3.4) continue;
      const heading = o.heading ?? (s > 0 ? Math.PI : 0);
      const pick = pickCached(skillKey, pt.y, o.side, sk.air ? '' : '');
      if (!pick) continue;
      const T = pick.T;
      const sx = pt.x - leftX(heading) * T[0] - fwdX(heading) * T[2];
      let sz = pt.z - leftZ(heading) * T[0] - fwdZ(heading) * T[2];
      if (sz * s < 0.5) { if (sz * s < 0.28) continue; sz = 0.5 * s; }
      const slack = sk.air ? 0.18 : sk.ground ? 0.3 : 0.38;           // IK can stretch to the ball; quality just drops
      const dist = Math.max(0, Math.hypot(sx - player.x, sz - player.z) - slack);
      for (const ts of (sk.air ? [1] : [1, 1.3, 1.65])) {
        const tcEff = pick.tc / ts;
        const tStart = now + pt.t - tcEff;
        const travel = react + travelTime(player, dist, vmax);
        if (tStart < now + travel - 1e-3) continue;
        // cost: earlier is safer, but keep ball in the comfortable window
        let cost = pt.t * 0.45 + (ts - 1) * 0.35;
        if (comfort) { const c = pt.y < comfort[0] ? comfort[0] - pt.y : pt.y > comfort[1] ? pt.y - comfort[1] : 0; cost += c * 1.2; }
        cost += SKILL_BIAS[skillKey] || 0;
        if (!best || cost < best.cost) best = { cost, t: now + pt.t, tStart, pt, pick, skillKey, ts, stand: { x: sx, z: sz }, heading, T };
        break;
      }
      if (best && pt.t > best.pt.t + 0.7) break;
    }
    return best;
  }

  /** Which team must play the ball next, and what touch index is it? */
  nextTouch() {
    const r = this.m.rally;
    if (!r || r.result) return null;
    const idx = r.possession === this.team ? r.count + 1 : 1;
    return idx <= 3 ? idx : null;
  }

  ballComesToUs(pred) {
    const s = this.side, b = this.m.ball;
    if (b.z * s > 0.05) {
      // on our side now: ours only if it will not cross to the opponent (or comes back)
      return !pred.netCross || !!(pred.landing && pred.landing.z * s > 0);
    }
    return !!(pred.netCross && ((pred.landing && pred.landing.z * s > 0) || pred.pts.some((p) => p.z * s > 0.4)));
  }

  // ---------------- planning ----------------
  replan(pred) {
    const m = this.m, r = m.rally;
    if (!r || r.result || m.state !== 'rally') { this.plan = null; return; }
    if (!this.ballComesToUs(pred)) { this.plan = null; this.updateDefense(pred); return; }
    const idx = this.nextTouch();
    if (!idx) { this.plan = null; return; }
    // Don't churn a plan that is already executing or about to start
    if (this.plan && (this.plan.started || this.plan.armed || this.plan.tStart - m.time < 0.16)) return;
    const cands = this.players.filter((p) => !(r.lastPlayer === p.id && r.possession === this.team && r.lastPlayerRun >= 2 && !p.busy));
    const skills = idx === 1 ? RECEIVE : idx === 2 ? SETS : ATTACK;
    let best = null;
    for (const p of cands) {
      if (p.busy && !p.busy.canReplan) continue;
      const sideKeep = null;
      const heading = this.desiredHeading(p, idx);
      for (const sk of skills) {
        const skd = SKILLS[sk];
        if (skd.air && !this.canAttack(p, idx)) continue;
        const f = this.findIntercept(p, sk, pred, { heading });
        if (!f) continue;
        let cost = f.cost + (ROLE_BIAS[idx][p.role] ?? 0.3);
        if (skd.air) cost -= 0.55 * p.stats.jump;                 // spikes are the preferred finish
        if (skd.air) cost += 0.12 * (1 - (SPIKE_W[sk] ?? 0.3)) + this.m.rng() * 0.18;
        if (skd.ground) cost += 0.25;
        if (this.plan && this.plan.player === p && this.plan.skillKey === sk) cost -= 0.12;   // hysteresis
        if (!best || cost < best.cost) best = { ...f, cost, player: p };
      }
    }
    if (!best) { this.plan = null; return; }
    best.idx = idx;
    best.intent = this.makeIntent(idx, best);
    best.started = false; best.human = best.player.human;
    this.plan = best;
  }

  canAttack(p, idx) {
    if (idx !== 3) return false;
    return true;
  }
  desiredHeading(p, idx) {
    const s = this.side;
    const net = s > 0 ? Math.PI : 0;
    if (idx === 1) {
      // face the setting spot; the ball comes from the front so this is roughly the net
      const tgt = this.setterSpot(p);
      return Math.atan2(tgt.x - p.x, tgt.z - p.z) * 0.6 + net * 0.4 + (Math.abs(wrapPi(Math.atan2(tgt.x - p.x, tgt.z - p.z) - net)) > 2 ? 0 : 0);
    }
    return net;
  }

  setterSpot(exclude) {
    const s = this.side;
    return { x: -s * 1.45, z: s * 1.6 };
  }
  attackSpot(role) {
    const s = this.side;
    return role === ROLES.TOSSER ? { x: -s * 1.0, z: s * 1.0 } : { x: s * 2.0, z: s * 1.05 };
  }

  /** Intent describes where the ball should go after this touch. */
  makeIntent(idx, plan) {
    const s = this.side, p = plan.player, m = this.m;
    if (plan.skillKey.startsWith('block')) return { kind: 'block' };
    if (idx === 1) {
      const tosser = this.players.find((q) => q.role === ROLES.TOSSER);
      if (p === tosser) return { kind: 'control', target: { x: p.x + fwdX(plan.heading) * 0.3, z: p.z + fwdZ(plan.heading) * 0.3, y: 1.35 }, T: 0.95 };
      const spot = this.setterSpot(p);
      return { kind: 'pass', target: { x: spot.x, z: spot.z, y: 1.25 }, T: 1.05 + 0.04 * Math.hypot(spot.x - p.x, spot.z - p.z) };
    }
    if (idx === 2) {
      const killer = this.players.find((q) => q.role === ROLES.KILLER && q !== p);
      const alt = this.players.find((q) => q !== p && q.role === ROLES.TOSSER);
      const att = killer || alt || this.players.find((q) => q !== p);
      const spot = this.attackSpot(att.role);
      const quick = this.m.rng() < 0.28;
      return { kind: 'set', attacker: att.id, target: { x: spot.x, z: spot.z, y: quick ? 2.55 : 2.75 }, T: quick ? 1.0 : 1.35 };
    }
    // idx 3: attack or free ball
    const spike = plan.skillKey.startsWith('spike') || plan.skillKey === 'atk.head' || plan.skillKey === 'atk.kick';
    const tgt = this.chooseAttackTarget(spike);
    return { kind: spike ? 'attack' : 'over', target: tgt, power: spike ? 0.75 + 0.25 * p.stats.power : 0.3 };
  }

  chooseAttackTarget(hard) {
    const m = this.m, oppT = 1 - this.team, os = m.rules.sideOf(oppT);
    const defenders = m.players[oppT];
    let best = [], bestS = -1;
    const cands = [];
    for (const x of [-2.6, -1.7, -0.8, 0.0, 0.8, 1.7, 2.6]) for (const d of [1.6, 3.0, 4.4, 5.8]) {
      const z = os * d;
      let s = 9;
      for (const q of defenders) {
        // anticipated defensive positions (front players near net, tekong deep)
        const dd = Math.hypot(q.x - x, q.z - z) - (q.role === ROLES.TEKONG ? 0.0 : 0.25);
        s = Math.min(s, dd);
      }
      s += (hard ? 0.15 : 0.0) * d + (Math.abs(x) > 2.3 ? 0.15 : 0);
      s += this.m.rng() * 0.9;
      cands.push({ x, z, s });
    }
    cands.sort((a, b) => b.s - a.s);
    const c = cands[Math.floor(this.m.rng() * Math.min(3, cands.length))];
    return { x: c.x, z: c.z, y: 0.12 };
  }

  // ---------------- defense (blocking + cover) ----------------
  updateDefense(pred) {
    this.blocks = [];
    const opp = this.opp, pl = opp.plan;
    if (!pl || !pl.skillKey.startsWith('spike')) return;
    // spike coming: front players set up a block opposite the attacker
    const m = this.m, s = this.side;
    const att = pl.player;
    const tContact = pl.t;
    if (tContact - m.time < 0.5) { /* too late to start a block plan; already-started ones persist */ }
    const fronts = this.players.filter((q) => q.role !== ROLES.TEKONG).sort((a, b) => Math.abs(a.x - att.x) - Math.abs(b.x - att.x));
    const nBlock = Math.abs(att.x) < 1.2 ? 2 : 1;
    for (let i = 0; i < Math.min(nBlock, fronts.length); i++) {
      const q = fronts[i];
      if (q.busy && !q.busy.isBlock) continue;
      const off = i === 0 ? (nBlock === 2 ? -0.35 : 0) : 0.75;
      this.blocks.push({ player: q, x: Math.max(-2.7, Math.min(2.7, att.x + off * Math.sign(att.x || 1) * -1)), tContact, started: !!(q.busy && q.busy.isBlock) });
    }
  }

  // ---------------- per-frame positioning ----------------
  update(dt, pred) {
    const m = this.m;
    const s = this.side;
    if (m.state !== 'rally') return;
    // periodic replan
    if (m.time >= this.nextReplan) { this.replan(pred); this.nextReplan = m.time + 0.08; }
    const idx = this.nextTouch();
    const targets = [null, null, null];
    const b = m.ball;
    const base = this.formation(m.rally && m.rally.crossed === false ? 'receive' : 'base');
    for (let i = 0; i < 3; i++) targets[i] = { ...base[i] };
    // tekong shades toward the ball's likely landing area
    if (pred.landing && pred.landing.z * s > 0) { targets[0].x = Math.max(-2.2, Math.min(2.2, pred.landing.x * 0.35)); }
    const plan = this.plan;
    const ballOurs = this.ballComesToUs(pred);
    // support roles
    const tosser = this.players.find((q) => q.role === ROLES.TOSSER), killer = this.players.find((q) => q.role === ROLES.KILLER), tekong = this.players.find((q) => q.role === ROLES.TEKONG);
    if (ballOurs && plan) {
      if (plan.idx === 1) {
        const sp = this.setterSpot();
        if (plan.player !== tosser) targets[tosser.index] = { x: sp.x, z: sp.z };
        if (plan.player !== killer) targets[killer.index] = { x: s * 2.05, z: s * 1.55 };
      } else if (plan.idx === 2) {
        const at = this.plan.intent.attacker;
        const a = this.players.find((q) => q.id === at);
        const sp = this.attackSpot(a.role);
        if (a !== plan.player) targets[a.index] = { x: sp.x + (a.role === ROLES.KILLER ? s * 0.15 : 0), z: sp.z + s * 0.75 };   // approach start
        const other = this.players.find((q) => q !== plan.player && q !== a);
        if (other) targets[other.index] = other.role === ROLES.TEKONG ? { x: 0, z: s * 4.3 } : { x: -s * 0.8, z: s * 2.4 };
      } else if (plan.idx === 3) {
        for (const q of this.players) if (q !== plan.player) targets[q.index] = q.role === ROLES.TEKONG ? { x: 0, z: s * 4.3 } : { x: q.role === ROLES.TOSSER ? -s * 1.2 : s * 1.8, z: s * 2.2 };
      }
      if (plan.player) targets[plan.player.index] = { x: plan.stand.x, z: plan.stand.z, plan: true };
    } else if (!ballOurs) {
      // opponent has the ball: base defence, blockers at the net when a spike is coming
      for (const bl of this.blocks) targets[bl.player.index] = { x: bl.x, z: s * 0.62, block: true };
    }
    this.targets = targets;
  }
}
