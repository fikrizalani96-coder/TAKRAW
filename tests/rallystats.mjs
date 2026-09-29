// Rally-length histogram and how spikes end (AI vs AI). Usage: node tests/rallystats.mjs [seeds] [format]
import { Match } from '../src/game/match.js';
import '../src/anim/catalog.js';
const N = +process.argv[2] || 8, fmt = process.argv[3] || 'istaf';
const hist = {}; let spikes = 0, spikeKills = 0, blocks = 0, blockSolid = 0, digsOfSpike = 0, rallies = 0;
for (let seed = 1; seed <= N; seed++) {
  const m = new Match({ seed, format: fmt, difficulty: 'pro', headless: true, humanTeam: -1 });
  let ended = null; m.on('match-end', (e) => { ended = e; });
  let lastSpike = null;
  m.on('touch', (e) => {
    if (e.skill && e.skill.startsWith('spike')) { spikes++; lastSpike = { team: e.team, t: m.time }; }
    else if (lastSpike && e.team !== lastSpike.team && m.time - lastSpike.t < 2 && !e.block && e.kind !== 'block') { digsOfSpike++; lastSpike = null; }
    if (e.block) { blocks++; if (e.solid) blockSolid++; }
  });
  m.on('point', (e) => { rallies++; hist[e.rally] = (hist[e.rally] || 0) + 1; });
  m.start();
  for (let i = 0; i < 60 * 3600 && !ended; i++) m.update(1 / 60);
}
const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
console.log('rallies', rallies, 'touches-at-end histogram:', keys.map((k) => `${k}:${hist[k]}`).join(' '));
console.log(`spikes ${spikes}, dug/received ${digsOfSpike} (${(100 * digsOfSpike / spikes).toFixed(0)}%), blocks ${blocks} (solid ${blockSolid})`);
