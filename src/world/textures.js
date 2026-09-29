// Procedural canvas textures (all assets are generated at runtime; no external files).
import * as THREE from 'three';
import { makeRng } from '../util/math.js';

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.needsUpdate = true;
  return t;
}

export function noiseTex(size = 256, seed = 1, o = {}) {
  const rng = makeRng(seed);
  return canvasTex(size, size, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 128 + (rng() - 0.5) * 255 * (o.amp ?? 0.35);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: o.repeat ?? [8, 8], linear: true, aniso: 4 });
}

export const SPONSORS = [
  ['NOVA BANK', '#0d2a6b', '#ffffff'], ['AEROSPORT', '#c8102e', '#ffffff'], ['KAMPUNG COLA', '#f2b705', '#7a0019'], ['TAKRAWX', '#101418', '#ffd23f'],
  ['ORIENT AIR', '#0a6cbc', '#ffffff'], ['JADE TEA', '#0b6b48', '#f4f1de'], ['VELOX', '#5b2a86', '#ffffff'], ['SUNRISE MOTORS', '#e4572e', '#ffffff'],
  ['OCEANIA TELECOM', '#00a7b5', '#062a30'], ['ZENITH', '#222831', '#eeeeee'],
];

/** Advertising LED board strip (used around the court). */
export function adBoardTex(offset = 0, w = 2048, h = 128) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#0a0d18'; g.fillRect(0, 0, w, h);
    const n = SPONSORS.length; const seg = w / 5;
    for (let i = 0; i < 5; i++) {
      const [name, bg, fg] = SPONSORS[(i + offset) % n];
      const grd = g.createLinearGradient(i * seg, 0, (i + 1) * seg, 0); grd.addColorStop(0, bg); grd.addColorStop(1, shade(bg, 0.7));
      g.fillStyle = grd; g.fillRect(i * seg + 4, 6, seg - 8, h - 12);
      g.fillStyle = fg; g.font = '900 64px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, i * seg + seg / 2, h / 2 + 3, seg - 40);
    }
    // LED scan-line look
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  }, { aniso: 8 });
}
export function shade(hex, k) {
  const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString();
}

/** Game logo mark (ball emblem + wordmark), drawn at (cx, cy) with given width. */
export function drawLogo(g, cx, cy, w, opt = {}) {
  const gold = opt.gold ?? '#f2c94c', dark = opt.dark ?? '#1a2a5a', text = opt.text ?? '#ffffff';
  const r = w * 0.16;
  // woven ball emblem
  g.save(); g.translate(cx, cy - w * 0.12);
  const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); grd.addColorStop(0, '#ffe58a'); grd.addColorStop(1, '#c8891a');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(80,40,0,0.55)'; g.lineWidth = r * 0.09;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(0, 0, r * 0.98, r * 0.42, (i * Math.PI) / 6, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = opt.shadow ?? 'rgba(0,0,0,0.25)';
  g.font = `italic 900 ${w * 0.16}px "Arial Black", Impact, sans-serif`;
  g.fillText('SEPAK TAKRAW', cx + w * 0.01, cy + w * 0.12 + w * 0.012, w);
  g.fillStyle = text; g.fillText('SEPAK TAKRAW', cx, cy + w * 0.12, w);
  g.fillStyle = gold; g.font = `700 ${w * 0.075}px "Arial Black", Impact, sans-serif`;
  g.fillText('GAME CHALLENGE', cx, cy + w * 0.27, w * 0.9);
}
