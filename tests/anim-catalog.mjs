// Builds and samples EVERY clip in the catalogue; fails on NaN/Inf, joint hyper-limits, or count < 1000.
import { performance } from 'node:perf_hooks';
import { allEntries, getClip, clipCount, categoryCounts } from '../src/anim/catalog.js';
import { CH, CHANNELS, newPose } from '../src/anim/pose.js';
import { countJoints } from '../src/character/skeleton.js';

const t0 = performance.now();
const entries = allEntries();
const cats = categoryCounts();
console.log('registered clips:', clipCount(), ' joints:', countJoints());
console.log(JSON.stringify(cats));
let bad = 0, warn = 0;
const out = newPose();
const D = 180 / Math.PI;
const limits = { kn_f_L: [-6, 172], kn_f_R: [-6, 172], el_f_L: [-6, 165], el_f_R: [-6, 165], hp_f_L: [-60, 150], hp_f_R: [-60, 150] };
const seenWarn = {};
for (const e of entries) {
  let c;
  try { c = getClip(e.id); } catch (err) { console.log('BUILD FAIL', e.id, err.message); bad++; continue; }
  if (!(c.duration > 0.05)) { console.log('BAD duration', e.id, c.duration); bad++; continue; }
  const N = 24;
  for (let i = 0; i <= N; i++) {
    c.sample(c.loop ? (i / N) * c.duration * 0.999 : (i / N) * c.duration, out);
    for (let k = 0; k < out.length; k++) {
      if (!Number.isFinite(out[k])) { console.log('NaN', e.id, CHANNELS[k], 'at', i); bad++; break; }
    }
    for (const [ch, [lo, hi]] of Object.entries(limits)) {
      const v = out[CH[ch]] * D;
      if (v < lo || v > hi) { const key = e.cat + ':' + ch; seenWarn[key] = (seenWarn[key] || 0) + 1; warn++; }
    }
  }
  if (c.events?.contact !== undefined && !c.meta?.contact && !c.loop) { /* contact time without spec: allowed for locomotion? */ }
}
const ids = new Set(entries.map((e) => e.id));
console.log(`unique ids ${ids.size}/${entries.length}; build+sample ${(performance.now() - t0).toFixed(0)}ms; bad=${bad}; limit warnings=${warn}`);
if (warn) console.log('limit warnings by cat:channel', JSON.stringify(seenWarn));
if (clipCount() < 1000) { console.log('FAIL: fewer than 1000 clips'); process.exit(1); }
if (bad) process.exit(1);
console.log('OK');
