// Sepak Takraw Game Challenge - application shell: renderer, menus, match lifecycle, main loop.
import * as THREE from 'three';
import './ui/style.css';
import { Input } from './engine/input.js';
import { GameAudio } from './engine/audio.js';
import { CameraRig, CAMERA_MODES } from './engine/camera.js';
import { HUD } from './ui/hud.js';
import { Menu, store } from './ui/menu.js';
import { Match } from './game/match.js';
import { HumanCtl } from './game/humanctl.js';
import { GameView } from './game/view.js';
import { TEAMS } from './character/kits.js';
import './anim/catalog.js';

const root = document.getElementById('app');
const canvas = document.getElementById('gl');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const params = new URLSearchParams(location.search);

let renderer = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 300);
const audio = new GameAudio();
const camRig = new CameraRig(camera);
const input = new Input(root);
const hud = new HUD(document.getElementById('hud'));
const app = { renderer: null, scene, camera, audio, camRig, quality: 'medium', showAids: store.get('settings', { aids: true }).aids !== false };
let game = null, paused = false, running = false, lastCfg = null, over = false, labActive = false;
const menu = new Menu(document.getElementById('menus'), {
  click: () => { audio.init(); audio.resume(); audio.click(); },
  start: (cfg) => startGame(cfg),
  lab: () => openLab(),
  settings: (s) => { audio.setVolume(s.volume); app.showAids = s.aids; },
  pauseAction: (a) => pauseAction(a),
  resultAction: (a) => { if (a === 'again') startGame(lastCfg); else { endGame(); menu.title(); } },
});

function pickQuality(q) {
  if (q && q !== 'auto') return q;
  if (isTouch) return 'low';
  return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
}
function ensureRenderer(quality) {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: !!params.get('shot') });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02; renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.renderer = renderer; onResize();
}
function onResize() {
  if (!renderer) return;
  const q = app.quality; const pr = Math.min(devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1.25);
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 200));

async function startGame(cfg) {
  endGame();
  lastCfg = cfg;
  audio.init(); audio.resume(); audio.setVolume(store.get('settings', { volume: 0.8 }).volume);
  app.quality = pickQuality(cfg.quality);
  ensureRenderer(app.quality); onResize();
  menu.loading('Preparing the venue…');
  await new Promise((r) => setTimeout(r, 30));
  const seed = (Math.random() * 1e6) | 0;
  const view = new GameView(app, { env: cfg.env, teams: cfg.teams, gender: cfg.gender, seed });
  try { await view.init((t, f) => menu.progress(t, f)); }
  catch (e) { console.error(e); menu.overlay(`<h1 style="font-size:28px">Could not start</h1><p class="sub">${String(e.message || e)}</p><button class="btn" data-a="b">BACK</button>`); menu.bind(menu.layer, '[data-a]', () => menu.title()); return; }
  const humanTeam = cfg.spectate ? -1 : 0;
  const match = new Match({ format: cfg.format, surface: cfg.env, gender: cfg.gender, teams: cfg.teams.map((c) => ({ code: c, name: TEAMS[c].name, fame: TEAMS[c].fame })), humanTeam, difficulty: cfg.difficulty, assist: cfg.assist ?? 0.75, seed, firstServer: Math.random() < 0.5 ? 0 : 1 });
  view.bindMatch(match);
  const hc = humanTeam >= 0 ? new HumanCtl(match, humanTeam) : null;
  hud.setTeams(cfg.teams);
  hookEvents(match, cfg);
  game = { view, match, hc, cfg };
  window.__stgc = game; window.__camRig = camRig; window.__camera = camera;
  // test hook: advance the simulation deterministically without rendering
  window.__advance = (sec, step = 1 / 30) => { const n = Math.round(sec / step); for (let i = 0; i < n; i++) { if (hc) hc.update(step); match.update(step); view.update(step); } camRig.update(0.3, match.ball, hc ? hc.active : null, camera.aspect); };
  camRig.side = 1; camRig.setMode('broadcast'); camRig.override = null; camRig.reset(); camRig.maxHeight = view.env && view.env.kampung ? 60 : 11.5;
  match.start();
  menu.clear(); over = false; paused = false;
  input.showTouch(isTouch && !!hc);
  if (!running) { running = true; requestAnimationFrame(frame); }
  const first = match.rules.serving;
  hud.toast('KICK OFF', `${TEAMS[cfg.teams[first]].name} to serve`, '', 2200);
}
function endGame() {
  if (!game) return;
  const { view } = game;
  scene.traverse((o) => { if (o.isMesh || o.isLine || o.isSprite) { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose?.(); } });
  while (scene.children.length) scene.remove(scene.children[0]);
  game = null; window.__stgc = null; input.showTouch(false);
}

