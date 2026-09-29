// Team-symmetry check: AI-vs-AI over many seeds; neither side of the net may be favoured. Usage: node tests/symmetry.mjs [seeds]
import { Match } from '../src/game/match.js';
import '../src/anim/catalog.js';
const T = [{ whiff: 0, q: {}, n: {}, serveAce: 0, pts: 0, out: 0 }, { whiff: 0, q: {}, n: {}, serveAce: 0, pts: 0, out: 0 }];
const N = +process.argv[2] || 16;
for (let seed = 1; seed <= N; seed++) {
  const m = new Match({ seed, format: 'quick', difficulty: 'pro', headless: true, humanTeam: -1, firstServer: seed % 2 });
  let ended = null; m.on('match-end', (e) => { ended = e; });
  m.on('whiff', (e) => { T[e.player.team].whiff++; });
  m.on('touch', (e) => { const k = e.skill ? e.skill.split('.')[0] : e.kind; const t = T[e.team]; t.q[k] = (t.q[k] || 0) + (e.quality ?? 0); t.n[k] = (t.n[k] || 0) + 1; });
  m.on('point', (e) => { T[e.winner].pts++; if (/out/i.test(e.reason)) T[1 - e.winner].out++; });
  m.start();
  for (let i = 0; i < 60 * 1800 && !ended; i++) m.update(1 / 60);
}
const share = T[0].pts / (T[0].pts + T[1].pts);
console.log('team 0 point share', share.toFixed(3));
const qavg = (t) => { const o = T[t]; const ks = ['dig', 'set', 'spike']; return ks.reduce((a, k) => a + o.q[k] / o.n[k], 0) / ks.length; };
console.log('mean skill quality', qavg(0).toFixed(3), qavg(1).toFixed(3));
for (const t of [0, 1]) { const o = T[t]; console.log('team', t, 'pts', o.pts, 'whiffs', o.whiff, 'out(own errors)', o.out, Object.keys(o.n).map((k) => `${k}:${o.n[k]}@${(o.q[k] / o.n[k]).toFixed(2)}`).join(' ')); }

// Both sides of the net must behave identically (rotation symmetry): a regression here means a mirrored-heading bug.
if (Math.abs(share - 0.5) > 0.09 || Math.abs(qavg(0) - qavg(1)) > 0.05) { console.log('ASYMMETRY between the two sides of the court'); process.exit(1); }
console.log('SYMMETRY OK');
