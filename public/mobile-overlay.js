/**
 * Rebur Engine — Mobile Overlay
 * Injected into editor pages. Provides:
 *  - Virtual joystick (Arrow + WASD key events)
 *  - Action buttons (Space / E / Z)
 *  - Mobile panel drawers (Scene, Inspector, Console)
 */
(function () {
  'use strict';

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  /* ─── CSS ────────────────────────────────────────────────────────────── */
  const CSS = `
    /* Bottom navigation bar */
    #rebur-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 58px;
      background: rgba(22, 27, 42, 0.97);
      border-top: 1px solid #2f3a5a;
      display: flex; align-items: center; justify-content: space-around;
      z-index: 8000;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      touch-action: none;
    }

    .rm-nav-btn {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: none; border: none; color: #7a859e;
      font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
      padding: 6px 12px; cursor: pointer; border-radius: 8px;
      transition: color 0.15s; -webkit-tap-highlight-color: transparent;
      min-width: 64px;
    }
    .rm-nav-btn .rm-icon { font-size: 20px; line-height: 1; }
    .rm-nav-btn.active { color: #6c8ef5; }
    .rm-nav-btn:active { opacity: 0.7; }

    /* Panel drawer (overlay on top of game canvas) */
    .rm-drawer {
      position: fixed; top: 0; bottom: 58px;
      background: #1f2640;
      border: 1px solid #2f3a5a;
      z-index: 7500;
      overflow: hidden;
      display: flex; flex-direction: column;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #rm-left-drawer {
      left: 0; width: min(340px, 92vw);
      border-radius: 0 14px 14px 0; border-left: none;
      transform: translateX(-105%);
    }
    #rm-right-drawer {
      right: 0; width: min(340px, 92vw);
      border-radius: 14px 0 0 14px; border-right: none;
      transform: translateX(105%);
    }
    #rm-bottom-drawer {
      top: auto; left: 0; right: 0; width: 100%; height: 260px;
      border-radius: 14px 14px 0 0; border-bottom: none;
      transform: translateY(110%);
    }
    .rm-drawer.rm-open { transform: translate(0) !important; }

    .rm-backdrop {
      position: fixed; inset: 0; bottom: 58px;
      background: rgba(0,0,0,0.45);
      z-index: 7400; display: none;
    }
    .rm-backdrop.rm-visible { display: block; }

    .rm-drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #2f3a5a;
      font-size: 13px; font-weight: 600; color: #e8ecf5; flex-shrink: 0;
    }
    .rm-drawer-close {
      background: none; border: none; color: #7a859e;
      font-size: 22px; cursor: pointer; padding: 4px; line-height: 1;
      -webkit-tap-highlight-color: transparent;
    }
    .rm-drawer-body {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }

    /* Make actual sidebar/bottom panels fill drawers */
    .rm-drawer-body > * {
      display: flex !important;
      width: 100% !important; min-width: 0 !important;
      height: 100% !important; min-height: 0 !important;
      overflow: auto !important;
    }

    /* Game controls layer */
    #rm-controls {
      position: fixed; inset: 0; bottom: 58px;
      z-index: 7000; pointer-events: none;
    }
    #rm-controls.rm-hidden { display: none; }

    /* Virtual joystick */
    #rm-joystick {
      position: absolute; bottom: 20px; left: 20px;
      width: 128px; height: 128px;
      pointer-events: auto; user-select: none; -webkit-user-select: none;
      touch-action: none;
    }
    .rm-joy-base {
      width: 128px; height: 128px; border-radius: 50%;
      background: rgba(108,142,245,0.12);
      border: 2.5px solid rgba(108,142,245,0.45);
      position: relative; touch-action: none;
      box-shadow: inset 0 0 20px rgba(108,142,245,0.08);
    }
    .rm-joy-thumb {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 46px; height: 46px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #7c9ef8, #5a7ef0);
      box-shadow: 0 2px 12px rgba(108,142,245,0.5);
      pointer-events: none; transition: none;
    }

    /* Action buttons */
    #rm-actions {
      position: absolute; bottom: 20px; right: 20px;
      display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
      pointer-events: auto; user-select: none; -webkit-user-select: none;
    }
    .rm-act-row { display: flex; gap: 8px; align-items: center; }
    .rm-btn {
      width: 56px; height: 56px; border-radius: 50%;
      border: 2.5px solid; background: rgba(22,27,42,0.88);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 1px;
      cursor: pointer; font-weight: 700;
      -webkit-tap-highlight-color: transparent;
      touch-action: none; user-select: none; -webkit-user-select: none;
      transition: transform 0.06s, background 0.06s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .rm-btn.rm-lg { width: 64px; height: 64px; }
    .rm-btn.pressed { transform: scale(0.88); }
    .rm-btn-jump   { border-color: #4ecdc4; color: #4ecdc4; }
    .rm-btn-act    { border-color: #6c8ef5; color: #6c8ef5; }
    .rm-btn-atk    { border-color: #f25757; color: #f25757; }
    .rm-btn-jump.pressed  { background: rgba(78,205,196,0.22); }
    .rm-btn-act.pressed   { background: rgba(108,142,245,0.22); }
    .rm-btn-atk.pressed   { background: rgba(242,87,87,0.22); }
    .rm-btn .rm-bemoji { font-size: 20px; line-height: 1; }
    .rm-btn .rm-blabel { font-size: 9px; letter-spacing: 0.04em; }

    /* Layout breathing room */
    @media (max-width: 768px) {
      #layout { padding-bottom: 58px !important; }
      #top-bar { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
      body { padding-bottom: env(safe-area-inset-bottom, 0px); }
    }
  `;

  function injectCSS() {
    const s = document.createElement('style');
    s.id = 'rebur-mobile-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ─── State ─────────────────────────────────────────────────────────── */
  let openDrawer = null;   // 'left' | 'right' | 'bottom' | null
  let controlsOn = false;

  /* ─── Panels (capture sidebar content into drawers) ─────────────────── */
  const PANELS = {
    left:   { sel: '#left-sidebar',  label: 'Scene Graph',    icon: '🌲' },
    right:  { sel: '#right-sidebar', label: 'Inspector',      icon: '🔍' },
    bottom: { sel: '#bottom-bar',    label: 'Console / Logs', icon: '📋' },
  };

  function openPanel(side, navBtn) {
    const cfg = PANELS[side];
    const panel = document.querySelector(cfg.sel);
    if (!panel) return;
    closePanel();

    // Override the hidden state with position:fixed overlay
    const isBottom = side === 'bottom';
    panel.style.cssText = `
      display: flex !important;
      position: fixed !important;
      z-index: 7500 !important;
      background: #1f2640 !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #2f3a5a !important;
      ${side === 'left'   ? 'top:0; bottom:58px; left:0; width:min(340px,92vw); border-radius:0 14px 14px 0; border-left:none; flex-direction:column;' : ''}
      ${side === 'right'  ? 'top:0; bottom:58px; right:0; width:min(340px,92vw); border-radius:14px 0 0 14px; border-right:none; flex-direction:column;' : ''}
      ${side === 'bottom' ? 'bottom:58px; left:0; right:0; width:100%; height:260px; border-radius:14px 14px 0 0; border-bottom:none; flex-direction:column;' : ''}
    `;

    document.getElementById('rm-backdrop').classList.add('rm-visible');
    openDrawer = { side, panel, navBtn };
    navBtn.classList.add('active');
  }

  function closePanel() {
    if (!openDrawer) return;
    openDrawer.panel.style.cssText = '';
    openDrawer.navBtn.classList.remove('active');
    openDrawer = null;
    document.getElementById('rm-backdrop')?.classList.remove('rm-visible');
  }

  /* ─── Navigation bar ────────────────────────────────────────────────── */
  function buildNav() {
    const nav = document.createElement('div');
    nav.id = 'rebur-nav';

    const items = [
      { id: 'rm-scene-btn', label: 'Scene',     icon: '🌲', action: (btn) => togglePanel('left', btn) },
      { id: 'rm-insp-btn',  label: 'Inspector', icon: '🔍', action: (btn) => togglePanel('right', btn) },
      { id: 'rm-log-btn',   label: 'Console',   icon: '📋', action: (btn) => togglePanel('bottom', btn) },
      { id: 'rm-ctrl-btn',  label: 'Controls',  icon: '🕹️',  action: (btn) => toggleControls(btn) },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'rm-nav-btn'; btn.id = item.id;
      btn.innerHTML = `<span class="rm-icon">${item.icon}</span>${item.label}`;
      btn.addEventListener('click', () => item.action(btn));
      nav.appendChild(btn);
    }

    document.body.appendChild(nav);

    // Backdrop
    const bd = document.createElement('div');
    bd.id = 'rm-backdrop'; bd.className = 'rm-backdrop';
    bd.addEventListener('click', closePanel);
    document.body.appendChild(bd);
  }

  function togglePanel(side, btn) {
    if (openDrawer?.side === side) { closePanel(); return; }
    openPanel(side, btn);
  }

  /* ─── Game controls ─────────────────────────────────────────────────── */
  function buildControls() {
    const wrap = document.createElement('div');
    wrap.id = 'rm-controls'; wrap.className = 'rm-hidden';

    // Joystick
    const joyWrap = document.createElement('div');
    joyWrap.id = 'rm-joystick';
    const base = document.createElement('div'); base.className = 'rm-joy-base';
    const thumb = document.createElement('div'); thumb.className = 'rm-joy-thumb';
    base.appendChild(thumb); joyWrap.appendChild(base); wrap.appendChild(joyWrap);

    // Action buttons
    const acts = document.createElement('div'); acts.id = 'rm-actions';
    const row1 = document.createElement('div'); row1.className = 'rm-act-row';
    const row2 = document.createElement('div'); row2.className = 'rm-act-row';

    const btnJump = makeBtn('rm-btn-jump',  '⬆️',  'JUMP',   ' ',  true);
    const btnAct  = makeBtn('rm-btn-act',   '⚡',  'ACT',    'e',  false);
    const btnAtk  = makeBtn('rm-btn-atk',   '⚔️',  'ATK',    'z',  false);

    row1.appendChild(btnJump);
    row1.appendChild(btnAct);
    row2.appendChild(btnAtk);
    acts.appendChild(row1); acts.appendChild(row2);
    wrap.appendChild(acts);
    document.body.appendChild(wrap);

    initJoystick(base, thumb);
  }

  function makeBtn(cls, emoji, label, key, large) {
    const btn = document.createElement('button');
    btn.className = `rm-btn ${cls}${large ? ' rm-lg' : ''}`;
    btn.innerHTML = `<span class="rm-bemoji">${emoji}</span><span class="rm-blabel">${label}</span>`;

    function fire(down) {
      const k = key === ' ' ? ' ' : key;
      const code = key === ' ' ? 'Space' : `Key${key.toUpperCase()}`;
      const evtInit = { key: k, code, bubbles: true, cancelable: true };
      const type = down ? 'keydown' : 'keyup';
      document.dispatchEvent(new KeyboardEvent(type, evtInit));
      window.dispatchEvent(new KeyboardEvent(type, evtInit));
      // Also fire on the canvas if present
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.dispatchEvent(new KeyboardEvent(type, evtInit));
    }

    btn.addEventListener('touchstart', e => { e.preventDefault(); btn.classList.add('pressed'); fire(true); }, { passive: false });
    btn.addEventListener('touchend',   e => { e.preventDefault(); btn.classList.remove('pressed'); fire(false); }, { passive: false });
    btn.addEventListener('touchcancel', () => { btn.classList.remove('pressed'); fire(false); });
    return btn;
  }

  function toggleControls(btn) {
    controlsOn = !controlsOn;
    document.getElementById('rm-controls').classList.toggle('rm-hidden', !controlsOn);
    btn.classList.toggle('active', controlsOn);
  }

  /* ─── Virtual Joystick ──────────────────────────────────────────────── */
  const DIRS = {
    left:  { arrow: 'ArrowLeft',  wasdKey: 'a', wasdCode: 'KeyA' },
    right: { arrow: 'ArrowRight', wasdKey: 'd', wasdCode: 'KeyD' },
    up:    { arrow: 'ArrowUp',    wasdKey: 'w', wasdCode: 'KeyW' },
    down:  { arrow: 'ArrowDown',  wasdKey: 's', wasdCode: 'KeyS' },
  };
  const held = { left: false, right: false, up: false, down: false };

  function fireDir(dir, down) {
    if (held[dir] === down) return;
    held[dir] = down;
    const d = DIRS[dir];
    const type = down ? 'keydown' : 'keyup';
    const targets = [document, window];
    const canvas = document.querySelector('canvas');
    if (canvas) targets.push(canvas);
    for (const [key, code] of [[d.arrow, d.arrow], [d.wasdKey, d.wasdCode]]) {
      const e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
      targets.forEach(t => t.dispatchEvent(e));
    }
  }

  function releaseAll() {
    for (const dir of ['left','right','up','down']) fireDir(dir, false);
  }

  function initJoystick(base, thumb) {
    const R = 58; // max displacement px
    const DEAD = 0.22;
    let tid = null, cx = 0, cy = 0;

    function update(x, y) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, R);
      const ang = Math.atan2(dy, dx);
      const tx = Math.cos(ang) * clamped;
      const ty = Math.sin(ang) * clamped;
      thumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
      const nx = dist > 8 ? dx / dist : 0;
      const ny = dist > 8 ? dy / dist : 0;
      fireDir('left',  nx < -DEAD);
      fireDir('right', nx >  DEAD);
      fireDir('up',    ny < -DEAD);
      fireDir('down',  ny >  DEAD);
    }

    base.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      tid = t.identifier;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      update(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (tid === null) return;
      const t = Array.from(e.touches).find(tt => tt.identifier === tid);
      if (!t) return;
      e.preventDefault();
      update(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchend', e => {
      if (tid === null) return;
      if (!Array.from(e.changedTouches).find(t => t.identifier === tid)) return;
      tid = null;
      thumb.style.transform = 'translate(-50%, -50%)';
      releaseAll();
    });

    window.addEventListener('touchcancel', () => {
      tid = null;
      thumb.style.transform = 'translate(-50%, -50%)';
      releaseAll();
    });
  }

  /* ─── Init ──────────────────────────────────────────────────────────── */
  function init() {
    // Only run inside the editor (not on the dashboard)
    if (!document.getElementById('layout') && !document.getElementById('gameview')) {
      // Try again shortly; editor DOM may not be ready
      if (document.getElementById('layout') === undefined) return;
    }
    injectCSS();
    buildNav();
    buildControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Editor bootstraps asynchronously; poll briefly
    let attempts = 0;
    const poll = setInterval(() => {
      if (document.getElementById('layout') || document.getElementById('gameview') || ++attempts > 20) {
        clearInterval(poll);
        init();
      }
    }, 300);
  }
})();
