// Instant replay: records the last few seconds of every player's full skeleton pose + the ball at 30 Hz and
// plays a rally back in slow motion from a cinematic side camera. Purely visual - the match is paused while a
// replay runs and resumes exactly where it left off.
import * as THREE from 'three';

const _q = new THREE.Quaternion();

export class Replay {
  constructor(view, { hz = 30, seconds = 9, speed = 0.5 } = {}) {
    this.view = view; this.hz = hz; this.max = Math.ceil(hz * seconds); this.speed = speed;
    this.frames = []; this.acc = 0; this.active = false;
    this.rigs = null; this.tmpQ = null; this.tmpP = null;
    this.frame = 0; this.t = 0; this.t0 = 0; this.t1 = 0; this.side = -1; this.lastEndTime = -99;
  }

  /** Lazily gather the skeletons of the six players (they exist once the match is bound). */
  bind() {
    const m = this.view.match; if (!m) return false;
    this.rigs = m.all.map((p) => p.visual).filter(Boolean).map((h) => ({ group: h.group, bones: h.rig.list }));
    this.nB = this.rigs.length ? this.rigs[0].bones.length : 0;
    this.tmpQ = new Float32Array(this.nB * 4); this.tmpP = new Float32Array(this.nB * 3);
    return this.rigs.length > 0;
  }

  /** Called every live frame after the view has updated. */
  record(dt) {
    if (this.active) return;
    if (!this.rigs && !this.bind()) return;
    this.acc += dt;
    const step = 1 / this.hz;
    if (this.acc < step) return;
    this.acc = Math.min(this.acc - step, step);
    const v = this.view, nB = this.nB;
    // recycle the oldest frame's buffers once the ring is full
    let f = this.frames.length >= this.max ? this.frames.shift() : null;
    if (!f) f = { humans: this.rigs.map(() => ({ g: new Float32Array(4), q: new Float32Array(nB * 4), p: new Float32Array(nB * 3) })), ball: new Float32Array(7) };
    f.t = v.time;
    this.rigs.forEach((r, i) => {
      const h = f.humans[i];
      h.g[0] = r.group.position.x; h.g[1] = r.group.position.y; h.g[2] = r.group.position.z; h.g[3] = r.group.rotation.y;
      for (let b = 0; b < nB; b++) {
        const bone = r.bones[b];
        h.q[b * 4] = bone.quaternion.x; h.q[b * 4 + 1] = bone.quaternion.y; h.q[b * 4 + 2] = bone.quaternion.z; h.q[b * 4 + 3] = bone.quaternion.w;
        h.p[b * 3] = bone.position.x; h.p[b * 3 + 1] = bone.position.y; h.p[b * 3 + 2] = bone.position.z;
      }
    });
    const bm = v.ballMesh;
    f.ball[0] = bm.position.x; f.ball[1] = bm.position.y; f.ball[2] = bm.position.z; f.ball[3] = bm.quaternion.x; f.ball[4] = bm.quaternion.y; f.ball[5] = bm.quaternion.z; f.ball[6] = bm.quaternion.w;
    this.frames.push(f);
  }

  /** Start a replay of everything since `fromT` (view time). Returns false if there is not enough footage. */
  start(fromT, slowT = null) {
    const fr = this.frames.filter((f) => f.t >= fromT);
    if (fr.length < this.hz * 1.2) return false;
    this.clip = fr; this.t = fr[0].t; this.t0 = fr[0].t; this.t1 = fr[fr.length - 1].t;
    this.active = true; this.elapsed = 0; this.slowT = slowT; this.rate = 0.7;
    // the umpire chair is on +x in the official arena: shoot from the open side
    this.side = -1;
    const v = this.view;
    v.app.camRig.override = { pos: new THREE.Vector3(this.side * 9.5, 2.6, 0), look: new THREE.Vector3(0, 1.4, 0), fov: 40 };
    v.app.camRig._tmp.set(0, 1.4, 0);
    v.trailLine.material.opacity = 0;
    v.setReplayUI && v.setReplayUI(true);
    return true;
  }

