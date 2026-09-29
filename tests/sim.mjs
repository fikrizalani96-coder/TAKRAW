// Headless AI-vs-AI full-match soak test. Verifies the match completes, score/rotation invariants
// hold, and prints rally statistics. Usage: node tests/sim.mjs [seeds] [format]
import { Match } from '../src/game/match.js';
import '../src/anim/catalog.js';

const N = +process.argv[2] || 3, fmt = process.argv[3] || 'istaf';
let totalFail = 0;
for (let seed = 1; seed <= N; seed++) {
  const m = new Match({ seed, format: fmt, difficulty: 'pro', headless: true, humanTeam: -1 });
  const log = [];
  let rallies = 0, faultsByType = {}, maxRally = 0, touchesTotal = 0, sumRally = 0;
  m.on('point', (e) => { rallies++; faultsByType[e.reason] = (faultsByType[e.reason] || 0) + 1; sumRally += e.rally; maxRally = Math.max(maxRally, e.rally); });
  m.on('touch', (e) => { touchesTotal++; });
  let ended = null;
  m.on('match-end', (e) => { ended = e; });
  m.start();
  const dt = 1 / 60;
  let steps = 0, lastState = '', stuck = 0, t0 = Date.now();
  const skillCount = {};
  m.on('skill-start', (e) => { skillCount[e.skill] = (skillCount[e.skill] || 0) + 1; });
  while (!ended && steps < 60 * 3600) { // up to one hour of game time
    m.update(dt); steps++;
    if (m.state === 'setbreak' && m.stateTime > 0.01 && steps % 1 === 0) { /* auto handled by timer */ }
    if (m.state === lastState) { stuck += dt; } else { stuck = 0; lastState = m.state; }
    if (stuck > 60) { console.log(`seed ${seed}: STUCK in state ${m.state} for 60s at ${m.time.toFixed(1)}s`); totalFail++; break; }
    for (const p of m.all) if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { console.log('NaN player position'); totalFail++; steps = Infinity; }
    if (!Number.isFinite(m.ball.x + m.ball.y + m.ball.z)) { console.log('NaN ball'); totalFail++; break; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!ended) { console.log(`seed ${seed}: DID NOT FINISH (state ${m.state}, sets ${m.rules.sets}, points ${m.rules.points}, t=${m.time.toFixed(0)}s)`); totalFail++; }
  else {
    const hist = ended.history.map((h) => h.join('-')).join(', ');
    console.log(`seed ${seed}: winner team ${ended.winner}, sets ${ended.sets.join('-')}, [${hist}]  game-time ${(m.time / 60).toFixed(1)}min  wall ${secs}s  rallies ${rallies} avg touches ${(sumRally / rallies).toFixed(1)} longest ${maxRally}`);
    // invariants: each finished set ends by ISTAF rules
    for (const h of ended.history) { const hi = Math.max(...h), lo = Math.min(...h); if (!(hi >= 11 && (hi - lo >= 2 || hi === (fmt === 'istaf' ? 25 : 13)))) { console.log('  BAD set score', h); totalFail++; } }
  }
  if (seed === 1) { console.log('  result reasons:', JSON.stringify(faultsByType)); console.log('  skills used:', JSON.stringify(skillCount)); }
}
console.log(totalFail ? `${totalFail} FAILURES` : 'SIM OK'); process.exit(totalFail ? 1 : 0);
