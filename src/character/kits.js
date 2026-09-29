// Teams, kits, flags, skin tones and garment colouring.
import * as THREE from 'three';

const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const SKIN_TONES = [0xe6b697, 0xd8a47c, 0xc78f66, 0xb27a50, 0x9a6540, 0x7d4c2e];
export const HAIR_COLORS = [0x0d0a08, 0x14100c, 0x1c140e, 0x2a1d13, 0x0a0a0c];

export const TEAMS = {
  THA: { name: 'Thailand', code: 'THA', kit: { primary: 0x1c3f9c, secondary: 0xd8283c, trim: 0xffffff, shorts: 0x14286e, socks: 0xffffff, shoe: 0xf2f2f2, pattern: 'sash' }, tone: [0, 1, 2], fame: 5 },
  MAS: { name: 'Malaysia', code: 'MAS', kit: { primary: 0x15171c, secondary: 0xe2352b, trim: 0xf2c230, shorts: 0x0c0d10, socks: 0x15171c, shoe: 0xf2c230, pattern: 'chevron' }, tone: [2, 3, 4], fame: 5 },
  INA: { name: 'Indonesia', code: 'INA', kit: { primary: 0xd21f2e, secondary: 0xffffff, trim: 0xffffff, shorts: 0xd21f2e, socks: 0xffffff, shoe: 0xffffff, pattern: 'sides' }, tone: [2, 3, 4], fame: 4 },
  MYA: { name: 'Myanmar', code: 'MYA', kit: { primary: 0x1f8a3d, secondary: 0xf6d21c, trim: 0xdf2b2b, shorts: 0x14582a, socks: 0xf6d21c, shoe: 0xffffff, pattern: 'stripes' }, tone: [1, 2, 3], fame: 3 },
  VIE: { name: 'Vietnam', code: 'VIE', kit: { primary: 0xc8162a, secondary: 0xf6d21c, trim: 0xf6d21c, shorts: 0x7a0f1a, socks: 0xc8162a, shoe: 0xffffff, pattern: 'gradient' }, tone: [0, 1, 2], fame: 3 },
  PHI: { name: 'Philippines', code: 'PHI', kit: { primary: 0x1a3f9a, secondary: 0xd82a35, trim: 0xf6d21c, shorts: 0xffffff, socks: 0xd82a35, shoe: 0xffffff, pattern: 'sash' }, tone: [2, 3, 4], fame: 2 },
  SGP: { name: 'Singapore', code: 'SGP', kit: { primary: 0xffffff, secondary: 0xd7263d, trim: 0xd7263d, shorts: 0xd7263d, socks: 0xffffff, shoe: 0xffffff, pattern: 'sides' }, tone: [0, 1, 2], fame: 2 },
  JPN: { name: 'Japan', code: 'JPN', kit: { primary: 0x122a6a, secondary: 0xffffff, trim: 0xd82a35, shorts: 0xffffff, socks: 0x122a6a, shoe: 0xffffff, pattern: 'chevron' }, tone: [0, 1], fame: 3 },
  KOR: { name: 'Korea', code: 'KOR', kit: { primary: 0xf4f4f4, secondary: 0x1e40a0, trim: 0xd82a35, shorts: 0x1e40a0, socks: 0xf4f4f4, shoe: 0xffffff, pattern: 'sash' }, tone: [0, 1], fame: 4 },
  CHN: { name: 'China', code: 'CHN', kit: { primary: 0xd21f2e, secondary: 0xf6d21c, trim: 0xf6d21c, shorts: 0xd21f2e, socks: 0xf6d21c, shoe: 0xffffff, pattern: 'gradient' }, tone: [0, 1], fame: 3 },
  IND: { name: 'India', code: 'IND', kit: { primary: 0x2a5cd4, secondary: 0xff9933, trim: 0x138808, shorts: 0x1b3f9a, socks: 0xffffff, shoe: 0xffffff, pattern: 'sides' }, tone: [2, 3, 4], fame: 2 },
  LAO: { name: 'Laos', code: 'LAO', kit: { primary: 0xc8162a, secondary: 0x1b3f9a, trim: 0xffffff, shorts: 0x1b3f9a, socks: 0xc8162a, shoe: 0xffffff, pattern: 'stripes' }, tone: [1, 2, 3], fame: 2 },
};
export const TEAM_CODES = Object.keys(TEAMS);

