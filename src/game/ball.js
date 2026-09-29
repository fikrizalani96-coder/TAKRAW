// Ball physics: gravity, quadratic drag, Magnus force from spin, floor bounce with friction/spin
// coupling, net mesh + net-cord + post + ceiling collisions. Pure JS (no three.js) so the same
// integrator drives the game, AI trajectory prediction and headless tests.
import { COURT, BALL_SPEC, G, PHYS_DT } from './config.js';

export class BallState {
  constructor() { this.x = 0; this.y = 1; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.wx = 0; this.wy = 0; this.wz = 0; }
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; this.vx = o.vx; this.vy = o.vy; this.vz = o.vz; this.wx = o.wx; this.wy = o.wy; this.wz = o.wz; return this; }
  clone() { return new BallState().copy(this); }
  get speed() { return Math.hypot(this.vx, this.vy, this.vz); }
}

export class World {
  /** cfg: {gender, surface(SURFACES entry), ceiling} */
  constructor(cfg = {}) {
    this.gender = cfg.gender || 'men';
    this.spec = BALL_SPEC[this.gender];
    this.r = this.spec.r; this.m = this.spec.m;
    this.surface = cfg.surface || { restitution: 0.66, friction: 0.42, roll: 0.55 };
    this.ceiling = cfg.ceiling ?? COURT.ceiling + 4;   // hall ceiling / roof trusses
    this.hasCeiling = cfg.hasCeiling ?? true;
    this.netTop = COURT.netTop[this.gender];
    this.postH = COURT.postH[this.gender];
    this.netBottom = this.netTop - COURT.netWidth;
    this.kDrag = 0.5 * BALL_SPEC.rho * BALL_SPEC.cd * Math.PI * this.r * this.r / this.m;
    this.kMag = BALL_SPEC.magnus;
    this.postX = COURT.halfW + COURT.postOffset;
    this.noNet = false;
  }

  /** Advance one physics step of size dt. Events are pushed into `ev` (array) when provided. */
  step(s, dt, ev) {
    // adaptive sub-stepping so fast balls (30 m/s) never tunnel through the net
    const sp = Math.hypot(s.vx, s.vy, s.vz);
    const n = Math.max(1, Math.ceil(sp * dt / 0.04));
    const h = dt / n;
    for (let i = 0; i < n; i++) this._sub(s, h, ev);
  }

  _sub(s, h, ev) {
    const sp = Math.hypot(s.vx, s.vy, s.vz);
    // forces
    const kd = this.kDrag * sp;
    let ax = -kd * s.vx, ay = -G - kd * s.vy, az = -kd * s.vz;
    // Magnus: a = k * (w x v)
    ax += this.kMag * (s.wy * s.vz - s.wz * s.vy);
    ay += this.kMag * (s.wz * s.vx - s.wx * s.vz);
    az += this.kMag * (s.wx * s.vy - s.wy * s.vx);
    s.vx += ax * h; s.vy += ay * h; s.vz += az * h;
    const px = s.x, pz = s.z, py = s.y;
    s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h;
    const sd = Math.exp(-BALL_SPEC.spinDecay * h);
    s.wx *= sd; s.wy *= sd; s.wz *= sd;

    this._net(s, px, py, pz, ev);
    this._posts(s, ev);
    if (this.hasCeiling && s.y > this.ceiling - this.r && s.vy > 0) {
      s.y = this.ceiling - this.r; s.vy = -s.vy * 0.4; s.vx *= 0.8; s.vz *= 0.8;
      if (ev) ev.push({ type: 'ceiling', x: s.x, y: s.y, z: s.z });
    }
    if (s.y < this.r) this._floor(s, ev);
  }

