// Human control layer. The game always hands control to the player who must play the ball next
// (tekong serves/receives, tosser lifts, killer spikes) - the human moves that player, aims, and
// chooses the technique/timing with four action buttons. Teammates and opponents are AI.
import { ROLES, COURT } from './config.js';
import { pickClip } from './skilllib.js';

const BUTTON_SKILLS = {
  1: { A: ['dig.foot', 'dig.thigh', 'dig.knee'], B: ['dig.chest', 'dig.shoulder', 'dig.back'], C: ['dig.head'], D: ['dig.slide', 'dig.split', 'dig.dive'] },
  2: { A: ['set.foot', 'dig.foot'], B: ['set.chest', 'dig.chest'], C: ['set.head', 'dig.head'], D: ['dig.slide', 'dig.split', 'dig.dive'] },
  3: { A: ['atk.kick', 'dig.foot', 'dig.thigh'], B: ['dig.chest', 'atk.head', 'dig.thigh', 'dig.knee'], C: ['SPIKE'], D: ['dig.slide', 'dig.split', 'dig.dive'] },
};
const LABELS = {
  serve: { A: 'SILA', B: 'KUDA', C: 'CARA', D: '' },
  kick: { A: 'KICK!', B: 'KICK!', C: 'KICK!', D: '' },
  1: { A: 'SEPAK', B: 'BADAN', C: 'KEPALA', D: 'SELAMAT' },
  2: { A: 'LIFT', B: 'DADA', C: 'KEPALA', D: 'SELAMAT' },
  3: { A: 'TAP', B: 'BADAN', C: 'LIBAS!', D: 'SELAMAT' },
  defend: { A: 'SEPAK', B: 'BADAN', C: 'BLOK', D: 'SELAMAT' },
  idle: { A: 'SEPAK', B: 'BADAN', C: 'LIBAS', D: 'SELAMAT' },
};

export class HumanCtl {
  constructor(match, team) {
    this.m = match; this.team = team;
    this.active = null; this.lastActive = null;
    this.input = { mx: 0, my: 0, sx: 0, sy: 0, btn: { A: false, B: false, C: false, D: false } };
    this.pressed = { A: false, B: false, C: false, D: false, switch: false };
    this.aim = { x: 0, z: 0 }; this.aimTouched = false;
    this.context = 'idle';
    this.switchCool = 0;
    this.lastPressTime = -9;
    match.humanCtl = this;
  }
  get side() { return this.m.rules.sideOf(this.team); }
  get brain() { return this.m.brains[this.team]; }
  get players() { return this.m.players[this.team]; }

  /** Called every frame by the view with the raw input state. */
  setInput(mx, my, pressed, held) {
    this.input.mx = mx; this.input.my = my;
    for (const k of ['A', 'B', 'C', 'D', 'switch']) this.pressed[k] = !!pressed[k];
    for (const k of ['A', 'B', 'C', 'D']) this.input.btn[k] = !!held[k];
  }
  /** World-space movement vector for the stick (camera sits behind the human team). */
  worldMove() { const s = this.side; return { x: s * this.input.mx, z: -s * this.input.my }; }

  setActive(p) {
    for (const q of this.players) q.human = q === p;
    if (p !== this.active) { this.lastActive = this.active; this.active = p; }
  }

  update(dt) {
    const m = this.m, s = this.side;
    this.switchCool -= dt;
    // choose the active player
    let a = this.active;
    const serving = m.rules.serving === this.team;
    if (m.state === 'serve-prep' || m.state === 'serve-ready' || m.state === 'toss') {
      a = serving ? this.players[0] : (this.players.find((p) => p.role === ROLES.TEKONG));
    } else if (m.state === 'rally') {
      const br = this.brain, pl = br.plan;
      if (pl && pl.started === false) a = pl.player;
      else if (pl && !pl.started) a = pl.player;
      else if (!a) a = this.players[0];
      // opponent attack coming: control the front player closest to the attacker for blocking
      const opp = m.brains[1 - this.team].plan;
      if ((!pl) && opp && opp.skillKey.startsWith('spike')) {
        const front = this.players.filter((p) => p.role !== ROLES.TEKONG).sort((p, q) => Math.abs(p.x - opp.player.x) - Math.abs(q.x - opp.player.x))[0];
        if (front) a = front;
      }
      if (a && a.busy && !a.busy.resolved && !a.busy.isBlock) { /* keep controlling the player mid-skill */ }
    } else if (!a) a = this.players[0];
    // manual switch: cycle to the next player closest to the ball
    if (this.pressed.switch && this.switchCool <= 0) {
      const b = m.ball, list = [...this.players].sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
      const i = list.indexOf(a); a = list[(i + 1) % list.length]; this.switchCool = 0.25;
    }
    this.setActive(a);
    this.updateContext();
    this.updateAim(dt);
    // buttons
    for (const k of ['A', 'B', 'C', 'D']) if (this.pressed[k]) this.press(k);
  }