function hookEvents(match, cfg) {
  const nm = (t) => TEAMS[cfg.teams[t]].name;
  match.on('callscore', (e) => { hud.toast(`${e.score[0]} – ${e.score[1]}`, `${nm(e.serving)} serve${match.rules.isDeuce ? ' · DEUCE' : ''}`, '', 1600); });
  match.on('point', (e) => {
    const mine = cfg.spectate ? null : 0;
    hud.toast(`${TEAMS[cfg.teams[e.winner]].code} POINT`, e.reason, mine === null ? '' : e.winner === mine ? 'win' : 'bad', 2400);
  });
  match.on('set-end', (e) => hud.toast('SET WON', `${nm(e.winner)} · ${e.points[0]}-${e.points[1]}`, 'win', 3600));
  match.on('change-sides', () => hud.toast('CHANGE SIDES', 'Deciding set · 8 points', '', 2200));
  match.on('side-change', () => hud.toast('NEXT SET', 'Teams change sides', '', 2200));
  match.on('match-end', (e) => {
    over = true;
    const info = { winnerName: nm(e.winner).toUpperCase(), sets: e.sets, history: e.history, stats: match.stats, longest: match.longestRally, names: [TEAMS[cfg.teams[0]].code, TEAMS[cfg.teams[1]].code] };
    setTimeout(() => { if (game) { input.showTouch(false); menu.results(info); } }, 2600);
  });
  match.on('reach-fail', () => hud.toast('TOO FAR!', 'Move closer to the ring', 'bad', 700));
}

function pauseAction(a) {
  if (a === 'resume') { paused = false; menu.clear(); }
  else if (a === 'camera') { camRig.cycle(); menu.pause(pauseState()); }
  else if (a === 'aids') { app.showAids = !app.showAids; store.set('settings', { ...store.get('settings', {}), aids: app.showAids }); menu.pause(pauseState()); }
  else if (a === 'sound') { audio.setEnabled(!audio.enabled); menu.pause(pauseState()); }
  else if (a === 'help') { menu.help(); }
  else if (a === 'quit') { endGame(); paused = false; menu.title(); }
}
const pauseState = () => ({ cameraMode: camRig.mode, aids: app.showAids, sound: audio.enabled });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (labActive) return;
  const inp = input.poll();
  if (!game) { if (renderer) renderer.render(scene, camera); return; }
  const { match, view, hc } = game;
  if (inp.pressed.pause && !over) { paused = !paused; if (paused) menu.pause(pauseState()); else menu.clear(); }
  if (inp.pressed.camera) { hud.toast(camRig.cycle().toUpperCase() + ' CAMERA', '', '', 900); }
  if (inp.pressed.aids) app.showAids = !app.showAids;
  if (inp.pressed.mute) audio.setEnabled(!audio.enabled);
  if (!paused) {
    if (hc) { hc.setInput(inp.mx, inp.my, inp.pressed, inp.held); hc.update(dt); }
    match.update(dt);
    view.update(dt);
    hud.update(match, hc);
    if (hc) input.setLabels(hc.labels);
    audio.update(dt, view.excite);
  }
  const human = hc ? hc.active : null;
  camRig.side = hc ? hc.side : 1;
  camRig.update(dt, match.ball, human, camera.aspect);
  renderer.render(scene, camera);
}

async function openLab() {
  audio.init(); audio.resume();
  ensureRenderer('medium'); app.quality = 'medium';
  menu.loading('Opening the Animation Lab…');
  const mod = await import('./ui/animlab.js');
  labActive = true; menu.clear();
  if (!running) { running = true; requestAnimationFrame(frame); }
  await mod.openAnimLab({ app, root, renderer, onExit: () => { labActive = false; menu.title(); }, progress: (t, f) => menu.progress(t, f), menu });
}

// boot
window.addEventListener('load', () => {
  const auto = params.get('auto');
  if (params.get('lab')) { openLab(); return; }
  if (auto) {
    const cfg = { env: params.get('env') || 'official', teams: [params.get('a') || 'THA', params.get('b') || 'MAS'], format: params.get('format') || 'quick', difficulty: params.get('diff') || 'pro', assist: 0.75, quality: params.get('quality') || 'low', gender: 'men', spectate: params.get('human') !== '1' };
    startGame(cfg);
  } else menu.title();
});