  _floor(s, ev) {
    const r = this.r, e = this.surface.restitution;
    s.y = r;
    if (s.vy < 0) {
      const vn = -s.vy;
      s.vy = vn * e;
      // slip velocity at contact point (hollow sphere: I = 2/3 m r^2)
      const sx = s.vx + r * s.wz, sz = s.vz - r * s.wx;
      const slip = Math.hypot(sx, sz);
      if (slip > 1e-4) {
        const maxImpulse = this.surface.friction * (1 + e) * vn;
        const dv = Math.min(maxImpulse, 0.4 * slip);
        const dx = -sx / slip * dv, dz = -sz / slip * dv;
        s.vx += dx; s.vz += dz;
        s.wx += 1.5 * (-dz) / r; s.wz += 1.5 * (dx) / r;
      }
      if (ev && vn > 0.6) ev.push({ type: 'floor', x: s.x, z: s.z, speed: vn, first: false });
      else if (ev && vn > 0.05) ev.push({ type: 'floor', x: s.x, z: s.z, speed: vn, first: false });
    } else s.vy = 0;
    // rolling resistance when nearly resting
    if (Math.abs(s.vy) < 0.4) {
      const hs = Math.hypot(s.vx, s.vz);
      if (hs > 0) { const d = Math.min(hs, this.surface.roll * PHYS_DT * 2); s.vx -= s.vx / hs * d; s.vz -= s.vz / hs * d; }
      s.wx *= 0.99; s.wz *= 0.99;
    }
  }

  _net(s, px, py, pz, ev) {
    if (this.noNet) return;
    const r = this.r;
    const top = this.netTop, bottom = this.netBottom;
    // net spans post to post; only the mesh between bottom and top blocks the ball
    if (Math.abs(s.x) > this.postX) return;
    // crossing/near the plane z=0?
    const near = Math.abs(s.z) < r + 0.01 || (pz > 0) !== (s.z > 0);
    if (!near) return;
    // top cord/tape: horizontal cylinder radius 0.025 at y = top - 0.02
    const cy = top - 0.025, cr = 0.03;
    const dy = s.y - cy, dz = s.z;
    const dist = Math.hypot(dy, dz);
    if (dist < r + cr && s.y > top - 0.12 && s.y < top + r + 0.05 && dist > 1e-6) {
      const nx = dy / dist, nz = dz / dist;             // normal in (y,z)
      const vn = s.vy * nx + s.vz * nz;
      if (vn < 0) {
        const e = 0.30;
        s.vy -= (1 + e) * vn * nx; s.vz -= (1 + e) * vn * nz;
        s.vx *= 0.85;
        s.y = cy + nx * (r + cr + 1e-4); s.z = nz * (r + cr + 1e-4);
        if (ev) ev.push({ type: 'cord', x: s.x, y: s.y, z: s.z, speed: Math.abs(vn) });
      }
      return;
    }
    // net mesh
    if (s.y < top - 0.02 - 0.0 && s.y > bottom - r * 0.6) {
      const crossed = (pz > 0) !== (s.z > 0) || Math.abs(s.z) < r * 0.85;
      if (crossed) {
        const side = pz >= 0 ? 1 : -1;
        const vn = s.vz * side;                            // negative = moving into the net from side
        // absorb: soft net returns a fraction with strong tangential damping
        if (vn < 0 || (pz > 0) !== (s.z > 0)) {
          const e = 0.10;
          s.vz = -s.vz * e; s.vx *= 0.6; s.vy *= 0.75;
          s.z = side * (r * 0.9 + 0.005);
          s.wx *= 0.5; s.wy *= 0.5; s.wz *= 0.5;
          if (ev) ev.push({ type: 'net', x: s.x, y: s.y, z: s.z, side, speed: Math.abs(vn) });
        }
      }
    } else if (s.y <= bottom - r * 0.6 && (pz > 0) !== (s.z > 0)) {
      if (ev) ev.push({ type: 'under', x: s.x, y: s.y, z: s.z });
    }
  }

