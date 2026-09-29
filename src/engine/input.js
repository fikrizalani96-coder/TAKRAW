// Unified input: keyboard, gamepad and on-screen touch controls (floating joystick + 4 action buttons).
export class Input {
  constructor(root) {
    this.root = root;
    this.keys = new Set(); this.prev = { A: false, B: false, C: false, D: false, switch: false, camera: false, pause: false, aids: false, mute: false };
    this.touch = { stick: null, buttons: { A: false, B: false, C: false, D: false }, extras: { switch: false, camera: false, pause: false } };
    this.state = { mx: 0, my: 0, held: { A: false, B: false, C: false, D: false }, pressed: {} };
    this.padIdx = -1; this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = true;
    this.latched = new Set(); this.touchLatch = {};        // presses shorter than one frame still register
    addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault(); this.keys.add(e.code); this.latched.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.tapLatch = false; addEventListener('pointerdown', () => { this.tapLatch = true; });
    addEventListener('blur', () => this.keys.clear());
    this.buildTouchUI();
  }
  buildTouchUI() {
    const ui = document.createElement('div'); ui.id = 'touch-ui'; ui.innerHTML = `
      <div id="stick-base"><div id="stick-knob"></div></div>
      <div id="btns">
        <button class="abtn" id="btnC" data-k="C"><b>C</b><span></span></button>
        <button class="abtn" id="btnB" data-k="B"><b>B</b><span></span></button>
        <button class="abtn" id="btnD" data-k="D"><b>D</b><span></span></button>
        <button class="abtn big" id="btnA" data-k="A"><b>A</b><span></span></button>
      </div>
      <div id="xbtns"><button data-x="switch">⇄</button><button data-x="camera">🎥</button><button data-x="pause">❚❚</button></div>`;
    this.root.appendChild(ui); this.ui = ui;
    this.base = ui.querySelector('#stick-base'); this.knob = ui.querySelector('#stick-knob');
    const zone = this.root;
    let stickId = null, cx = 0, cy = 0;
    const R = 62;
    const onDown = (e) => {
      if (e.target.closest('.abtn') || e.target.closest('#xbtns') || e.target.closest('.menu')) return;
      if (e.pointerType === 'mouse' && !this.isTouch) return;
      if (e.clientX > innerWidth * 0.55 || stickId !== null) return;
      stickId = e.pointerId; cx = e.clientX; cy = e.clientY;
      this.base.style.left = (cx - 70) + 'px'; this.base.style.top = (cy - 70) + 'px'; this.base.classList.add('on');
      this.touch.stick = { x: 0, y: 0 }; this.knob.style.transform = 'translate(0px,0px)';
    };
    const onMove = (e) => {
      if (e.pointerId !== stickId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      this.touch.stick = { x: dx / R, y: -dy / R }; this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const onUp = (e) => { if (e.pointerId !== stickId) return; stickId = null; this.touch.stick = null; this.base.classList.remove('on'); };
    zone.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    for (const b of ui.querySelectorAll('.abtn')) {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.touch.buttons[k] = true; this.touchLatch[k] = true; b.classList.add('down'); });
      const up = () => { this.touch.buttons[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    }
    for (const b of ui.querySelectorAll('[data-x]')) {
      const k = b.dataset.x; b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touch.extras[k] = true; setTimeout(() => (this.touch.extras[k] = false), 90); });
    }
  }
  showTouch(on) { this.ui.style.display = on ? 'block' : 'none'; }
  setLabels(l) { for (const k of ['A', 'B', 'C', 'D']) { const b = this.ui.querySelector('#btn' + k + ' span'); if (b && b.textContent !== (l[k] || '')) b.textContent = l[k] || ''; this.ui.querySelector('#btn' + k).style.opacity = l[k] ? 1 : 0.35; } }

  poll() {
    const k = new Set([...this.keys, ...this.latched]); this.latched.clear();
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const held = { A: k.has('Space') || k.has('KeyJ'), B: k.has('KeyK'), C: k.has('KeyL'), D: k.has('KeyI') || k.has('KeyU') };
    const extras = { switch: k.has('KeyQ') || k.has('Tab'), camera: k.has('KeyV'), pause: k.has('Escape') || k.has('KeyP'), aids: k.has('KeyH'), mute: k.has('KeyM') };
    // gamepad
    // embedded frames without the gamepad permission throw here: disable pads instead of breaking input
    let pads = [];
    if (this.padsOk !== false && navigator.getGamepads) { try { pads = navigator.getGamepads() || []; this.padsOk = true; } catch { this.padsOk = false; } }
    for (const p of pads) if (p && p.connected) {
      const ax = Math.abs(p.axes[0]) > 0.16 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > 0.16 ? p.axes[1] : 0;
      if (ax || ay) { mx = ax; my = -ay; }
      const b = p.buttons; held.A ||= b[0]?.pressed; held.D ||= b[1]?.pressed; held.B ||= b[2]?.pressed; held.C ||= b[3]?.pressed;
      extras.switch ||= b[4]?.pressed || b[5]?.pressed; extras.camera ||= b[8]?.pressed; extras.pause ||= b[9]?.pressed;
      if (b[12]?.pressed) my = 1; if (b[13]?.pressed) my = -1; if (b[14]?.pressed) mx = -1; if (b[15]?.pressed) mx = 1;
    }
    if (this.touch.stick) { mx = this.touch.stick.x; my = this.touch.stick.y; }
    for (const kk of ['A', 'B', 'C', 'D']) { held[kk] ||= this.touch.buttons[kk] || !!this.touchLatch[kk]; this.touchLatch[kk] = false; }
    for (const kk of ['switch', 'camera', 'pause']) extras[kk] ||= this.touch.extras[kk];
    const mag = Math.hypot(mx, my); if (mag > 1) { mx /= mag; my /= mag; }
    const now = { ...held, ...extras };
    const pressed = {};
    for (const kk of Object.keys(this.prev)) pressed[kk] = !!now[kk] && !this.prev[kk];
    this.prev = { A: !!now.A, B: !!now.B, C: !!now.C, D: !!now.D, switch: !!now.switch, camera: !!now.camera, pause: !!now.pause, aids: !!now.aids, mute: !!now.mute };
    this.state = { mx, my, held, pressed, tap: this.tapLatch }; this.tapLatch = false;
    return this.state;
  }
}
