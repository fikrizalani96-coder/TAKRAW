// Animation Lab: browse, search and preview every clip in the catalogue on a fully dressed, fully rigged
// athlete. Orbit with drag / pinch, scrub the timeline, mirror left <-> right, slow-motion, change kit,
// build and outfit, and see the ideal ball-contact point that each technique is authored around.
import * as THREE from 'three';
import { getBodyKit, ensureOutfit, getHeadGeo, createHuman } from '../character/humanFactory.js';
import { TEAMS, TEAM_CODES } from '../character/kits.js';
import { randomFace } from '../character/head.js';
import { makeRng } from '../util/math.js';
import { Animator } from '../anim/animator.js';
import { allEntries, categoryCounts, getClip, clipCount } from '../anim/catalog.js';
import { mirrorPose } from '../anim/pose.js';
import { countJoints } from '../character/skeleton.js';
import { buildBallMesh } from '../world/ballmesh.js';

const BUILD_LIST = [['killer', 'Killer'], ['tosser', 'Tosser'], ['tekong', 'Tekong'], ['youth', 'Youth'], ['elder', 'Elder']];
const CAT_LABEL = { serve: 'Serve', receive: 'Receive', set: 'Set / lift', attack: 'Spike / libas', block: 'Block', locomotion: 'Move', idle: 'Idle', dive: 'Dive / slide', toss: 'Toss', ball: 'Ball skills', celebrate: 'Celebrate', react: 'React', warmup: 'Warm-up', official: 'Officials', freestyle: 'Freestyle' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Wrap a clip so it plays mirrored (left <-> right). */
function mirrored(clip) {
  const m = Object.create(clip);
  m.sample = (t, out) => { clip.sample(t, out); return mirrorPose(out, out); };
  m.id = clip.id + ' (mirrored)';
  return m;
}

export async function openAnimLab({ app, root, renderer, onExit, progress, menu }) {
  const S = {
    cat: 'all', q: '', sel: null, playing: true, speed: 1, mirror: false, build: 'killer', team: 'THA', outfit: 'sport', tour: false, tourT: 0,
    yaw: 0.55, pitch: 0.14, dist: 5.4, ballOn: true, list: [],
  };
  const quality = app.quality === "low" ? "low" : app.quality === "high" ? "high" : "medium";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141a2e); scene.fog = new THREE.Fog(0x141a2e, 9, 22);
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x3a2f3f, 1.05));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3.5; sc.bottom = -1; sc.near = 1; sc.far = 14; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa0ff, 1.2); rim.position.set(-4, 3, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0xc8506a, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.14, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; scene.add(ring);
  const grid = new THREE.GridHelper(18, 36, 0xffffff, 0xffffff); grid.material.transparent = true; grid.material.opacity = 0.07; grid.position.y = 0.003; scene.add(grid);
  const ball = buildBallMesh(0.0668); ball.scale.setScalar(1.35); scene.add(ball);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  // ---------- DOM ----------
  const cats = categoryCounts();
  const el = document.createElement('div'); el.className = 'lab';
  el.innerHTML = `
    <div class="lab-view"></div>
    <div class="lab-top"><button class="lab-btn" data-a="exit">← BACK</button><div class="lab-title">ANIMATION LAB<small>${countJoints()} joints · ${clipCount()} clips · ${Object.keys(cats).length} families</small></div></div>
    <div class="lab-info" id="lab-info"></div>
    <div class="lab-status" id="lab-status">Sculpting athlete…</div>
    <div class="lab-panel">
      <div class="lab-transport">
        <button class="lab-btn" data-a="prev" title="Previous (←)">⏮</button><button class="lab-btn big" data-a="play" title="Play / pause (space)">⏸</button><button class="lab-btn" data-a="next" title="Next (→)">⏭</button>
        <input type="range" id="lab-scrub" min="0" max="1000" value="0"><span id="lab-time">0.00s</span>
      </div>
      <div class="lab-row">
        <div class="lab-chips" data-k="speed">${[0.1, 0.25, 0.5, 1, 1.5].map((v) => `<span class="chip ${v === 1 ? 'sel' : ''}" data-v="${v}">${v}×</span>`).join('')}</div>
        <span class="chip" data-a="mirror">⇋ Mirror</span><span class="chip" data-a="face">☺ Face</span><span class="chip sel" data-a="ball">● Ball</span><span class="chip" data-a="tour">▶ Tour</span><span class="chip" data-a="rand">⚄ Random</span>
      </div>
      <div class="lab-row"><div class="lab-chips" data-k="build">${BUILD_LIST.map(([k, l]) => `<span class="chip ${k === S.build ? 'sel' : ''}" data-v="${k}">${l}</span>`).join('')}</div>
        <div class="lab-chips" data-k="outfit"><span class="chip sel" data-v="sport">Sport kit</span><span class="chip" data-v="kampung">Kampung</span></div>
        <div class="lab-chips" data-k="team">${['THA', 'MAS', 'INA', 'JPN', 'KOR', 'VIE'].filter((c) => TEAM_CODES.includes(c)).map((c) => `<span class="chip ${c === S.team ? 'sel' : ''}" data-v="${c}">${c}</span>`).join('')}</div></div>
      <div class="lab-search"><input id="lab-q" type="search" placeholder="Search ${clipCount()} animations…  (e.g. kuda, gulung, dive, celebrate)" autocomplete="off"></div>
      <div class="lab-cats" data-k="cat"><span class="chip sel" data-v="all">All ${clipCount()}</span>${Object.entries(cats).map(([k, n]) => `<span class="chip" data-v="${k}">${CAT_LABEL[k] || k} ${n}</span>`).join('')}</div>
      <div class="lab-list" id="lab-list"></div>
    </div>`;
  root.appendChild(el);
  const hudEl = document.getElementById('hud'); const hudShown = hudEl ? hudEl.style.display : ''; if (hudEl) hudEl.style.display = 'none';
  const $ = (s) => el.querySelector(s);
  const view = $('.lab-view');

  // ---------- human ----------
  const rng = makeRng(21); const face = randomFace(rng);
  let human = null, anim = null, curClip = null, kitCache = {}, building = 0;
  async function buildHuman() {
    const my = ++building;
    $('#lab-status').style.display = 'block'; $('#lab-status').textContent = 'Sculpting athlete…';
    await new Promise((r) => setTimeout(r, 20));
    const b = S.build;
    const kit = kitCache[b] || (kitCache[b] = await getBodyKit(b, quality));
    await ensureOutfit(kit, S.outfit);
    const fk = 'lab' + b; const head = await getHeadGeo(kit, fk, face);
    if (my !== building) return;
    if (human) { scene.remove(human.group); }
    const t = TEAMS[S.team];
    const tees = [0x2f6fb5, 0xb83a32];
    human = createHuman(kit, head, { skin: 2, hairStyle: b === 'elder' ? 'buzz' : 'short', hairColor: 0, face, faceKey: fk, kit: t.kit, number: 9, name: t.name.split(' ')[0].toUpperCase().slice(0, 9), outfit: S.outfit, barefoot: S.outfit === 'kampung', accessories: { knee: S.outfit === 'sport' }, teeColor: tees[0], shortsColor: 0x1c2c58 });
    human.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    scene.add(human.group);
    anim = new Animator(human);
    $('#lab-status').style.display = 'none';
    if (S.sel) play(S.sel); else pick(defaultEntry());
  }
  const defaultEntry = () => allEntries().find((e) => e.id.startsWith('atk.kuda')) || allEntries().find((e) => e.cat === 'attack') || allEntries()[0];

  // ---------- list ----------
  const ALL = allEntries();
  const hay = new Map(ALL.map((e) => [e, `${e.id} ${e.name} ${(e.tags || []).join(' ')} ${e.cat}`.toLowerCase()]));
  function refreshList() {
    const terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    S.list = ALL.filter((e) => (S.cat === 'all' || e.cat === S.cat) && terms.every((t) => hay.get(e).includes(t)));
    const shown = S.list.slice(0, 260);
    $('#lab-list').innerHTML = (S.list.length ? '' : '<div class="lab-empty">No animations match.</div>') + shown.map((e, i) => `<div class="lab-item ${S.sel === e ? 'sel' : ''}" data-i="${i}"><b>${esc(e.name)}</b><span>${esc(e.id)} · ${(e.dur ?? 0).toFixed(2)}s</span></div>`).join('') + (S.list.length > shown.length ? `<div class="lab-empty">${S.list.length - shown.length} more — refine the search</div>` : '');
    $('#lab-list').scrollTop = 0;
  }
  function pick(e) { S.sel = e; play(e); el.querySelectorAll('.lab-item').forEach((n) => n.classList.toggle('sel', S.list[+n.dataset.i] === e)); const sel = el.querySelector('.lab-item.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' }); }
  function play(e) {
    if (!anim) return;
    let clip = getClip(e.id); if (!clip) return;
    if (S.mirror) clip = mirrored(clip);
    curClip = clip; S.t = 0;
    anim.play(clip, { loop: true, fadeIn: 0.14, timeScale: 1 });
    anim.setLocomotion(0, 0, 0.5);
    const c = clip.meta && clip.meta.contact;
    const sgn = S.mirror ? -1 : 1;
    ball.visible = !!(c && c.T && S.ballOn);
    S.contactPos = c && c.T ? { x: c.T[0] * sgn, y: c.T[1], z: c.T[2] } : null;
    const tr = clip.meta && clip.meta.travel; S.travel = tr || null;
    const info = [`<b>${esc(e.name)}</b>`, `<span>${esc(e.id)}</span>`, `<span>${clip.duration.toFixed(2)} s${clip.loop ? ' · loops' : ''}${clip.events && clip.events.contact ? ` · contact @ ${clip.events.contact.toFixed(2)} s` : ''}${c ? ` · ${esc(c.kind || '')} ${esc(c.side || '')}` : ''}${clip.meta && clip.meta.air ? ` · airborne ${(clip.meta.air.peak * 100).toFixed(0)} cm` : ''}</span>`, `<span class="tags">${(e.tags || []).slice(0, 9).map((t) => `<i>${esc(t)}</i>`).join('')}</span>`];
    $('#lab-info').innerHTML = info.join('');
  }

  // ---------- events ----------
  const on = (sel, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener('click', (ev) => fn(n, ev)));
  const setSel = (k, v) => { el.querySelectorAll(`[data-k="${k}"] .chip`).forEach((n) => n.classList.toggle('sel', n.dataset.v === String(v))); };
  on('[data-k="cat"] .chip', (n) => { S.cat = n.dataset.v; setSel('cat', S.cat); refreshList(); });
  on('[data-k="speed"] .chip', (n) => { S.speed = +n.dataset.v; setSel('speed', n.dataset.v); });
  on('[data-k="build"] .chip', (n) => { S.build = n.dataset.v; setSel('build', S.build); buildHuman(); });
  on('[data-k="outfit"] .chip', (n) => { S.outfit = n.dataset.v; setSel('outfit', S.outfit); buildHuman(); });
  on('[data-k="team"] .chip', (n) => { S.team = n.dataset.v; setSel('team', S.team); buildHuman(); });
  $('#lab-list').addEventListener('click', (ev) => { const n = ev.target.closest('.lab-item'); if (n) pick(S.list[+n.dataset.i]); });
  $('#lab-q').addEventListener('input', (ev) => { S.q = ev.target.value; refreshList(); });
  $('#lab-q').addEventListener('keydown', (ev) => ev.stopPropagation());
  const step = (d) => { if (!S.list.length) return; const i = S.list.indexOf(S.sel); pick(S.list[(i + d + S.list.length) % S.list.length]); };
  const togglePlay = () => { S.playing = !S.playing; el.querySelector('[data-a="play"]').textContent = S.playing ? '⏸' : '▶'; };
  const rand = () => { if (S.list.length) pick(S.list[Math.floor(Math.random() * S.list.length)]); };
  on('[data-a]', (n) => {
    const a = n.dataset.a;
    if (a === 'exit') close();
    else if (a === 'prev') step(-1); else if (a === 'next') step(1);
    else if (a === 'play') togglePlay();
    else if (a === 'mirror') { S.mirror = !S.mirror; n.classList.toggle('sel', S.mirror); if (S.sel) play(S.sel); }
    else if (a === 'ball') { S.ballOn = !S.ballOn; n.classList.toggle('sel', S.ballOn); if (S.sel) play(S.sel); }
    else if (a === 'tour') { S.tour = !S.tour; n.classList.toggle('sel', S.tour); S.tourT = 0; if (S.tour) rand(); }
    else if (a === 'rand') rand();
    else if (a === 'face') { S.face = !S.face; n.classList.toggle('sel', S.face); if (S.face) { S.saveDist = S.dist; S.dist = 1.5; S.pitch = 0.03; } else S.dist = S.saveDist || 5.4; }
  });
  const scrub = $('#lab-scrub');
  scrub.addEventListener('input', () => { if (!anim || !anim.act || !curClip) return; S.playing = false; el.querySelector('[data-a="play"]').textContent = '▶'; anim.act.time = (scrub.value / 1000) * curClip.duration; anim.act.w = 1; });
  const onKey = (ev) => {
    if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type !== 'range') return;
    if (ev.code === 'ArrowRight') step(1); else if (ev.code === 'ArrowLeft') step(-1); else if (ev.code === 'Space') { togglePlay(); ev.preventDefault(); } else if (ev.code === 'KeyM') el.querySelector('[data-a="mirror"]').click(); else if (ev.code === 'Escape') close();
  };
  addEventListener('keydown', onKey);
  // orbit / zoom on the viewport
  const ptrs = new Map(); let pinch = 0;
  view.addEventListener('pointerdown', (ev) => { view.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); });
  view.addEventListener('pointerup', (ev) => { ptrs.delete(ev.pointerId); pinch = 0; });
  view.addEventListener('pointercancel', (ev) => { ptrs.delete(ev.pointerId); pinch = 0; });
  view.addEventListener('pointermove', (ev) => {
    const p = ptrs.get(ev.pointerId); if (!p) return;
    if (ptrs.size === 1) { S.yaw -= (ev.clientX - p.x) * 0.008; S.pitch = Math.max(-0.2, Math.min(1.1, S.pitch + (ev.clientY - p.y) * 0.005)); }
    p.x = ev.clientX; p.y = ev.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) S.dist = Math.max(2, Math.min(11, S.dist * (pinch / d))); pinch = d; }
  });
  view.addEventListener('wheel', (ev) => { S.dist = Math.max(2, Math.min(11, S.dist * (1 + Math.sign(ev.deltaY) * 0.08))); ev.preventDefault(); }, { passive: false });

  // ---------- loop ----------
  let raf = 0, last = performance.now(), alive = true;
  const V = new THREE.Vector3();
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = innerWidth, h = innerHeight; if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    // portrait: view fills the top half; landscape: view fills the right side
    const portrait = h > w * 1.05 || w < 760;
    const vr = view.getBoundingClientRect();
    cam.aspect = Math.max(0.2, w / h);
    if (human && anim) {
      const adv = S.playing ? dt * S.speed : 0;
      if (S.contactPos && anim.act) anim.setContactTarget(S.contactPos, 1);
      anim.update(adv);
      human.group.updateMatrixWorld(true);
      const A = anim.act;
      if (A && curClip) {
        const u = (A.time % curClip.duration) / curClip.duration; if (S.playing) scrub.value = Math.round(u * 1000);
        $('#lab-time').textContent = `${(A.time % curClip.duration).toFixed(2)}s`;
        if (S.travel) {
          const tt = A.time, tr = S.travel; const k = Math.min(1, Math.max(0, (tt - tr.t0) / (tr.t1 - tr.t0))); const s = k * k * (3 - 2 * k);
          human.group.position.set((S.mirror ? -1 : 1) * tr.dx * s, 0, tr.dz * s);
        } else human.group.position.set(0, 0, 0);
      }
      if (S.contactPos) { ball.position.set(S.contactPos.x, S.contactPos.y, S.contactPos.z); ball.rotation.y += dt; }
      if (S.tour && S.playing && A && curClip) { S.tourT += dt * S.speed; if (S.tourT > Math.max(1.6, curClip.duration * (curClip.loop ? 2.5 : 1.15))) { S.tourT = 0; rand(); } }
    }
    const fy = S.face ? 1.72 : portrait ? 1.0 : 0.95;
    V.set(0, fy - 0.05, 0);
    const dist = S.dist * (portrait ? 1.4 : 1);
    cam.position.set(Math.sin(S.yaw) * Math.cos(S.pitch) * dist, V.y + Math.sin(S.pitch) * dist, Math.cos(S.yaw) * Math.cos(S.pitch) * dist);
    cam.lookAt(V);
    // shift the framing so the athlete sits in the free area beside/above the panel
    if (portrait || w < 760) cam.setViewOffset(w, h, 0, Math.round(h * 0.2), w, h); else cam.setViewOffset(w, h, -Math.round(Math.min(380, w * 0.34) * 0.5), 0, w, h);
    key.position.set(3, 5, 4); key.target.position.set(0, 1, 0); key.target.updateMatrixWorld();
    renderer.render(scene, cam);
    cam.clearViewOffset();
  }
  function close() {
    alive = false; cancelAnimationFrame(raf); if (hudEl) hudEl.style.display = hudShown; removeEventListener('keydown', onKey);
    el.remove(); scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry) o.geometry.dispose?.(); });
    onExit && onExit();
  }

  refreshList();
  requestAnimationFrame(frame);
  await buildHuman();
  window.__lab = { S, pick, refreshList, close };
  return { close, S };
}
