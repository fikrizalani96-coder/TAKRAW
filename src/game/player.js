// Player entity: role, stats, kinematic movement and skill state. Rendering is decoupled: an
// optional Animator (player.anim) and Group (player.visual) are driven from here when present.
import { COURT, ROLES } from './config.js';

export const fwdX = (h) => Math.sin(h), fwdZ = (h) => Math.cos(h);
export const leftX = (h) => Math.cos(h), leftZ = (h) => -Math.sin(h);
export const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

const ROLE_STATS = {
  [ROLES.TEKONG]: { speed: 6.0, accel: 11, jump: 0.55, power: 0.95, technique: 0.9, block: 0.5, reach: 1.0, react: 0.11 },
  [ROLES.TOSSER]: { speed: 6.2, accel: 12, jump: 0.6, power: 0.7, technique: 0.96, block: 0.55, reach: 0.95, react: 0.10 },
  [ROLES.KILLER]: { speed: 6.6, accel: 13, jump: 0.85, power: 1.0, technique: 0.88, block: 0.85, reach: 1.05, react: 0.10 },
};

export class Player {
  constructor(o) {
    this.id = o.id; this.team = o.team; this.role = o.role; this.index = o.index;
    this.name = o.name || ('P' + o.id); this.number = o.number ?? 0;
    const base = ROLE_STATS[this.role];
    const q = o.rating ?? 0.8;
    this.stats = {};
    for (const k of Object.keys(base)) this.stats[k] = base[k];
    this.rating = q;
    this.skill = q;           // overall control 0..1 (scaled by difficulty)
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.heading = 0;
    this.y = 0;
    this.side = 1;
    this.human = false;
    this.busy = null;          // active skill execution
    this.moveSpeedCap = null;
    this.stateName = 'idle';
    this.anim = null; this.visual = null;
    this.lastTouchTime = -99;
    this.celebrating = false;
    this.gaze = null;
    this.stunned = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  setPos(x, z, h) { this.x = x; this.z = z; if (h !== undefined) this.heading = h; this.vx = this.vz = 0; }

  /** Steer toward a point with acceleration limits and arrival damping. */
  steerTo(tx, tz, dt, maxSpeed = null, arrive = 0.35) {
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const vmax = Math.min(maxSpeed ?? this.stats.speed, this.moveSpeedCap ?? 99) * (0.75 + 0.25 * this.rating);
    let want = vmax;
    // braking distance v^2 / (2a)
    const brake = (this.speed * this.speed) / (2 * this.stats.accel * 0.9);
    if (d < Math.max(arrive, brake)) want = Math.min(vmax, d * 7);
    if (d < 0.03) want = 0;
    const wx = d > 1e-6 ? dx / d * want : 0, wz = d > 1e-6 ? dz / d * want : 0;
    this._accel(wx, wz, dt);
  }
  steerVel(wx, wz, dt) { this._accel(wx, wz, dt); }
  stop(dt) { this._accel(0, 0, dt, 1.4); }
  _accel(wx, wz, dt, k = 1) {
    let ax = wx - this.vx, az = wz - this.vz;
    const l = Math.hypot(ax, az), maxd = this.stats.accel * k * dt;
    if (l > maxd) { ax = ax / l * maxd; az = az / l * maxd; }
    this.vx += ax; this.vz += az;
  }
  integrate(dt) { this.x += this.vx * dt; this.z += this.vz * dt; }
  faceTo(angle, dt, rate = 9) {
    const d = wrapPi(angle - this.heading);
    const step = Math.min(Math.abs(d), rate * dt);
    this.heading = wrapPi(this.heading + Math.sign(d) * step);
  }
  faceToward(x, z, dt, rate = 9) { this.faceTo(Math.atan2(x - this.x, z - this.z), dt, rate); }
  /** heading that faces the net for this side */
  get netHeading() { return this.side > 0 ? Math.PI : 0; }

  /** Clamp to own half (with margin from the net) and the free zone. */
  confine(minNet = 0.42) {
    const s = this.side;
    const maxX = COURT.halfW + 2.6, maxZ = COURT.halfL + 2.6;
    this.x = Math.max(-maxX, Math.min(maxX, this.x));
    let dz = this.z * s;                    // distance into own half
    if (dz < minNet) { dz = minNet; this.z = dz * s; if (this.vz * s < 0) this.vz = 0; }
    if (dz > maxZ) { this.z = maxZ * s; if (this.vz * s > 0) this.vz = 0; }
  }
  worldOf(lx, lz, ly = 0) { return { x: this.x + leftX(this.heading) * lx + fwdX(this.heading) * lz, y: ly, z: this.z + leftZ(this.heading) * lx + fwdZ(this.heading) * lz }; }
}