// Player names (fictional combinations) per nation
const NAMES = {
  THA: ['Kritsada', 'Pornchai', 'Sarawut', 'Thanakorn', 'Nattapong', 'Anucha', 'Worapot', 'Chaiwat', 'Somchai'], THA_S: ['Wongsa', 'Srisuk', 'Boonmee', 'Kaewmanee', 'Chantra', 'Phromma', 'Saetang'],
  MAS: ['Hafiz', 'Faizal', 'Syafiq', 'Azlan', 'Shahrul', 'Amirul', 'Hazwan', 'Norhisham', 'Farhan'], MAS_S: ['Abdullah', 'Rahman', 'Ismail', 'Yusof', 'Hamzah', 'Salleh', 'Razak'],
  INA: ['Rizky', 'Dimas', 'Agus', 'Hendra', 'Bayu', 'Fajar', 'Wahyu', 'Andi', 'Irfan'], INA_S: ['Pratama', 'Saputra', 'Wijaya', 'Hidayat', 'Nugroho', 'Firmansyah', 'Susanto'],
  MYA: ['Kyaw', 'Zaw', 'Min', 'Htet', 'Thura', 'Aung', 'Naing', 'Soe', 'Hein'], MYA_S: ['Lin', 'Htoo', 'Oo', 'Win', 'Moe', 'Tun', 'Thant'],
  VIE: ['Minh', 'Tuan', 'Hieu', 'Duc', 'Long', 'Quang', 'Nam', 'Khoa', 'Phuc'], VIE_S: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Dang'],
  PHI: ['Jerome', 'Carlo', 'Miguel', 'Rey', 'Dennis', 'Paolo', 'Jomar', 'Ryan', 'Noel'], PHI_S: ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Ramos', 'Aquino'],
  SGP: ['Wei', 'Jun', 'Farid', 'Kumar', 'Daniel', 'Marcus', 'Ryan', 'Aiden', 'Isaac'], SGP_S: ['Tan', 'Lim', 'Lee', 'Ng', 'Ong', 'Goh', 'Chua'],
  JPN: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito', 'Riku', 'Daiki', 'Shun', 'Takumi'], JPN_S: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Ito', 'Yamamoto', 'Kobayashi'],
  KOR: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Do-yun', 'Jae-min', 'Tae-yang', 'Woo-jin', 'Sung-min'], KOR_S: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon'],
  CHN: ['Wei', 'Hao', 'Jian', 'Lei', 'Bo', 'Tao', 'Yang', 'Chen', 'Ming'], CHN_S: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang'],
  IND: ['Arjun', 'Rohit', 'Vikram', 'Sandeep', 'Karan', 'Manish', 'Deepak', 'Rahul', 'Amit'], IND_S: ['Singh', 'Kumar', 'Sharma', 'Patel', 'Yadav', 'Thapa', 'Devi'],
  LAO: ['Somphone', 'Khamla', 'Bounmy', 'Thongsy', 'Vilay', 'Keo', 'Sengdao', 'Phet', 'Souk'], LAO_S: ['Sisavath', 'Phommasone', 'Vongkham', 'Inthavong', 'Keomany', 'Xayavong', 'Luangkhot'],
};
export function playerName(code, rng) {
  const f = NAMES[code] || NAMES.THA, s = NAMES[code + '_S'] || NAMES.THA_S;
  return { first: rng.pick(f), last: rng.pick(s) };
}

