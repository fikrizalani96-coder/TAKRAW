// Broadcast camera rig: sits behind the human team's baseline, fits the whole court into any aspect
// ratio (portrait phone -> ultrawide), follows the ball gently, and offers alternate angles.
import * as THREE from 'three';
import { COURT } from '../game/config.js';

const CORNERS = [];
for (const x of [-1, 1]) for (const z of [-1, 1]) CORNERS.push(new THREE.Vector3(x * (COURT.halfW + 0.38), 0, z * (COURT.halfL + 0.1)));

export const CAMERA_MODES = ['broadcast', 'high', 'side', 'follow'];

export class CameraRig {
  constructor(camera) {
    this.cam = camera; this.mode = 'broadcast';
    this.side = 1;                    // +1 = camera behind z>0 baseline (looking toward -z)
    this.target = new THREE.Vector3(0, 0.6, -0.5);
    this.pos = new THREE.Vector3(0, 8.5, 18);
    this.dist = 22; this.shake = 0; this.kick = 0; this.time = 0;
    this.override = null;             // {pos, look, fov} for replays/cinematics
    this._tmp = new THREE.Vector3();
    this.baseFov = 40;
    this._snap = true;                // jump straight to the framing on the first frame
    this.maxHeight = 11.5;            // set higher for open-air venues
  }
  setMode(m) { this.mode = m; }
  reset() { this._snap = true; }
  cycle() { this.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]; return this.mode; }
  addShake(v) { this.shake = Math.min(1, this.shake + v); }
  addKick(v) { this.kick = Math.min(1, this.kick + v); }

  /** distance along dir so that every court corner projects inside the frame (with margin). */
  fitDistance(dir, target, fov, aspect, margin = 0.9) {
    const cam = this.cam;
    const probe = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
    const v = new THREE.Vector3();
    let d = 8;
    for (let it = 0; it < 60; it++) {
      probe.position.copy(target).addScaledVector(dir, d); probe.lookAt(target); probe.updateMatrixWorld(true); probe.updateProjectionMatrix();
      let ok = true;
      for (const c of CORNERS) { v.copy(c).project(probe); if (Math.abs(v.x) > margin || v.y > margin || v.y < -margin || v.z > 1) { ok = false; break; } }
      if (ok) return d;
      d += 0.6;
    }
    return d;
  }

  update(dt, ball, humanPlayer, aspect) {
    this.time += dt;
    const cam = this.cam;
    if (this.override) {
      cam.position.lerp(this.override.pos, 1 - Math.exp(-6 * dt)); this._tmp.lerp(this.override.look, 1 - Math.exp(-8 * dt));
      cam.lookAt(this._tmp); cam.fov += ((this.override.fov ?? 40) - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); return;
    }
    const s = this.side;
    const bx = ball ? ball.x : 0, bz = ball ? ball.z : 0;
    const followX = this.mode === 'follow' && humanPlayer ? humanPlayer.x : bx;
    let tx = followX * 0.28, tz = -s * 0.6 + bz * 0.18, ty = 0.7;
    let dir, fov = this.baseFov;
    switch (this.mode) {
      case 'high': dir = new THREE.Vector3(0, 0.9, s).normalize(); fov = 40; break;
      case 'side': dir = new THREE.Vector3(1, 0.42, 0).normalize(); fov = 38; tx = 0; tz = bz * 0.3; break;
      case 'follow': dir = new THREE.Vector3(0, 0.34, s).normalize(); fov = 44; tz = -s * 0.2 + (humanPlayer ? humanPlayer.z * 0.35 : 0); break;
      default: {
        // narrow (portrait) screens are width-limited: lift the camera so the long court fills the height
        const lift = Math.max(0, Math.min(1, (0.95 - aspect) / 0.4));
        dir = new THREE.Vector3(0, 0.40 + lift * 0.62, s).normalize();
      }
    }
    if (this.mode === 'broadcast') tz += s * Math.max(0, Math.min(1, (0.95 - aspect) / 0.4)) * 1.3;   // keep the near baseline clear of the touch controls
    const aspectFov = fov + Math.max(0, Math.min(1, (0.85 - aspect) / 0.35)) * 15;   // phones: wider lens keeps the camera inside the hall
    const target = new THREE.Vector3(tx, ty, tz);
    let want = this.mode === 'follow' ? 15 : this.fitDistance(dir, new THREE.Vector3(tx * 0.3, 0.4, -s * 0.5), aspectFov, aspect, 0.95);
    if (this.mode === 'side') want = this.fitDistance(dir, new THREE.Vector3(0, 0.4, 0), aspectFov, aspect, 0.9);
    // stay below the roof rig: flatten the view angle until the camera fits under the height cap
    for (let k = 0; k < 10 && target.y + dir.y * want > this.maxHeight; k++) {
      dir.y *= 0.88; dir.normalize();
      if (this.mode !== 'follow') want = this.fitDistance(dir, new THREE.Vector3(this.mode === 'side' ? 0 : tx * 0.3, 0.4, this.mode === 'side' ? 0 : -s * 0.5), aspectFov, aspect, this.mode === 'side' ? 0.9 : 0.95);
    }
    if (this._snap) { this.dist = want; this._snap = false; this.pos.copy(target).addScaledVector(dir, want); this.target.copy(target); cam.fov = aspectFov; cam.updateProjectionMatrix(); }
    this.dist += (want - this.dist) * Math.min(1, dt * 3);
    const desired = target.clone().addScaledVector(dir, this.dist);
    this.pos.lerp(desired, 1 - Math.exp(-5 * dt));
    this.target.lerp(target, 1 - Math.exp(-6 * dt));
    // extra FOV when the ball flies very high; punch-in on big hits
    const high = ball ? Math.max(0, Math.min(1, (ball.y - 3.5) / 5)) : 0;
    this.kick = Math.max(0, this.kick - dt * 2.2); this.shake = Math.max(0, this.shake - dt * 3);
    const f = aspectFov + high * 7 - this.kick * 3;
    cam.fov += (f - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix();
    cam.position.copy(this.pos);
    if (this.shake > 0) { const a = this.shake * 0.05; cam.position.x += Math.sin(this.time * 71) * a; cam.position.y += Math.sin(this.time * 83) * a; }
    cam.lookAt(this.target);
  }
}