  updateContext() {
    const m = this.m;
    if (m.state === 'serve-ready' && m.rules.serving === this.team) this.context = 'serve';
    else if (m.state === 'toss' && m.rules.serving === this.team) this.context = 'kick';
    else if (m.state === 'rally') {
      const pred = m.predictBall(), br = this.brain;
      const idx = br.nextTouch();
      if (idx && br.ballComesToUs(pred)) this.context = String(idx);
      else this.context = 'defend';
    } else this.context = 'idle';
  }
  get labels() { return LABELS[this.context] || LABELS.idle; }

  updateAim(dt) {
    const m = this.m, s = this.side, os = -s;
    const w = this.worldMove();
    if (m.state === 'point' || m.state === 'serve-prep') this.aimTouched = false;
    if (Math.abs(this.aim.z) < 0.5) this.aim.z = os * 3.8;
    if (Math.sign(this.aim.z) !== os) this.aim.z = -this.aim.z;          // keep on the opponent half after side changes
    if (Math.hypot(this.input.mx, this.input.my) > 0.25 && (this.context === 'serve' || this.context === '3' || this.context === 'kick')) {
      this.aimTouched = true;
      this.aim.x = Math.max(-2.95, Math.min(2.95, this.aim.x + w.x * 3.2 * dt));
      const depth = Math.max(1.2, Math.min(6.3, Math.abs(this.aim.z) + (w.z * os) * 3.4 * dt));   // stick up = deeper into their court
      this.aim.z = os * depth;
    }
  }

  /** Movement override for the active human player. Returns true when the stick drives the player. */
  move(p, dt) {
    if (p !== this.active) return false;
    const mag = Math.hypot(this.input.mx, this.input.my);
    if (mag < 0.12) return false;
    if (this.m.state === 'serve-ready' || this.m.state === 'toss') return true;   // tekong stays in the circle
    const w = this.worldMove();
    const v = p.stats.speed * (0.75 + 0.25 * p.rating) * Math.min(1, mag) * 1.05;
    let vx = w.x / (Math.hypot(w.x, w.z) || 1) * v, vz = w.z / (Math.hypot(w.x, w.z) || 1) * v;
    // assist: as the planned contact approaches, the AI's arrival controller takes over from the stick
    // (magnet within ~2 m of the suggested stand spot, stronger the closer it is to the moment of contact)
    const plan = this.brain.plan;
    if (plan && plan.player === p && plan.stand && this.m.assist > 0.05) {
      const dx = plan.stand.x - p.x, dz = plan.stand.z - p.z, d = Math.hypot(dx, dz);
      if (d < 2.2) {
        const tl = plan.tStart - this.m.time;
        const urgency = tl <= 0 ? 1 : Math.max(0, 1 - tl / 0.55);
        const k = Math.min(1, this.m.assist * (0.28 * (1 - d / 2.2) + 0.72 * urgency * urgency));
        const want = Math.min(v, d * 7);
        const ax = d > 1e-6 ? dx / d * want : 0, az = d > 1e-6 ? dz / d * want : 0;
        vx += (ax - vx) * k; vz += (az - vz) * k;
      }
    }
    p.steerVel(vx, vz, dt);
    const b = this.m.ball, s = this.side;
    if (b.z * s > 0 && Math.hypot(b.x - p.x, b.z - p.z) < 6) p.faceToward(b.x, b.z, dt, 5); else p.faceTo(s > 0 ? Math.PI : 0, dt, 6);
    return true;
  }

