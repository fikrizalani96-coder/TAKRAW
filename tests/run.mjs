// Test runner: node tests/run.mjs [--browser]
// Headless unit/soak suites always run; --browser additionally drives the real app in headless Chromium
// (needs `npm run dev` on :5173 and a Chromium at /opt/pw-browsers).
import { spawnSync } from 'node:child_process';
const browser = process.argv.includes('--browser');
const suites = [
  ['skeleton / rig', ['tests/skel.mjs']],
  ['animation catalogue (1000+ clips)', ['tests/anim-catalog.mjs']],
  ['ball physics', ['tests/ball.mjs']],
  ['ISTAF rules', ['tests/rules.mjs']],
  ['AI-vs-AI match soak (ISTAF, 2 seeds)', ['tests/sim.mjs', '2', 'istaf']],
  ['AI-vs-AI match soak (Kampung, 2 seeds)', ['tests/sim.mjs', '2', 'kampung']],
  ['court symmetry (AI-vs-AI, 32 seeds)', ['tests/symmetry.mjs', '32']],
  ['assist-only human team vs AI', ['tests/humansim.mjs', '3', 'quick', 'passive']],
];
if (browser) {
  suites.push(['app boots + plays (official)', ['tests/play.mjs', 'auto=1&quality=low', 'tests/out/run_off', '540', '960', '8', '8']]);
  suites.push(['app boots + plays (kampung)', ['tests/play.mjs', 'auto=1&env=kampung&quality=low', 'tests/out/run_kmp', '540', '960', '8', '8']]);
  suites.push(['human control path', ['tests/human.mjs', 'bot', '60']]);
  suites.push(['instant replay', ['tests/replay.mjs', '1280', '720', 'official']]);
  suites.push(['title backdrop', ['tests/title.mjs', '1280', '720', 'tests/out/run_title.png', '9000']]);
  suites.push(['menus walk-through', ['tests/menus.mjs', '390', '844', 'tests/out/run_menu']]);
  suites.push(['results + rematch', ['tests/results.mjs', '1280', '720', 'tests/out/run_results.png']]);
  suites.push(['animation lab', ['tests/lab.mjs', '1280', '720', 'gulung', 'tests/out/run_lab.png']]);
}
let failed = 0;
for (const [name, args] of suites) {
  process.stdout.write(`\n=== ${name}\n`);
  const r = spawnSync('node', args, { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`!!! FAILED: ${name} (exit ${r.status})`); }
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nALL SUITES PASSED');
process.exit(failed ? 1 : 0);
