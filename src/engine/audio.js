// Fully synthesised audio (WebAudio): crowd bed, ball strikes, bounces, net, whistle, UI.
export class GameAudio {
  constructor() { this.ctx = null; this.master = null; this.enabled = true; this.volume = 0.8; this.crowdGain = null; this.excite = 0; this.noiseBuf = null; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; // pink-ish noise
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    this.noiseBuf = buf;
    // crowd bed
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0.06;
    src.connect(bp); bp.connect(this.crowdGain); this.crowdGain.connect(this.master); src.start();
    this.crowdFilter = bp;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.enabled ? v : 0; }
  setEnabled(e) { this.enabled = e; if (this.master) this.master.gain.value = e ? this.volume : 0; }
  update(dt, excite = 0) {
    if (!this.ctx) return;
    this.excite += (excite - this.excite) * Math.min(1, dt * 2);
    this.crowdGain.gain.value = 0.05 + 0.16 * this.excite; this.crowdFilter.frequency.value = 600 + 900 * this.excite;
  }
  _env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  noiseBurst(t, dur, freq, q, peak, type = 'bandpass') {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    this._env(g, t, 0.004, dur, peak); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  tone(t, f0, f1, dur, peak, type = 'sine') {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this._env(g, t, 0.003, dur, peak); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  /** kind: foot|head|chest|body|spike|serve ; power 0..1 */
  hit(kind = 'foot', power = 0.5) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; const p = 0.25 + power * 0.75;
    const base = { foot: 190, head: 120, chest: 95, body: 105, spike: 230, serve: 210 }[kind] || 160;
    this.tone(t, base * (1.1 + 0.4 * power), base * 0.5, 0.11 + 0.06 * power, 0.5 * p);
    this.noiseBurst(t, 0.05 + 0.05 * power, kind === 'chest' ? 900 : 2400, 0.8, 0.5 * p);
    if (kind === 'spike' || kind === 'serve') this.noiseBurst(t + 0.01, 0.18, 4500, 1.2, 0.18 * p, 'highpass');
  }
  bounce(speed) { if (!this.ctx || !this.enabled || speed < 0.6) return; const t = this.ctx.currentTime; const p = Math.min(1, speed / 9); this.tone(t, 140, 70, 0.09, 0.35 * p); this.noiseBurst(t, 0.05, 1400, 0.7, 0.22 * p); }
  net(speed) { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; const p = Math.min(1, speed / 14); this.noiseBurst(t, 0.28, 2600, 0.5, 0.3 * p); this.noiseBurst(t + 0.03, 0.2, 5200, 0.6, 0.12 * p); this.tone(t, 90, 60, 0.12, 0.2 * p); }
  cord(speed) { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.tone(t, 620, 520, 0.16, 0.2, 'triangle'); this.noiseBurst(t, 0.12, 3200, 1, 0.16); }
  whistle(long = false) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; const d = long ? 0.9 : 0.42;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2950; o2.type = 'sine'; o2.frequency.value = 3120; lfo.frequency.value = 42; lg.gain.value = 110; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.02); g.gain.setValueAtTime(0.32, t + d - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); o2.connect(g); g.connect(this.master); o.start(t); o2.start(t); lfo.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  }
  cheer(size = 1) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.excite = Math.min(1, this.excite + 0.5 * size);
    this.noiseBurst(t, 0.9 + size * 0.9, 1100, 0.5, 0.35 * size, 'bandpass'); this.noiseBurst(t + 0.05, 1.2 + size, 2400, 0.4, 0.15 * size, 'bandpass');
  }
  groan() { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.noiseBurst(t, 0.8, 380, 0.7, 0.2); }
  click() { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.tone(t, 900, 700, 0.05, 0.2, 'square'); }
  step(p = 0.3) { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.noiseBurst(t, 0.04, 1800, 1.4, 0.06 * p, 'bandpass'); }
}