  _posts(s, ev) {
    if (this.noNet) return;
    const r = this.r;
    for (const sx of [-1, 1]) {
      const px = sx * this.postX;
      if (s.y > this.postH + r) continue;
      const dx = s.x - px, dz = s.z;
      const d = Math.hypot(dx, dz);
      if (d < r + 0.04) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const vn = s.vx * nx + s.vz * nz;
        if (vn < 0) { s.vx -= 1.5 * vn * nx; s.vz -= 1.5 * vn * nz; s.x = px + nx * (r + 0.04); s.z = nz * (r + 0.04); if (ev) ev.push({ type: 'post', x: s.x, y: s.y, z: s.z }); }
      }
    }
  }

  /**
   * Predict the trajectory. Returns {pts:[{t,x,y,z,vx,vy,vz}], landing:{t,x,z}|null, netCross:{t,x,y}|null}
   * Stops at the first floor contact (or tMax).
   */
  predict(state, tMax = 3.5, dtSample = 1 / 30) {
    const s = state.clone(), pts = [], ev = [];
    let t = 0, next = 0, landing = null, netCross = null, hitNet = false, hitCord = false;
    const dt = 1 / 120;
    pts.push({ t: 0, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz });
    while (t < tMax) {
      const pz = s.z;
      ev.length = 0;
      this.step(s, dt, ev);
      t += dt;
      if ((pz > 0) !== (s.z > 0) && !netCross) netCross = { t, x: s.x, y: s.y };
      for (const e of ev) { if (e.type === 'net') hitNet = true; if (e.type === 'cord') hitCord = true; if (e.type === 'floor') { landing = { t, x: s.x, z: s.z }; } }
      if (t >= next) { pts.push({ t, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz }); next += dtSample; }
      if (landing) break;
    }
    return { pts, landing, netCross, hitNet, hitCord, end: s };
  }

  /**
   * Nudge an intended-clean shot upward until the real integrator says it clears the net (max 10 tries).
   * `st` is the ball state at contact; vel {vx,vy,vz}; spin [wx,wy,wz]. Returns the adjusted velocity.
   */
  ensureClear(st, vel, spin) {
    const v = { vx: vel.vx, vy: vel.vy, vz: vel.vz };
    for (let i = 0; i < 10; i++) {
      const s = st.clone(); s.vx = v.vx; s.vy = v.vy; s.vz = v.vz; if (spin) { s.wx = spin[0]; s.wy = spin[1]; s.wz = spin[2]; }
      const p = this.predict(s, 3.0);
      if (!p.hitNet && !p.hitCord) return v;
      v.vy += 0.4;
    }
    return v;
  }

  /** Simulate `T` seconds and return the state (used by launch solving). */
  simulate(state, T) { const s = state.clone(); let t = 0; const dt = 1 / 120; while (t < T - 1e-9) { const h = Math.min(dt, T - t); this.step(s, h, null); t += h; } return s; }

  /**
   * Launch velocity so the ball goes from (x0,y0,z0) to (tx,ty,tz) in T seconds (with drag), by
   * fixed-point refinement of the ballistic solution.
   */
  solveFlightTime(x0, y0, z0, tx, ty, tz, T, spin = null, iters = 5) {
    let vx = (tx - x0) / T, vz = (tz - z0) / T, vy = (ty - y0 + 0.5 * G * T * T) / T;
    const s = new BallState();
    for (let i = 0; i < iters; i++) {
      s.x = x0; s.y = y0; s.z = z0; s.vx = vx; s.vy = vy; s.vz = vz;
      if (spin) { s.wx = spin[0]; s.wy = spin[1]; s.wz = spin[2]; } else { s.wx = s.wy = s.wz = 0; }
      let t = 0; const dt = 1 / 120;
      while (t < T - 1e-9) { const h = Math.min(dt, T - t); this.step(s, h, null); t += h; }
      vx += (tx - s.x) / T; vz += (tz - s.z) / T; vy += (ty - s.y) / T;
    }
    return { vx, vy, vz };
  }

  /**
   * Shortest flight time (>= Tmin) whose arc clears the net by `minClear` metres, landing at the
   * target. Returns {vx,vy,vz,T,clear,apex} (best effort if none clears).
   */
  solveOverNet(x0, y0, z0, tx, ty, tz, opts = {}) {
    const minClear = opts.minClear ?? 0.28, spin = opts.spin ?? null;
    let best = null;
    const crossesNet = (z0 > 0) !== (tz > 0);
    for (let T = opts.Tmin ?? 0.45; T <= (opts.Tmax ?? 2.8); T += 0.05) {
      const v = this.solveFlightTime(x0, y0, z0, tx, Math.max(ty, 0.12), tz, T, spin, 3);
      const s = new BallState(); s.x = x0; s.y = y0; s.z = z0; s.vx = v.vx; s.vy = v.vy; s.vz = v.vz;
      if (spin) { s.wx = spin[0]; s.wy = spin[1]; s.wz = spin[2]; }
      let t = 0, clear = crossesNet ? -9 : 9, apex = y0, crossed = false, touched = false; const dt = 1 / 60; const ev = [];
      while (t < T) { const pz = s.z, py = s.y; ev.length = 0; this.step(s, dt, ev); t += dt; if (s.y > apex) apex = s.y; if (ev.some((e) => e.type === 'net' || e.type === 'cord')) touched = true; if (crossesNet && !crossed && (pz > 0) !== (s.z > 0)) { crossed = true; const u = pz / (pz - s.z); clear = touched ? -1 : py + (s.y - py) * u - this.netTop - this.r; } }
      const cand = { ...v, T, clear, apex };
      if (apex > (opts.maxApex ?? 7.2)) break;
      if (!best || clear > best.clear) best = cand;
      if (clear >= minClear) return this._refineLanding(x0, y0, z0, tx, tz, T, spin, cand);
    }
    return best ? this._refineLanding(x0, y0, z0, tx, tz, best.T, spin, best) : null;
  }

  /** Nudge the aim so the *actual* first floor contact (with bounce logic) matches the target. */
  _refineLanding(x0, y0, z0, tx, tz, T, spin, cand) {
    let ax = tx, az = tz, v = cand;
    for (let k = 0; k < 3; k++) {
      const s = new BallState(); s.x = x0; s.y = y0; s.z = z0; s.vx = v.vx; s.vy = v.vy; s.vz = v.vz;
      if (spin) { s.wx = spin[0]; s.wy = spin[1]; s.wz = spin[2]; }
      const p = this.predict(s, T + 1.5);
      if (!p.landing) break;
      const ex = tx - p.landing.x, ez = tz - p.landing.z;
      if (Math.hypot(ex, ez) < 0.05) break;
      ax += ex; az += ez;
      const nv = this.solveFlightTime(x0, y0, z0, ax, 0.12, az, T, spin, 3);
      v = { ...cand, ...nv };
    }
    return { ...cand, ...v };
  }

  /**
   * Launch at a given speed towards a floor target: finds the pitch (net ignored, free flight) for which
   * the first floor contact lands at (tx,tz), then measures net clearance along that free trajectory.
   * Returns null if the target is out of range at this speed; else {vx,vy,vz,T,clearance,pitch}.
   */
  solveSpeed(x0, y0, z0, tx, tz, speed, spin = null, opts = {}) {
    const dx = tx - x0, dz = tz - z0, D = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const crossesNet = (z0 > 0) !== (tz > 0);
    const saved = this.noNet; this.noNet = true;
    const evalPitch = (p) => {
      const s = new BallState(); s.x = x0; s.y = y0; s.z = z0;
      const c = Math.cos(p); s.vx = Math.sin(yaw) * c * speed; s.vz = Math.cos(yaw) * c * speed; s.vy = Math.sin(p) * speed;
      if (spin) { s.wx = spin[0]; s.wy = spin[1]; s.wz = spin[2]; }
      let t = 0, clear = crossesNet ? -9 : 9, crossed = false; const dt = 1 / 120; const ev = [];
      while (t < 4) {
        const pz = s.z, py = s.y; ev.length = 0; this.step(s, dt, ev); t += dt;
        if (crossesNet && !crossed && (pz > 0) !== (s.z > 0)) { crossed = true; const u = pz / (pz - s.z); clear = py + (s.y - py) * u - this.netTop - this.r; }
        if (ev.some((e) => e.type === 'floor')) break;
      }
      const along = (s.x - x0) * Math.sin(yaw) + (s.z - z0) * Math.cos(yaw);
      return { along, clear, T: t };
    };
    let lo = opts.pitchLo ?? -0.9, hi = opts.pitchHi ?? 0.78;
    const fLo = evalPitch(lo).along - D, fHi = evalPitch(hi).along - D;
    let best = null;
    if (fLo * fHi <= 0) {
      let a = lo, b = hi, fa = fLo;
      for (let i = 0; i < 18; i++) {
        const mid = 0.5 * (a + b); const r = evalPitch(mid); const f = r.along - D;
        best = { pitch: mid, ...r };
        if (Math.abs(f) < 0.03) break;
        if (f * fa > 0) { a = mid; fa = f; } else b = mid;
      }
    }
    this.noNet = saved;
    if (!best) return null;
    const c = Math.cos(best.pitch);
    return { vx: Math.sin(yaw) * c * speed, vz: Math.cos(yaw) * c * speed, vy: Math.sin(best.pitch) * speed, T: best.T, clearance: best.clear, pitch: best.pitch };
  }
}
