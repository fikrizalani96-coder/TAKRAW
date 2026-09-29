import { MatchRules, RallyRules } from '../src/game/rules.js';
let fails = 0; const ok = (c, m) => { if (!c) { console.log('FAIL', m); fails++; } else console.log('ok  ', m); };
// 21-point set to 21-19
{ const r = new MatchRules('istaf'); let last;
  for (let i = 0; i < 19; i++) { r.awardPoint(0); r.awardPoint(1); }
  ok(r.points[0] === 19 && r.points[1] === 19, 'tied at 19-19');
  r.awardPoint(0); last = r.awardPoint(0);
  ok(!last.setOver || r.points[0] === 21, `21-19 -> set over (${r.points})`);
  ok(last.setOver && r.sets[0] === 1, 'set won by team 0'); }
// deuce at 20-20 needs a 2-point lead; cap at 25
{ const r = new MatchRules('istaf');
  for (let i = 0; i < 20; i++) { r.awardPoint(0); r.awardPoint(1); }
  ok(r.isDeuce, 'deuce at 20-20');
  let x = r.awardPoint(0); ok(!x.setOver, '21-20 is not a win');
  x = r.awardPoint(1); ok(!x.setOver, '21-21 continues');
  // run to 24-24 then 25-24 wins by cap
  r.awardPoint(0); r.awardPoint(1); r.awardPoint(0); r.awardPoint(1); r.awardPoint(0); r.awardPoint(1);
  ok(r.points[0] === 24 && r.points[1] === 24, 'reached 24-24');
  x = r.awardPoint(1); ok(x.setOver && r.points[1] === 25, '25-24 wins at the cap'); }
// service rotation: 3 serves then change; alternates at deuce
{ const r = new MatchRules('istaf', { firstServer: 0 });
  const seq = []; for (let i = 0; i < 6; i++) { seq.push(r.serving); r.awardPoint(i % 2); }
  ok(JSON.stringify(seq) === '[0,0,0,1,1,1]', `service rotates every 3 serves: ${seq}`);
  const d = new MatchRules('istaf', { firstServer: 0 });
  for (let i = 0; i < 20; i++) { d.awardPoint(0); d.awardPoint(1); }
  const s1 = d.serving; d.awardPoint(0); const s2 = d.serving; d.awardPoint(1); const s3 = d.serving;
  ok(s1 !== s2 && s2 !== s3, `deuce: service alternates every point (${s1},${s2},${s3})`); }
// third set is to 15, deuce 14-14, cap 17, sides change at 8
{ const r = new MatchRules('istaf');
  const win = (t, n) => { for (let i = 0; i < n; i++) r.awardPoint(t); };
  win(0, 21); r.nextSet(); ok(r.setIndex === 1, 'set 2 begins'); win(1, 21); r.nextSet(0);
  ok(r.deciding && r.target === 15 && r.cap === 17, `third set target ${r.target} cap ${r.cap}`);
  const before = r.sidesFlipped; let changed = false;
  for (let i = 0; i < 8; i++) { const x = r.awardPoint(0); if (x.changeSides) changed = true; }
  ok(changed && r.sidesFlipped !== before, 'sides change when a team reaches 8 in the deciding set');
  for (let i = 0; i < 14; i++) r.awardPoint(1);
  ok(r.points[0] === 8 && r.points[1] === 14, 'score 8-14'); }
// rally: 4 touches fault, same-player rule, block does not count
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0);
  y.serveTouch(0, 'a'); y.ballCrossed(0.5, 2, 1); y.touch(1, 'p'); y.touch(1, 'q'); y.touch(1, 'r'); const f = y.touch(1, 'p');
  ok(f && f.winner === 0 && /Four/.test(f.reason), 'fourth touch is a fault'); }
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0);
  y.serveTouch(0, 'a'); y.ballCrossed(0, 2, 1); y.touch(1, 'p'); y.touch(1, 'p'); const f = y.touch(1, 'p');
  ok(f && /three times/.test(f.reason), 'three successive touches by one player is a fault'); }
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0);
  y.serveTouch(0, 'a'); y.ballCrossed(0, 2, 1); y.touch(1, 'p'); y.touch(1, 'q'); y.touch(1, 'r'); y.touch(0, 'x'); y.touch(1, 'p', true);
  ok(y.count === 0 && !y.result, 'block touch does not count as a touch'); }
// serve faults
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0); y.serveTouch(0, 'a'); const f = y.ballLanded(0, 3, (s) => (s > 0 ? 0 : 1));
  ok(f.winner === 1 && /did not cross/.test(f.reason), 'serve landing on own side is a fault'); }
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0); y.serveTouch(0, 'a'); y.ballCrossed(0, 2, 1); const f = y.ballLanded(0.2, -3, (s) => (s > 0 ? 0 : 1));
  ok(f.winner === 0, 'serve landing in opposing court wins the point'); }
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0); y.serveTouch(0, 'a'); y.ballCrossed(0, 2, 1); const f = y.ballLanded(3.6, -3, (s) => (s > 0 ? 0 : 1));
  ok(f.winner === 1, 'serve landing out loses the point'); }
{ const r = new MatchRules('istaf'); const y = new RallyRules(r, 0); y.serveTouch(0, 'a'); const f = y.ballCrossed(3.4, 2, 1);
  ok(f && f.winner === 1, 'crossing outside the net tape is a fault'); }
console.log(fails ? `${fails} FAILED` : 'ALL OK'); process.exit(fails ? 1 : 0);