  stop() {
    if (!this.active) return;
    this.active = false; this.clip = null;
    const v = this.view;
    v.app.camRig.override = null; v.app.camRig.reset && v.app.camRig.reset();
    v.setReplayUI && v.setReplayUI(false);
    // resume live animation cleanly: the animators overwrite the bones on the next update
    this.acc = 0; this.lastEndTime = v.time;
  }

  /** Advance playback by real time dt; returns true while running. */
  update(dt) {
    if (!this.active) return false;
    this.elapsed += dt;
    // 0.8x through the build-up, ~0.3x across the finishing contact, easing between
    const near = this.slowT == null ? 0 : Math.max(0, 1 - Math.abs(this.t - this.slowT) / 0.55);
    const targetRate = 0.8 - 0.5 * near * near * (3 - 2 * near);
    this.rate += (targetRate - this.rate) * Math.min(1, dt * 8);
    this.t += dt * this.rate;
    const fr = this.clip;
    if (this.t >= this.t1 + 0.6) { this.stop(); return false; }        // linger briefly on the final frame
    const t = Math.min(this.t, this.t1);
    let i = 0; while (i < fr.length - 2 && fr[i + 1].t <= t) i++;
    const a = fr[i], b = fr[Math.min(i + 1, fr.length - 1)];
    const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const v = this.view, nB = this.nB;
    this.rigs.forEach((r, k) => {
      const ha = a.humans[k], hb = b.humans[k];
      r.group.position.set(ha.g[0] + (hb.g[0] - ha.g[0]) * u, ha.g[1] + (hb.g[1] - ha.g[1]) * u, ha.g[2] + (hb.g[2] - ha.g[2]) * u);
      let dy = hb.g[3] - ha.g[3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.group.rotation.y = ha.g[3] + dy * u;
      for (let j = 0; j < nB; j++) {
        THREE.Quaternion.slerpFlat(this.tmpQ, j * 4, ha.q, j * 4, hb.q, j * 4, u);
        r.bones[j].quaternion.set(this.tmpQ[j * 4], this.tmpQ[j * 4 + 1], this.tmpQ[j * 4 + 2], this.tmpQ[j * 4 + 3]);
        r.bones[j].position.set(ha.p[j * 3] + (hb.p[j * 3] - ha.p[j * 3]) * u, ha.p[j * 3 + 1] + (hb.p[j * 3 + 1] - ha.p[j * 3 + 1]) * u, ha.p[j * 3 + 2] + (hb.p[j * 3 + 2] - ha.p[j * 3 + 2]) * u);
      }
      r.group.updateMatrixWorld(true);
    });
    const bm = v.ballMesh;
    bm.position.set(a.ball[0] + (b.ball[0] - a.ball[0]) * u, a.ball[1] + (b.ball[1] - a.ball[1]) * u, a.ball[2] + (b.ball[2] - a.ball[2]) * u);
    _q.set(a.ball[3], a.ball[4], a.ball[5], a.ball[6]).slerp(new THREE.Quaternion(b.ball[3], b.ball[4], b.ball[5], b.ball[6]), u); bm.quaternion.copy(_q);
    // cinematic side camera: tracks the ball along the net, slow push-in
    const cr = v.app.camRig.override; if (!cr) return true;
    const prog = Math.min(1, (t - this.t0) / Math.max(0.5, this.t1 - this.t0));
    const bx = bm.position.x, by = bm.position.y, bz = bm.position.z;
    // reverse-angle from behind the near corner, sliding along with the ball toward the net
    cr.pos.set(this.side * (8.6 - 1.6 * prog), 3.0 + 0.6 * (1 - prog) + Math.min(1.0, by * 0.10), 9.5 - 3.2 * prog + THREE.MathUtils.clamp(bz * 0.25, -2, 2));
    cr.look.set(bx * 0.35, Math.max(0.9, by * 0.75), bz * 0.7);
    cr.fov = 40 - 8 * prog;
    return true;
  }
}
