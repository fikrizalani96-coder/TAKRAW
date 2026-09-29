// Menus: title, match setup, help, loading, pause and results overlays.
import { TEAMS, TEAM_CODES, flagDataURL } from '../character/kits.js';
import { MATCH_FORMATS } from '../game/config.js';
import { clipCount, categoryCounts } from '../anim/catalog.js';
import { countJoints } from '../character/skeleton.js';

const store = { get(k, d) { try { const v = localStorage.getItem('stgc.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('stgc.' + k, JSON.stringify(v)); } catch { /* ignore */ } } };
export { store };

export class Menu {
  constructor(root, handlers) {
    this.root = root; this.h = handlers;
    this.cfg = { env: 'official', teams: ['THA', 'MAS'], format: 'istaf', difficulty: 'pro', assist: 0.75, quality: 'auto', gender: 'men', ...store.get('cfg', {}) };
    this.layer = document.createElement('div'); root.appendChild(this.layer);
  }
  clear() { this.layer.innerHTML = ''; }
  overlay(html) { this.clear(); const o = document.createElement('div'); o.className = 'overlay'; o.innerHTML = `<div class="menu">${html}</div>`; this.layer.appendChild(o); return o; }
  bind(o, sel, fn) { o.querySelectorAll(sel).forEach((e) => e.addEventListener('click', (ev) => { this.h.click && this.h.click(); fn(e, ev); })); }

  title() {
    const o = this.overlay(`
      <h1>SEPAK TAKRAW<small>GAME CHALLENGE</small></h1>
      <p class="sub">ISTAF Regu · tekong · tosser · killer — a real-physics sepak takraw simulation.</p>
      <button class="btn primary" data-a="play">PLAY MATCH</button>
      <button class="btn" data-a="kampung">KAMPUNG TAKRAW (village)</button>
      <div class="row2"><button class="btn ghost" data-a="watch">WATCH AI MATCH</button><button class="btn ghost" data-a="lab">ANIMATION LAB</button></div>
      <div class="row2"><button class="btn ghost" data-a="help">HOW TO PLAY</button><button class="btn ghost" data-a="settings">SETTINGS</button></div>
      <p class="sub" style="margin-top:18px;font-size:12px">${countJoints()} joints per player · ${clipCount()} animations · ISTAF 21-point sets, deuce, 3-serve rotation</p>`);
    this.bind(o, '[data-a]', (e) => {
      const a = e.dataset.a;
      if (a === 'play') { this.cfg.env = 'official'; this.setup(); }
      else if (a === 'kampung') { this.cfg.env = 'kampung'; this.cfg.format = 'kampung'; this.setup(); }
      else if (a === 'watch') { this.setup(true); }
      else if (a === 'lab') this.h.lab();
      else if (a === 'help') this.help();
      else if (a === 'settings') this.settings();
    });
  }

  setup(spectate = false) {
    const c = this.cfg;
    const chips = (key, opts) => `<div class="chips" data-k="${key}">${opts.map(([v, l]) => `<div class="chip ${String(c[key]) === String(v) ? 'sel' : ''}" data-v="${v}">${l}</div>`).join('')}</div>`;
    const flags = (idx) => `<div class="flags" data-team="${idx}">${TEAM_CODES.map((k) => `<div class="flagcard ${c.teams[idx] === k ? 'sel' : ''}" data-v="${k}"><img src="${flagDataURL(k, 96, 64)}">${TEAMS[k].name}</div>`).join('')}</div>`;
    const o = this.overlay(`
      <h1 style="font-size:clamp(24px,5vw,38px)">${spectate ? 'WATCH A MATCH' : 'MATCH SETUP'}</h1>
      <div class="group"><label>Court</label><div class="cards" data-k="env"><div class="card ${c.env === 'official' ? 'sel' : ''}" data-v="official"><b>Official ISTAF Arena</b><span>Pink synthetic court · lights · crowd</span></div><div class="card ${c.env === 'kampung' ? 'sel' : ''}" data-v="kampung"><b>Kampung Takraw</b><span>Village dirt court · bamboo net · sunset</span></div></div></div>
      <div class="group"><label>${spectate ? 'Team A' : 'Your team'}</label>${flags(0)}</div>
      <div class="group"><label>${spectate ? 'Team B' : 'Opponent'}</label>${flags(1)}</div>
      <div class="group"><label>Match format</label>${chips('format', Object.entries(MATCH_FORMATS).map(([k, v]) => [k, v.label]))}</div>
      <div class="group"><label>Difficulty</label>${chips('difficulty', [['rookie', 'Rookie'], ['pro', 'Pro'], ['legend', 'Legend']])}</div>
      ${spectate ? '' : `<div class="group"><label>Assist</label>${chips('assist', [[0.9, 'Full (auto-play)'], [0.75, 'Balanced'], [0.15, 'Manual']])}</div>`}
      <div class="group"><label>Graphics</label>${chips('quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low / phone']])}</div>
      <div class="group"><label>Category</label>${chips('gender', [['men', "Men's (net 1.52 m)"], ['women', "Women's (net 1.42 m)"]])}</div>
      <button class="btn primary" data-a="start">${spectate ? 'START' : 'KICK OFF'}</button><button class="btn ghost" data-a="back">BACK</button>`);
    o.querySelectorAll('[data-k] > *').forEach((el) => el.addEventListener('click', () => {
      const k = el.parentElement.dataset.k; let v = el.dataset.v; if (k === 'assist') v = parseFloat(v); c[k] = v;
      if (k === 'env' && v === 'kampung') c.format = 'kampung'; if (k === 'env' && v === 'official' && c.format === 'kampung') c.format = 'istaf';
      this.h.click && this.h.click(); this.setup(spectate);
    }));
    o.querySelectorAll('.flags').forEach((f) => f.querySelectorAll('.flagcard').forEach((el) => el.addEventListener('click', () => { c.teams[+f.dataset.team] = el.dataset.v; if (c.teams[0] === c.teams[1]) c.teams[1 - +f.dataset.team] = TEAM_CODES.find((k) => k !== c.teams[+f.dataset.team]); this.h.click && this.h.click(); this.setup(spectate); })));
    this.bind(o, '[data-a]', (e) => { if (e.dataset.a === 'back') this.title(); else { store.set('cfg', c); this.h.start({ ...c, spectate }); } });
  }

  help() {
    const o = this.overlay(`<h1 style="font-size:32px">HOW TO PLAY</h1><div class="help">
      <h3>THE TEAM (REGU)</h3>Three players: <b>Tekong</b> (back, serves & first receive), <b>Tosser</b> (feeder — tosses for the serve, lifts/sets), <b>Killer</b> (striker — spikes with <i>libas</i> and blocks). You always control the player who must play the ball next.
      <h3>TOUCH CONTROLS</h3>Left thumb: floating joystick (move / aim). Right thumb: <b>A</b> foot (sepak) · <b>B</b> body (chest/thigh/knee) · <b>C</b> head or <b>LIBAS</b> spike / block · <b>D</b> dive/slide save. Top buttons: switch player, camera, pause.
      <h3>KEYBOARD</h3><span class="kbd">W A S D</span>/<span class="kbd">arrows</span> move · <span class="kbd">J</span>/<span class="kbd">Space</span> A · <span class="kbd">K</span> B · <span class="kbd">L</span> C · <span class="kbd">I</span> D · <span class="kbd">Q</span> switch · <span class="kbd">V</span> camera · <span class="kbd">H</span> guides · <span class="kbd">P</span> pause · <span class="kbd">M</span> mute. Gamepad supported.
      <h3>SERVING</h3>Aim the red reticle with the stick, then choose the kick: <b>SILA</b> (soft inside-foot float), <b>KUDA</b> (power instep), <b>CARA</b> (curving outside foot). Your tosser tosses; press the same button again when the ball drops for a clean strike.
      <h3>RALLY</h3>Move to the yellow-ringed player's <b>cyan ring</b>, then press a technique button. Sets: stick ↑ = quick, ↓ = high. Spikes: stick ↓ = roll spike (gulung), sideways = scissor (gunting), neutral = kuda. Defend spikes by pressing <b>C</b> at the net (block) or <b>D</b> to dive.
      <h3>ISTAF RULES</h3>Rally-point sets to 21 (deuce at 20-20, cap 25), best of 3; deciding set to 15 (deuce 14-14, cap 17) with a side change at 8. Service changes every 3 serves (every point at deuce). Max 3 touches, a player may touch twice in a row, no hands/arms, block touches don't count, net touches and serve foot faults lose the point. A serve that clips the net and lands in is good.
    </div><button class="btn" data-a="back" style="margin-top:14px">BACK</button>`);
    this.bind(o, '[data-a]', () => this.title());
  }

  settings() {
    const s = store.get('settings', { volume: 0.8, aids: true });
    const o = this.overlay(`<h1 style="font-size:32px">SETTINGS</h1>
      <div class="group"><label>Volume</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.volume}" style="width:100%"></div>
      <div class="group"><label>Guides (rings & aim)</label><div class="chips" data-k="aids"><div class="chip ${s.aids ? 'sel' : ''}" data-v="1">On</div><div class="chip ${!s.aids ? 'sel' : ''}" data-v="0">Off</div></div></div>
      <button class="btn" data-a="back">BACK</button>`);
    o.querySelector('#vol').addEventListener('input', (e) => { s.volume = +e.target.value; store.set('settings', s); this.h.settings && this.h.settings(s); });
    o.querySelectorAll('[data-k="aids"] .chip').forEach((el) => el.addEventListener('click', () => { s.aids = el.dataset.v === '1'; store.set('settings', s); this.h.settings && this.h.settings(s); this.settings(); }));
    this.bind(o, '[data-a]', () => this.title());
  }

  loading(text = 'Loading…') {
    this.clear(); const o = document.createElement('div'); o.className = 'overlay'; o.innerHTML = `<div class="menu"><h1 style="font-size:34px">SEPAK TAKRAW<small>GAME CHALLENGE</small></h1><p class="sub" id="ltxt">${text}</p><div class="bar"><i id="lbar"></i></div><p class="sub" style="font-size:12px;margin-top:18px">Sculpting ${countJoints()}-joint athletes procedurally — no downloads</p></div>`;
    this.layer.appendChild(o); this.lt = o.querySelector('#ltxt'); this.lb = o.querySelector('#lbar');
  }
  progress(text, f) { if (this.lt) { this.lt.textContent = text; this.lb.style.width = Math.round(f * 100) + '%'; } }

  pause(state) {
    const o = this.overlay(`<h1 style="font-size:34px">PAUSED</h1>
      <button class="btn primary" data-a="resume">RESUME</button>
      <div class="row2"><button class="btn ghost" data-a="camera">CAMERA: ${state.cameraMode.toUpperCase()}</button><button class="btn ghost" data-a="aids">GUIDES: ${state.aids ? 'ON' : 'OFF'}</button></div>
      <div class="row2"><button class="btn ghost" data-a="sound">SOUND: ${state.sound ? 'ON' : 'OFF'}</button><button class="btn ghost" data-a="help">HELP</button></div>
      <button class="btn ghost" data-a="quit">QUIT TO MENU</button>`);
    this.bind(o, '[data-a]', (e) => this.h.pauseAction(e.dataset.a));
  }
  results(info) {
    const rows = info.history.map((h, i) => `<tr><td>Set ${i + 1}</td><td>${h[0]}</td><td>${h[1]}</td></tr>`).join('');
    const st = info.stats;
    const o = this.overlay(`<h1 style="font-size:34px">${info.winnerName} WIN!<small>${info.sets[0]} – ${info.sets[1]}</small></h1>
      <table class="res"><tr><th></th><th>${info.names[0]}</th><th>${info.names[1]}</th></tr>${rows}
      <tr><td>Points</td><td>${st[0].points}</td><td>${st[1].points}</td></tr><tr><td>Spikes</td><td>${st[0].spikes}</td><td>${st[1].spikes}</td></tr><tr><td>Blocks</td><td>${st[0].blocks}</td><td>${st[1].blocks}</td></tr><tr><td>Aces</td><td>${st[0].aces}</td><td>${st[1].aces}</td></tr><tr><td>Faults</td><td>${st[0].faults}</td><td>${st[1].faults}</td></tr></table>
      <p class="sub">Longest rally: ${info.longest} touches</p>
      <button class="btn primary" data-a="again">PLAY AGAIN</button><button class="btn ghost" data-a="menu">MAIN MENU</button>`);
    this.bind(o, '[data-a]', (e) => this.h.resultAction(e.dataset.a));
  }
}
