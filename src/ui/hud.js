// DOM heads-up display: scoreboard, touch counter, toasts, context hints, mini radar.
import { TEAMS, flagDataURL } from '../character/kits.js';
import { COURT } from '../game/config.js';

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="scoreboard"><div class="tag" id="sbTag">SET 1</div>
        <div class="row a"><img id="fA"><div class="code"><span id="cA"></span><i id="sA"></i></div><div class="sets" id="setA">0</div><div class="pts" id="ptA">0</div></div>
        <div class="row b"><img id="fB"><div class="code"><span id="cB"></span><i id="sB"></i></div><div class="sets" id="setB">0</div><div class="pts" id="ptB">0</div></div>
        <div class="foot" id="sbFoot">LIVE</div></div>
      <div id="topright"><canvas id="radar" width="148" height="272"></canvas></div>
      <div id="touches"><i></i><i></i><i></i></div>
      <div id="toast"><div class="t1"></div><div class="t2"></div></div>
      <div id="replaytag"><i></i><b>REPLAY</b><small>tap / press any button to skip</small></div>
      <div id="serveinfo"></div>
      <div id="ctx"></div>`;
    this.el = (id) => root.querySelector('#' + id);
    this.toastEl = this.el('toast'); this.toastTimer = 0;
    this.radar = this.el('radar').getContext('2d');
    this.last = {};
  }
  setTeams(codes) {
    this.codes = codes;
    this.el('fA').src = flagDataURL(codes[0], 84, 56); this.el('fB').src = flagDataURL(codes[1], 84, 56);
    this.el('cA').textContent = codes[0]; this.el('cB').textContent = codes[1];
  }
  set(id, v) { if (this.last[id] !== v) { this.last[id] = v; this.el(id).textContent = v; } }
  toast(t1, t2 = '', kind = '', ms = 1800) {
    const e = this.toastEl; e.querySelector('.t1').textContent = t1; e.querySelector('.t2').textContent = t2; e.className = 'show ' + kind; e.id = 'toast';
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => e.classList.remove('show'), ms);
  }
  update(match, hc) {
    const r = match.rules;
    this.set('ptA', r.points[0]); this.set('ptB', r.points[1]); this.set('setA', r.sets[0]); this.set('setB', r.sets[1]);
    this.set('sbTag', `SET ${r.setIndex + 1}${r.deciding ? ' · DECIDER' : ''}${r.isDeuce ? ' · DEUCE' : ''}`);
    this.set('sbFoot', match.state === 'matchend' ? 'FINAL' : `TO ${r.target}${r.inDeuceZone ? ' (WIN BY 2)' : ''}`);
    this.el('sA').className = r.serving === 0 ? 'on' : ''; this.el('sB').className = r.serving === 1 ? 'on' : '';
    // touches
    const dots = this.root.querySelectorAll('#touches i'); const y = match.rally;
    const cnt = y && y.possession !== undefined && match.state === 'rally' ? y.count : 0;
    dots.forEach((d, i) => d.classList.toggle('on', i < cnt));
    if (hc) this.updateContext(match, hc);
    this.drawRadar(match, hc);
  }
  updateContext(match, hc) {
    const p = hc.active; const c = hc.context; let txt = '';
    const role = p ? p.role.toUpperCase() : '';
    const short = matchMedia('(pointer: coarse)').matches;
    if (c === 'serve' && short) txt = `<b>${role}</b> · stick = aim, then <b>SILA</b> · <b>KUDA</b> · <b>CARA</b>`;
    else if (c === 'kick' && short) txt = `<b>TIMING!</b> tap again as it drops`;
    else if (c === '2' && short) txt = `<b>${role}</b> · LIFT it — stick ↑ quick, ↓ high`;
    else if (c === '3' && short) txt = `<b>${role}</b> · ATTACK! <b>LIBAS</b> to spike`;
    else if (c === 'defend' && short) txt = `<b>${role}</b> · block with <b>BLOK</b> at the net`;
    else if (c === 'serve') txt = `<b>${role}</b> · aim with stick, then pick <span class="pill">SILA float</span><span class="pill">KUDA power</span><span class="pill">CARA curve</span>`;
    else if (c === 'kick') txt = `<b>TIMING!</b> press the same button again as the ball drops`;
    else if (c === '1') txt = `<b>${role}</b> · get under the ball and RECEIVE`;
    else if (c === '2') txt = `<b>${role}</b> · LIFT it up for the killer (stick ↑ quick / ↓ high)`;
    else if (c === '3') txt = `<b>${role}</b> · ATTACK! press <b>LIBAS</b> to spike — stick picks the style & aim`;
    else if (c === 'defend') txt = `<b>${role}</b> · defend — time <b>BLOK</b> at the net when they spike`;
    else txt = '';
    if (this.last.ctx !== txt) { this.last.ctx = txt; this.el('ctx').innerHTML = txt; this.el('ctx').style.display = txt ? 'block' : 'none'; }
  }
  drawRadar(match, hc) {
    const g = this.radar, W = 148, H = 272;
    g.clearRect(0, 0, W, H);
    const sx = (x) => W / 2 + x * (W - 24) / COURT.W, sz = (z) => H / 2 + z * (H - 24) / COURT.L;
    const flip = hc && hc.side < 0 ? -1 : 1;                 // keep the human's team at the bottom
    g.fillStyle = 'rgba(224,90,116,.55)'; g.fillRect(sx(-COURT.halfW), sz(-COURT.halfL), COURT.W * (W - 24) / COURT.W, COURT.L * (H - 24) / COURT.L);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(sx(-COURT.halfW), sz(-COURT.halfL), (W - 24), (H - 24)); g.beginPath(); g.moveTo(sx(-COURT.halfW), H / 2); g.lineTo(sx(COURT.halfW), H / 2); g.stroke();
    const P = (x, z) => [sx(x * flip), sz(z * flip)];
    const cols = ['#3d78ff', '#ff4d6a'];
    for (const p of match.all) { const [x, y] = P(p.x, p.z); g.fillStyle = cols[p.team]; g.beginPath(); g.arc(x, y, p.human ? 6 : 4.5, 0, 6.3); g.fill(); if (p.human) { g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.stroke(); } }
    const b = match.ball; const [bx, by] = P(b.x, b.z); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(bx, by, 3.5 + Math.min(4, b.y * 0.6), 0, 6.3); g.fill();
  }
}