// ---------- flags ----------
export function drawFlag(g, code, w, h) {
  const R = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  const star = (cx, cy, r, c, pts = 5, inner = 0.4, rot = -Math.PI / 2) => {
    g.fillStyle = c; g.beginPath();
    for (let i = 0; i < pts * 2; i++) { const rr = i % 2 ? r * inner : r; const a = rot + i * Math.PI / pts; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  const disc = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
  switch (code) {
    case 'THA': R('#a51931', 0, 0, w, h); R('#f4f5f8', 0, h / 6, w, h * 4 / 6); R('#2d2a4a', 0, h / 3, w, h / 3); break;
    case 'MAS': for (let i = 0; i < 14; i++) R(i % 2 ? '#ffffff' : '#cc0001', 0, i * h / 14, w, h / 14 + 0.5); R('#010066', 0, 0, w * 0.5, h * 8 / 14); disc(w * 0.2, h * 4 / 14, h * 0.19, '#ffcc00'); disc(w * 0.235, h * 4 / 14, h * 0.15, '#010066'); star(w * 0.3, h * 4 / 14, h * 0.15, '#ffcc00', 14, 0.5); break;
    case 'INA': R('#ce1126', 0, 0, w, h / 2); R('#ffffff', 0, h / 2, w, h / 2); break;
    case 'MYA': R('#fecb00', 0, 0, w, h / 3); R('#34b233', 0, h / 3, w, h / 3); R('#ea2839', 0, 2 * h / 3, w, h / 3); star(w / 2, h / 2, h * 0.3, '#ffffff'); break;
    case 'VIE': R('#da251d', 0, 0, w, h); star(w / 2, h / 2, h * 0.3, '#ffff00'); break;
    case 'PHI': R('#0038a8', 0, 0, w, h / 2); R('#ce1126', 0, h / 2, w, h / 2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.5, h / 2); g.lineTo(0, h); g.closePath(); g.fill(); disc(w * 0.16, h / 2, h * 0.11, '#fcd116'); break;
    case 'SGP': R('#ef3340', 0, 0, w, h / 2); R('#ffffff', 0, h / 2, w, h / 2); disc(w * 0.2, h * 0.25, h * 0.16, '#fff'); disc(w * 0.235, h * 0.25, h * 0.14, '#ef3340'); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; star(w * 0.27 + Math.cos(a) * h * 0.13, h * 0.25 + Math.sin(a) * h * 0.13, h * 0.035, '#fff'); } break;
    case 'JPN': R('#ffffff', 0, 0, w, h); disc(w / 2, h / 2, h * 0.3, '#bc002d'); break;
    case 'KOR': R('#ffffff', 0, 0, w, h); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.25, Math.PI, 0); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.25, 0, Math.PI); g.fill(); disc(w / 2 - h * 0.125, h / 2, h * 0.125, '#0047a0'); disc(w / 2 + h * 0.125, h / 2, h * 0.125, '#cd2e3a'); g.fillStyle = '#000'; for (const [x, y] of [[0.16, 0.2], [0.84, 0.2], [0.16, 0.8], [0.84, 0.8]]) g.fillRect(w * x - w * 0.05, h * y - h * 0.09, w * 0.1, h * 0.18); break;
    case 'CHN': R('#de2910', 0, 0, w, h); star(w * 0.17, h * 0.27, h * 0.16, '#ffde00'); for (const [x, y] of [[0.33, 0.1], [0.4, 0.2], [0.4, 0.36], [0.33, 0.46]]) star(w * x, h * y + h * 0.05, h * 0.05, '#ffde00'); break;
    case 'IND': R('#ff9933', 0, 0, w, h / 3); R('#ffffff', 0, h / 3, w, h / 3); R('#138808', 0, 2 * h / 3, w, h / 3); g.strokeStyle = '#000080'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, h * 0.14, 0, Math.PI * 2); g.stroke(); break;
    case 'LAO': R('#ce1126', 0, 0, w, h); R('#002868', 0, h / 4, w, h / 2); disc(w / 2, h / 2, h * 0.19, '#ffffff'); break;
    default: R('#888', 0, 0, w, h);
  }
}
const flagCache = {};
export function flagCanvas(code, w = 96, h = 64) {
  const key = `${code}${w}x${h}`;
  if (flagCache[key]) return flagCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawFlag(c.getContext('2d'), code, w, h);
  return (flagCache[key] = c);
}
export const flagDataURL = (code, w = 96, h = 64) => flagCanvas(code, w, h).toDataURL();