  // ---------------- button handling ----------------
  press(btn) {
    const m = this.m, p = this.active;
    this.lastPressTime = m.time;
    if (!p) return;
    if (m.state === 'serve-ready' && m.rules.serving === this.team) {
      const kind = { A: 'sila', B: 'kuda', C: 'cara', D: 'toe' }[btn];
      m.startService(kind, this.aimTouched ? { ...this.aim } : null, true);
      return;
    }
    if (m.state === 'toss' && m.rules.serving === this.team) { m.humanServePress(); return; }
    if (m.state !== 'rally') return;
    const br = this.brain, pred = m.predictBall();
    const idx = br.nextTouch();
    const ours = br.ballComesToUs(pred);
    if (btn === 'C' && (!ours || !idx) && p.role !== ROLES.TEKONG) { this.tryBlock(p); return; }
    if (!ours || !idx) return;
    if (br.plan && br.plan.started) return;
    if (p.busy) return;
    const list = BUTTON_SKILLS[idx][btn] || [];
    let best = null;
    const stick = { x: this.worldMove().x, z: this.worldMove().z };
    const skills = list.flatMap((sk) => (sk === 'SPIKE' ? this.spikeOrder(stick) : [sk]));
    for (const sk of skills) {
      const heading = br.desiredHeading(p, idx);
      const f = br.findIntercept(p, sk, pred, { heading, speedScale: 0.9, reactScale: 0 });
      if (f && (!best || f.cost < best.cost || (btn === 'C' && idx === 3 && sk.startsWith('spike') && !best.skillKey.startsWith('spike')))) { best = f; if (btn === 'C' && idx === 3) break; }
    }
    if (!best) {
      // try any dive/slide for a desperate save when D was pressed, else attempt the first skill at the closest approach
      const sk = skills[0];
      const f = br.findIntercept(p, sk, pred, { heading: br.desiredHeading(p, idx), speedScale: 1.0, reactScale: 0 });
      if (!f) { m.emit('reach-fail', { player: p }); return; }
      best = f;
    }
    const plan = { ...best, idx, player: p, armed: true, human: true, started: false };
    plan.intent = br.makeIntent(idx, plan);
    plan.aim = this.applyAim(plan, idx, stick);
    br.plan = plan;
  }
  spikeOrder(st) {
    const mag = Math.hypot(st.x, st.z), s = this.side;
    if (mag > 0.4) {
      const back = st.z * s > 0.5;                   // stick pulled toward own baseline
      const side = Math.abs(st.x) > Math.abs(st.z);
      if (back) return ['spike.gulung', 'spike.tumit', 'spike.kuda'];
      if (side) return ['spike.gunting', 'spike.kilas', 'spike.roda', 'spike.kuda'];
      return ['spike.kuda', 'spike.sila', 'spike.cara'];
    }
    return ['spike.kuda', 'spike.sila', 'spike.cara', 'spike.gunting', 'spike.gulung', 'spike.kilas'];
  }
  applyAim(plan, idx, stick) {
    const s = this.side, os = -s, I = plan.intent, mag = Math.hypot(this.input.mx, this.input.my);
    if (idx === 3 && (I.kind === 'attack' || I.kind === 'over')) {
      return this.aimTouched ? { x: Math.max(-2.9, Math.min(2.9, this.aim.x)), z: this.aim.z } : null;
    }
    if (idx === 2 && I.kind === 'set') {
      if (mag > 0.4) {
        const towardNet = stick.z * s < -0.4, awayNet = stick.z * s > 0.4;
        if (towardNet) { I.T = 0.95; I.target.y = 2.5; }         // quick set
        else if (awayNet) { I.T = 1.6; I.target.y = 2.9; }         // high set
        I.target.x = Math.max(-2.9, Math.min(2.9, I.target.x + stick.x * 0.9));
      }
    } else if (idx === 1 && I.target) {
      if (mag > 0.4) { I.target.x = Math.max(-2.9, Math.min(2.9, I.target.x + stick.x * 1.1)); }
    }
    return null;
  }
  tryBlock(p) {
    const m = this.m;
    if (p.busy) return;
    // a block is already scheduled for this player: the press commits it (perfect timing, full quality)
    const sched = this.brain.blocks.find((b) => b.player === p && !b.started);
    if (sched) { sched.armed = true; return; }
    const skill = p.role === ROLES.KILLER ? 'block.foot' : 'block.double';
    const pick = pickClip(skill, { y: 2.05, x: 0 }, { side: 'R' });
    if (!pick) return;
    const plan = { player: p, pick, T: pick.T, skillKey: skill, t: m.time + pick.tc, tStart: m.time, heading: p.side > 0 ? Math.PI : 0, intent: { kind: 'block' }, stand: { x: p.x, z: p.z } };
    m.startSkill(p, plan, { tContact: m.time + pick.tc });
  }
  /** For 3D markers. */
  get suggestion() { const pl = this.brain.plan; return pl && pl.player === this.active ? pl : null; }
}
