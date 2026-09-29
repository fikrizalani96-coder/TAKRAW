// Headless: how does an *assist-only* (no input) human team fare against the AI? Usage: node tests/humansim.mjs [seeds] [format] [mode]
import { Match } from '../src/game/match.js';
import { HumanCtl } from '../src/game/humanctl.js';
import '../src/anim/catalog.js';
const LISTS = { 1: { A: ['dig.foot', 'dig.thigh', 'dig.knee'], B: ['dig.chest', 'dig.shoulder', 'dig.back'], C: ['dig.head'] }, 2: { A: ['set.foot', 'dig.foot'], B: ['set.chest', 'dig.chest'], C: ['set.head', 'dig.head'] }, 3: { A: ['atk.kick', 'dig.foot', 'dig.thigh'], B: ['dig.chest', 'atk.head'], C: ['spike'] } };
// a competent human picks the technique the ball height calls for (approximated by what the AI planner would pick)
function btnFor(ctx, plan) { const sk = plan ? plan.skillKey : ''; for (const b of ['A', 'B', 'C']) if (LISTS[ctx][b].some((x) => sk.startsWith(x))) return b; return ctx === '3' ? 'C' : ctx === '2' ? 'C' : 'A'; }
const N = +process.argv[2] || 6, fmt = process.argv[3] || 'quick', mode = process.argv[4] || 'passive';
let wins = 0, pts = [0, 0], reasons = {}, lossKinds = {};
for (let seed = 1; seed <= N; seed++) {
  const humanTeam = mode === 'ai' ? -1 : 0;
  const m = new Match({ seed, format: fmt, difficulty: 'pro', headless: true, humanTeam, assist: 0.75 });
  const hc = humanTeam >= 0 && mode !== 'nohc' ? new HumanCtl(m, 0) : null;
  let ended = null; m.on('match-end', (e) => { ended = e; });
  m.on('point', (e) => { pts[e.winner]++; const k = `${e.winner === 0 ? 'H+' : 'H-'} ${e.reason} touches=${Math.min(e.rally, 5)}`; lossKinds[k] = (lossKinds[k] || 0) + 1; });
  m.start();
  const z = { A: false, B: false, C: false, D: false, switch: false };
  let cool = 0, sk = {}, whiffs = 0;
  m.on('whiff', (e) => { if (e.player.team === 0) { whiffs++; if (process.env.V) console.log('   whiff', m.time.toFixed(1), e.player.role, e.skill, (e.dist ?? -1).toFixed(2)); } });
  m.on('skill-start', (e) => { if (e.player.team === 0) sk[e.skill] = (sk[e.skill] || 0) + 1; });
  for (let i = 0; i < 60 * 1800 && !ended; i++) {
    if (hc) {
      const pr = { A: false, B: false, C: false, D: false, switch: false };
      cool -= 1 / 60;
      if (mode === 'press' && m.state === 'rally' && cool <= 0 && hc.active) {
        const c = hc.context, a = hc.active, pl = m.brains[0].plan;
        if ((c === '1' || c === '2' || c === '3') && !(pl && pl.started) && !a.busy && Math.hypot(m.ball.x - a.x, m.ball.z - a.z) < 4.5) { pr[btnFor(c, pl)] = true; cool = 0.25; }
      }
      if (mode === 'press' && m.state === 'serve-ready' && m.rules.serving === 0 && m.serveClock > 0.6) pr.A = true;
      if (mode === 'press' && m.state === 'toss' && m.serve && m.serve.released && !m.serve.kickStarted && m.time >= m.serve.arrive - m.serve.pick.tc) pr.A = true;
      hc.setInput(0, 0, pr, z); hc.update(1 / 60);
    }
    m.update(1 / 60);
  }
  if (mode !== 'x') console.log('   team0 skills', JSON.stringify(sk), 'whiffs', whiffs);
  if (ended) { if (ended.winner === 0) wins++; console.log(`seed ${seed}: winner ${ended.winner} sets ${ended.sets.join('-')} [${ended.history.map((h) => h.join('-')).join(', ')}]`); } else console.log(`seed ${seed}: unfinished`);
}
console.log(`team0 (${mode}) wins ${wins}/${N}; points ${pts.join(':')}`);
console.log(Object.entries(lossKinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}\t${k}`).join('\n'));
