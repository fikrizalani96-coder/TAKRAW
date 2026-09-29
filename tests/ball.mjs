import { World, BallState } from '../src/game/ball.js';
import { SURFACES } from '../src/game/config.js';
const w = new World({ surface: SURFACES.official });
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL', m); fails++; } else console.log('ok  ', m); };
// 1. drop from 2 m: time ~ sqrt(2h/g) with a little drag; bounce restitution
{ const s = new BallState(); s.y = 2; s.z = 2; let t = 0, bounce = null, ev = [];
  while (t < 2) { ev.length = 0; w.step(s, 1 / 240, ev); t += 1 / 240; if (ev.some((e) => e.type === 'floor')) { bounce = { t, vy: s.vy }; break; } }
  ok(bounce && Math.abs(bounce.t - Math.sqrt(2 * (2 - w.r) / 9.81)) < 0.03, `drop 2m lands at ${bounce?.t.toFixed(3)}s (ballistic ${(Math.sqrt(2*(2-w.r)/9.81)).toFixed(3)})`);
  ok(bounce && bounce.vy > 0 && bounce.vy < 6.3 * 0.7, `bounce speed ${bounce?.vy.toFixed(2)} (restitution 0.66 of ~6.2)`); }
// 2. serve over the net: from (0,1.0,+4.25) to landing (0.5,-4) in 0.75 s; clears the net?
{ const v0 = w.solveOverNet(0, 1.0, 4.25, 0.5, w.r, -4.0); console.log(`   solveOverNet: T=${v0.T.toFixed(2)} clear=${v0.clear.toFixed(2)} apex=${v0.apex.toFixed(2)}`); const v = v0;
  const s = new BallState(); s.x = 0; s.y = 1; s.z = 4.25; s.vx = v.vx; s.vy = v.vy; s.vz = v.vz;
  const p = w.predict(s, 3);
  ok(p.landing && Math.hypot(p.landing.x - 0.5, p.landing.z + 4.0) < 0.15, `flight-time solver lands at (${p.landing?.x.toFixed(2)}, ${p.landing?.z.toFixed(2)}) target (0.5,-4.0)`);
  ok(p.netCross && p.netCross.y > w.netTop, `crosses net at y=${p.netCross?.y.toFixed(2)}m (net ${w.netTop}m)`); }
// 3. spike: from (1.5, 2.6, 0.5) at 22 m/s to (−1,−4)
{ const sol = w.solveSpeed(1.5, 2.6, 0.5, -1.0, -4.0, 22);
  ok(!!sol, 'spike solution exists');
  if (sol) { const s = new BallState(); s.x = 1.5; s.y = 2.6; s.z = 0.5; s.vx = sol.vx; s.vy = sol.vy; s.vz = sol.vz; const p = w.predict(s, 3);
    ok(Math.hypot(p.landing.x + 1, p.landing.z + 4) < 0.35, `spike lands (${p.landing.x.toFixed(2)},${p.landing.z.toFixed(2)}) T=${sol.T.toFixed(2)}s pitch ${(sol.pitch*57.3).toFixed(0)}deg clear ${sol.clearance.toFixed(2)}m`); } }
// 4. ball into the net bounces back / stops
{ const s = new BallState(); s.x = 0; s.y = 1.2; s.z = 2; s.vz = -15; s.vy = 1; let t = 0, hit = false, ev = [];
  while (t < 1) { ev.length = 0; w.step(s, 1 / 240, ev); t += 1 / 240; if (ev.some((e) => e.type === 'net')) hit = true; }
  ok(hit && s.z > 0, `ball into net mesh event=${hit} stays on hitter's side z=${s.z.toFixed(2)}`); }
// 5. cord: ball just grazing the top tape
{ const s = new BallState(); s.x = 0; s.y = w.netTop + 0.02; s.z = 1.5; s.vz = -12; s.vy = 0; let t = 0, cord = false, ev = [];
  while (t < 1) { ev.length = 0; w.step(s, 1 / 240, ev); t += 1 / 240; if (ev.some((e) => e.type === 'cord')) cord = true; }
  ok(cord, 'top-cord contact detected'); }
// 6. spin: topspin curves down faster than no spin
{ const mk = (wx) => { const s = new BallState(); s.y = 2.5; s.z = 3; s.vz = -20; s.vy = 3; s.wx = wx; return w.predict(s, 3).landing.z; };
  const a = mk(0), b = mk(-60), c = mk(60); console.log(`   landing z: no-spin ${a.toFixed(2)}, wx=-60 ${b.toFixed(2)}, wx=+60 ${c.toFixed(2)}`);
  ok(Math.abs(a - b) > 0.05, 'Magnus spin changes the trajectory'); }
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