// ---------- garment colouring ----------
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function jerseyColorFn(kit, cs, rig, bind) {
  const P = C(kit.primary), S = C(kit.secondary), T = C(kit.trim);
  const K = rig.dims.scale;
  const cuffLen = cs.sleeveLen;
  const lfs = {};
  for (const sd of ['_l', '_r']) { const e = bind.frames['upperarm' + sd].inv.elements; lfs[sd] = (x, y, z) => e[1] * x + e[5] * y + e[9] * z + e[13]; }
  const neckEll = cs.neckEll, hem = cs.hemJ;
  return (x, y, z, nx, ny, nz) => {
    let c = P;
    const yr = (y - hem) / (1.5 * K - hem);
    switch (kit.pattern) {
      case 'sash': { const t = (x * 0.75 + (y - 1.22 * K) * 0.55) * (z > 0 ? 1 : -1); if (Math.abs(t) < 0.032 && y > hem + 0.02) c = S; else if (Math.abs(t) < 0.043 && y > hem + 0.02) c = T; break; }
      case 'stripes': { if (y > hem + 0.02 && Math.floor((x + 0.4) / 0.038) % 2 === 0) c = mix(P, S, 0.85); break; }
      case 'sides': { if (Math.abs(x) > 0.125 * K && y < 1.36 * K && Math.abs(z) < 0.09) c = S; break; }
      case 'chevron': { const t = y - 1.30 * K + Math.abs(x) * 0.55; if (t > -0.045 && t < -0.012 && z !== 0) c = S; else if (t >= -0.012 && t < 0.006) c = T; break; }
      case 'gradient': c = mix(P, S, sstep(0.55, 1.15, 1 - yr) * 0.55); break;
      default: break;
    }
    // sleeve cuffs
    for (const sd of ['_l', '_r']) {
      const ly = lfs[sd](x, y, z);
      if (ly < -cuffLen + 0.028 * K && ly > -cuffLen - 0.01 && ((x > 0) === (sd === '_l')) && Math.abs(x) > 0.16 * K) c = T;
    }
    const ne = neckEll(x, y, z);
    if (ne > -0.1 && ne < 0.32 && y > 1.3 * K) c = T;
    if (y < hem + 0.022 * K) c = T;
    // tiny fabric variation
    const v = 0.97 + 0.03 * Math.sin(x * 260 + y * 40) * Math.sin(y * 300 - z * 30);
    return [c[0] * v, c[1] * v, c[2] * v];
  };
}
export function shortsColorFn(kit, cs, rig) {
  const P = C(kit.shorts), S = C(kit.secondary), T = C(kit.trim);
  const K = rig.dims.scale; const waist = cs.waist, hem = cs.hem;
  return (x, y) => {
    let c = P;
    if (Math.abs(x) > 0.11 * K && y < waist - 0.03 && y > hem + 0.05) c = S;
    if (y > waist - 0.028) c = T;
    if (y < hem + 0.02) c = T;
    return c;
  };
}
export const socksColorFn = (kit, top) => { const P = C(kit.socks), T = C(kit.secondary); return (x, y) => (y > top - 0.03 ? T : P); };
export const bandColorFn = (hex) => { const c = C(hex); return () => c; };
export function shoeColorFn(kit) {
  const U = C(kit.shoe), S = C(kit.secondary), W = C(0xf4f4f4), D = C(0x1a1a1e);
  // tag by vertical position: sole is the lowest 2.2cm
  return (x, y, z) => (y < 0.021 ? W : y > 0.075 ? D : Math.abs(x) > 0.036 && y < 0.05 ? S : U);
}

// ---------- decal atlas: back name+number, chest number, shorts number ----------
export function decalAtlas(kit, number, name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const num = String(number);
  const col = '#' + new THREE.Color(kit.trim === kit.primary ? kit.secondary : kit.trim).getHexString();
  const outline = '#' + new THREE.Color(kit.primary).offsetHSL(0, 0, -0.25).getHexString();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (px) => `900 ${px}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  // back region: x 0..512
  g.font = font(64); g.lineWidth = 6; g.strokeStyle = outline; g.fillStyle = col;
  const nm = (name || '').toUpperCase();
  g.strokeText(nm, 256, 60, 470); g.fillText(nm, 256, 60, 470);
  g.font = font(num.length > 1 ? 330 : 380); g.lineWidth = 12;
  g.strokeText(num, 256, 300, 470); g.fillText(num, 256, 300, 470);
  // front region: x 512..768 (chest number, small)
  g.font = font(140); g.lineWidth = 8;
  g.strokeText(num, 640, 200); g.fillText(num, 640, 200);
  // shorts region: x 768..1024
  g.font = font(150); g.lineWidth = 8;
  g.strokeText(num, 896, 128); g.fillText(num, 896, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
