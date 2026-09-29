// End-to-end test of the human-control path in the real app (headless Chromium).
// A scripted "player" drives HumanCtl exactly like the input layer would (stick + A/B/C/D presses).
// Usage: node tests/human.mjs [mode=bot|passive|serveonly|mixed] [seconds=240] [env=official] [format=quick]
import { chromium } from 'playwright-core';
const [,, mode = 'bot', secs = '240', env = 'official', format = 'quick'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
await p.goto(`http://localhost:5173/?auto=1&human=1&quality=low&shot=1&format=${format}&env=${env}`);
await p.waitForFunction('window.__advance && window.__stgc && window.__stgc.hc', null, { timeout: 240000 });

const res = await p.evaluate(({ mode, secs }) => {
  const g = window.__stgc, m = g.match, hc = g.hc, view = g.view;
  const step = 1 / 60;
  const LISTS = { 1: { A: ['dig.foot', 'dig.thigh', 'dig.knee'], B: ['dig.chest', 'dig.shoulder', 'dig.back'], C: ['dig.head'] }, 2: { A: ['set.foot', 'dig.foot'], B: ['set.chest', 'dig.chest'], C: ['set.head', 'dig.head'] }, 3: { A: ['atk.kick', 'dig.foot', 'dig.thigh'], B: ['dig.chest', 'atk.head'], C: ['spike'] } };
  const btnFor = (c, plan) => { const sk = plan ? plan.skillKey : ''; for (const b of ['A', 'B', 'C']) if (LISTS[c][b].some((x) => sk.startsWith(x))) return b; return c === '3' ? 'C' : c === '2' ? 'C' : 'A'; };
  const log = { pressed: { A: 0, B: 0, C: 0, D: 0 }, contexts: {}, humanSkills: {}, aiSkills: {}, serves: { human: 0, kicks: 0, whiffs: 0, autoKicks: 0 }, reachFail: 0, blocks: 0, states: {}, points: [], faults: {}, stuck: 0 };
  m.on('skill-start', (e) => { const tgt = e.player.team === 0 ? log.humanSkills : log.aiSkills; tgt[e.skill] = (tgt[e.skill] || 0) + 1; if (e.skill.startsWith('block')) log.blocks++; });
  m.on('skill-start', (e) => { const pl = e.player.busy && e.player.busy.plan; if (pl && pl.stand && e.player.team === 0) (log.starts ||= []).push(`${m.time.toFixed(1)} ${e.player.role} ${e.skill} standErr=${Math.hypot(e.player.x - pl.stand.x, e.player.z - pl.stand.z).toFixed(2)} lead=${(e.player.busy.tContact - m.time).toFixed(2)} human=${e.player.human} armed=${!!pl.armed}`); });
  m.on('reach-fail', () => log.reachFail++);
  m.on('whiff', (e) => { log.serves.whiffs++; (log.whiffList ||= []).push(`${m.time.toFixed(1)} t${e.player.team} ${e.player.role} ${e.skill || 'serve'} d=${e.dist ? e.dist.toFixed(2) : '-'} st=${m.state}`); });
  m.on('touch', (e) => { (log.touches ||= []).push(`${m.time.toFixed(1)} t${e.team} ${e.skill || e.kind} q=${(e.quality ?? 0).toFixed(2)}`); });
  m.on('serve-start', () => { if (m.serve && m.serve.human) log.serves.human++; });
  m.on('point', (e) => { log.points.push([e.winner, e.reason]); log.faults[e.reason] = (log.faults[e.reason] || 0) + 1; });
  let pressCool = 0, serveKind = 0, lastProgress = m.time, lastSig = '';
  let tEnd = m.time + secs;
  const hold = { A: false, B: false, C: false, D: false };
  let nonFinite = 0;
  for (let i = 0; m.time < tEnd && m.state !== 'matchend'; i++) {
    const pressed = { A: false, B: false, C: false, D: false, switch: false };
    let mx = 0, my = 0;
    const s = hc.side; const a0 = hc.active, pl0 = m.brains[0].plan;
    if (mode !== 'passive') {
      const a = hc.active, pl = m.brains[0].plan;
      // stick: walk toward the suggested stand spot (screen coords: mx = s*wx, my = -s*wz)
      if (m.state === 'rally' && a && pl && pl.player === a && pl.stand) {
        const dx = pl.stand.x - a.x, dz = pl.stand.z - a.z, d = Math.hypot(dx, dz);
        if (d > 0.08) { const k = Math.min(1, d * 2); mx = s * dx / d * k; my = -s * dz / d * k; }
      }
      pressCool -= step;
      if (m.state === 'serve-ready' && m.rules.serving === 0 && pressCool <= 0 && m.serveClock > 0.6) {
        pressed['ABC'[serveKind++ % 3]] = true; pressCool = 0.5;
      } else if (m.state === 'toss' && m.rules.serving === 0 && m.serve && m.serve.released && !m.serve.kickStarted) {
        const ideal = m.serve.arrive - m.serve.pick.tc;
        if (mode === 'serveonly' || mode === 'bot' || mode === 'mixed') {
          // press at the ideal moment, with a little human-like jitter (mixed: sometimes late/never to exercise auto-kick)
          const jit = mode === 'mixed' ? ((m.stats && m.stats.total ? 0 : 0) + ((i % 3) - 1) * 0.06) : 0;
          if (m.time >= ideal + jit && !(mode === 'mixed' && (i % 7 === 0))) pressed['A'] = true;
        }
      } else if (m.state === 'rally' && a && pressCool <= 0 && mode !== 'serveonly') {
        const ctx = hc.context;
        if (ctx === '1' || ctx === '2' || ctx === '3') {
          const pl2 = m.brains[0].plan;
          // press the button around when the ball is ~0.35s from the player's reach
          const t2 = m.predictBall();
          const dball = Math.hypot(m.ball.x - a.x, m.ball.z - a.z);
          if (!(pl2 && pl2.started) && !a.busy && dball < 4.5) {
            const btn = btnFor(ctx, pl2);
            pressed[btn] = true; pressCool = 0.25;
          }
        } else if (ctx === 'defend') {
          const bl = m.brains[0].blocks.find((x) => x.player === a && !x.started);
          if (bl) { const ddx = bl.x - a.x; mx = s * Math.max(-1, Math.min(1, ddx * 2)); if (Math.abs(ddx) < 0.4 && bl.tContact - m.time < 0.9) { pressed['C'] = true; pressCool = 0.6; } }
        }
      }
    }
    for (const k of ['A', 'B', 'C', 'D']) if (pressed[k]) log.pressed[k]++;
    log.contexts[hc.context] = (log.contexts[hc.context] || 0) + 1;
    log.states[m.state] = (log.states[m.state] || 0) + 1;
    if (m.state === 'rally' && a0 && pl0 && pl0.player === a0 && !pl0.started && i % 6 === 0) { (log.trace ||= []).push(`${m.time.toFixed(2)} ${a0.role} dStand=${Math.hypot(a0.x - pl0.stand.x, a0.z - pl0.stand.z).toFixed(2)} v=${a0.speed.toFixed(2)} in=(${mx.toFixed(2)},${my.toFixed(2)}) tStartIn=${(pl0.tStart - m.time).toFixed(2)} armed=${!!pl0.armed} sk=${pl0.skillKey} hcMove=${hc.move === undefined}`); if (log.trace.length > 400) log.trace.shift(); }
    hc.setInput(mx, my, pressed, hold);
    hc.update(step); m.update(step); view.update(step);
    // sanity
    const bl = m.ball; if (!Number.isFinite(bl.x + bl.y + bl.z)) { nonFinite++; break; }
    for (const t of [0, 1]) for (const q of m.players[t]) if (!Number.isFinite(q.x + q.z + q.heading)) nonFinite++;
    // stuck watchdog: state+points+touches unchanged for 40 s of game time
    const sig = m.state + '|' + m.rules.points.join('-') + '|' + m.rallyTouches;
    if (sig !== lastSig) { lastSig = sig; lastProgress = m.time; }
    if (m.time - lastProgress > 40) { log.stuck++; break; }
  }
  log.time = +m.time.toFixed(1); log.state = m.state; log.score = m.rules.points.join('-'); log.sets = m.rules.sets.join('-'); log.nonFinite = nonFinite;
  log.rallyLongest = m.longestRally;
  return log;
}, { mode, secs: +secs });

console.log(JSON.stringify(res, null, 1));
if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; } else console.log('no console errors');
await b.close();
