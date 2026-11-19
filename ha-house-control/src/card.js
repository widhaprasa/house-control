// A normal Lovelace card for the House Control plan. It renders the 3D home, reflects
// Home Assistant entity states, and fires ll-custom events for taps on lamps, ACs and rooms.
import { normalize } from '../../web/src/config.js';
import { createWorld } from '../../web/src/three/world.js';
import { createHAStore } from './store.js';
import css from './card.css?inline';

const QUALITY = new Set(['low', 'high']);
const LONG_PRESS = 500;
const DOUBLE_TAP = 300;
const MOVE_LIMIT = 8;
const STAGE_BG = '#0a0e1a';

class HouseControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>${css}</style>
      <div class="hc-card">
        <canvas class="hc-canvas"></canvas>
        <div class="hc-loading">Loading the home…</div>
        <div class="hc-error" hidden></div>
        <div class="hc-preview" hidden>
          <strong>House Control</strong>
          <span>The 3D home appears when the dashboard is saved.</span>
        </div>
        <div class="hc-floors" hidden></div>
      </div>`;

    this._root = this.shadowRoot.querySelector('.hc-card');
    this._canvas = this.shadowRoot.querySelector('.hc-canvas');
    this._loading = this.shadowRoot.querySelector('.hc-loading');
    this._error = this.shadowRoot.querySelector('.hc-error');
    this._previewEl = this.shadowRoot.querySelector('.hc-preview');
    this._floors = this.shadowRoot.querySelector('.hc-floors');

    this._config = null;
    this._hass = null;
    this._plan = null;
    this._store = null;
    this._world = null;
    this._level = null;
    this._token = 0;
    this._visible = true;
    this._preview = false;
    this._worldFailed = false;
    this._gesture = null;
    this._gestures = false;
    this._lastTap = null;
    this._tapTimer = 0;
    this._fetchController = null;
    this._fetchTimer = 0;

    this._onPointerDown = (ev) => this._pointerDown(ev);
    this._onPointerMove = (ev) => this._pointerMove(ev);
    this._onPointerUp = (ev) => this._pointerUp(ev);
    this._onPointerCancel = () => this._cancelGesture();
    this._onContextMenu = (ev) => ev.preventDefault();
    this._onVisibility = () => this._applyRunning();
    this._onContextLost = (ev) => {
      ev.preventDefault();
      this._world?.setRunning(false);
      this._showError(true, 'The 3D view lost its graphics context. Reload the page.');
    };
  }

  static getStubConfig() {
    return { plan_url: '/local/house-control/plan.json', quality: 'low', devices: {}, rooms: {} };
  }

  setConfig(config) {
    if (!config || (!config.plan_url && !config.plan)) {
      throw new Error('house-control-card needs "plan_url" (or an inline "plan")');
    }
    this._config = { quality: 'low', devices: {}, rooms: {}, ...config };
    this._teardown();
    if (this.isConnected) this._start();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._store) {
      this._store.updateFromHass(hass);
      this._updateFloors();
    }
  }

  // Home Assistant sets this while the card is shown in the card editor preview. Keep the
  // preview light: do not create a WebGL context just to show a tiny editor thumbnail.
  set preview(value) {
    const next = Boolean(value);
    if (next === this._preview) return;
    this._preview = next;
    if (next) {
      this._teardown();
      this._showPreview();
    } else {
      this._start();
    }
  }

  connectedCallback() {
    this._start();
  }

  disconnectedCallback() {
    this._teardown();
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 'full', rows: 'auto', min_rows: 4 };
  }

  /* ---------- plan + scene ---------- */

  async _start() {
    if (!this.isConnected || !this._config) return;
    if (this._preview) {
      this._showPreview();
      return;
    }
    this._teardown();
    this._hidePreview();
    this._worldFailed = false;
    const token = this._token;
    this._showError(false);
    this._showLoading(true);

    try {
      const raw = this._config.plan
        ? structuredClone(this._config.plan)
        : await this._fetchPlan(this._config.plan_url);
      if (token !== this._token || !this.isConnected) return;

      const plan = normalize(structuredClone(raw));
      if (token !== this._token || !this.isConnected) return;
      this._plan = plan;

      const store = createHAStore(plan);
      this._store = store;
      if (this._hass) store.updateFromHass(this._hass);

      this._level = this._initialLevel(plan);
      this._buildFloors();
      this._updateFloors();
      this._resetCanvas();
      this._ensureObservers();
      this._attachGestures();
      this._unsub = store.on(() => this._updateFloors());

      this._maybeCreateWorld();
    } catch (error) {
      if (token !== this._token) return;
      this._showLoading(false);
      this._showError(true, this._friendlyError(error));
    }
  }

  _maybeCreateWorld() {
    if (!this._plan || this._world || !this.isConnected || this._preview || this._worldFailed) return;
    if (!this._canvas.clientWidth || !this._canvas.clientHeight) return;
    try {
      this._world = createWorld(this._canvas, this._plan, this._store, {
        level: this._level,
        quality: QUALITY.has(this._config.quality) ? this._config.quality : 'low',
        controls: true,
        background: STAGE_BG,
        onHover: () => {},
        onPick: () => {},
        onLevel: (id) => { this._level = id; this._updateFloors(); },
      });
      this._canvas.addEventListener('webglcontextlost', this._onContextLost, false);
      this._world.setInsets(0, 0);
      this._world.resize();
      this._applyRunning();
      this._updateFloors();
      this._showLoading(false);
      this._hidePreview();
    } catch (error) {
      this._worldFailed = true;
      this._showLoading(false);
      this._showError(true, this._friendlyError(error));
    }
  }

  async _fetchPlan(url) {
    if (!url) throw new Error('No plan_url');
    const absolute = new URL(url, window.location.origin);
    const controller = new AbortController();
    this._fetchController = controller;
    this._fetchTimer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(absolute, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Plan not found (HTTP ${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(this._fetchTimer);
    }
  }

  _teardown() {
    this._token += 1;
    this._fetchController?.abort();
    this._fetchController = null;
    clearTimeout(this._fetchTimer);
    this._fetchTimer = 0;

    this._resizeObserver?.disconnect();
    this._intersection?.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);

    this._canvas.removeEventListener('webglcontextlost', this._onContextLost, false);
    this._detachGestures();
    this._clearPendingTap();
    this._cancelGesture();

    this._unsub?.();
    this._unsub = null;
    this._store = null;
    if (this._world) {
      this._world.dispose();
      this._world = null;
    }
    this._plan = null;
    this._level = null;
    this._floors.hidden = true;
    this._floors.replaceChildren();
    this._showError(false);
    this._showLoading(false);
    this._hidePreview();
  }

  _ensureObservers() {
    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._world) this._world.resize();
        else this._maybeCreateWorld();
      });
    }
    if (!this._intersection) {
      this._intersection = new IntersectionObserver(([entry]) => {
        this._visible = entry.isIntersecting;
        if (this._visible) this._maybeCreateWorld();
        this._applyRunning();
      });
    }
    this._resizeObserver.observe(this._root);
    this._intersection.observe(this);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _applyRunning() {
    if (!this._world) return;
    this._world.setRunning(this._visible !== false && !document.hidden);
  }

  _initialLevel(plan) {
    const ids = new Set(plan.levels.map((l) => l.id));
    const saved = this._savedLevel(plan);
    if (this._config.level && ids.has(this._config.level)) return this._config.level;
    if (saved && ids.has(saved)) return saved;
    return plan.levels[0].id;
  }

  _levelKey(plan = this._plan) {
    return `house-control:level:${plan?.name || 'home'}`;
  }

  _savedLevel(plan) {
    try { return localStorage.getItem(this._levelKey(plan)); } catch { return null; }
  }

  _setLevel(id) {
    this._level = id;
    try { localStorage.setItem(this._levelKey(), id); } catch { /* private mode */ }
    this._world?.setLevel(id);
    this._updateFloors();
  }

  _buildFloors() {
    const levels = this._plan?.levels || [];
    if (levels.length < 2) {
      this._floors.hidden = true;
      return;
    }
    this._floors.replaceChildren(...levels.map((l) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hc-floor';
      button.dataset.level = l.id;
      button.setAttribute('aria-label', l.name);
      const name = document.createElement('span');
      name.textContent = l.name;
      const count = document.createElement('span');
      count.className = 'hc-count zero';
      count.textContent = '0';
      button.append(name, count);
      button.addEventListener('click', () => this._setLevel(l.id));
      return button;
    }));
    this._floors.hidden = false;
  }

  _updateFloors() {
    if (!this._plan || this._floors.hidden) return;
    const lit = new Map();
    const byId = new Map(this._plan.lights.map((l) => [l.id, l]));
    for (const [id, state] of Object.entries(this._store?.state.lights || {})) {
      if (!state.on) continue;
      const cfg = byId.get(id);
      if (cfg) lit.set(cfg.level, (lit.get(cfg.level) || 0) + 1);
    }
    for (const button of this._floors.querySelectorAll('.hc-floor')) {
      const id = button.dataset.level;
      button.classList.toggle('active', id === this._level);
      const count = button.querySelector('.hc-count');
      const n = lit.get(id) || 0;
      count.textContent = String(n);
      count.classList.toggle('zero', n === 0);
    }
  }

  /* ---------- taps, holds, double taps ---------- */

  // After world.dispose() the old canvas has a force-lost context. Replacing the canvas
  // gives the next renderer a clean context instead of trying to revive a dead one.
  _resetCanvas() {
    this._detachGestures();
    const next = document.createElement('canvas');
    next.className = 'hc-canvas';
    this._canvas.replaceWith(next);
    this._canvas = next;
  }

  _attachGestures() {
    if (this._gestures) return;
    this._canvas.addEventListener('pointerdown', this._onPointerDown);
    this._canvas.addEventListener('pointermove', this._onPointerMove);
    this._canvas.addEventListener('pointerup', this._onPointerUp);
    this._canvas.addEventListener('pointercancel', this._onPointerCancel);
    this._canvas.addEventListener('pointerleave', this._onPointerCancel);
    this._canvas.addEventListener('contextmenu', this._onContextMenu);
    this._gestures = true;
  }

  _detachGestures() {
    if (!this._gestures) return;
    this._canvas.removeEventListener('pointerdown', this._onPointerDown);
    this._canvas.removeEventListener('pointermove', this._onPointerMove);
    this._canvas.removeEventListener('pointerup', this._onPointerUp);
    this._canvas.removeEventListener('pointercancel', this._onPointerCancel);
    this._canvas.removeEventListener('pointerleave', this._onPointerCancel);
    this._canvas.removeEventListener('contextmenu', this._onContextMenu);
    this._gestures = false;
  }

  _pointerDown(ev) {
    if (!ev.isPrimary || ev.button !== 0 || !this._world) return;
    this._clearLong();
    const target = this._world.pickAt(ev.clientX, ev.clientY) || null;
    const gesture = this._gesture = {
      x: ev.clientX, y: ev.clientY, moved: false, long: false, target, timer: 0,
    };
    if (!target) return;
    gesture.timer = setTimeout(() => {
      if (this._gesture !== gesture || gesture.moved || gesture.long) return;
      gesture.long = true;
      const actions = this._actionsFor(target);
      if (actions?.hold_action) this._fire(actions.hold_action);
    }, LONG_PRESS);
  }

  _pointerMove(ev) {
    if (!ev.isPrimary) { this._cancelGesture(); return; }
    const gesture = this._gesture;
    if (!gesture) return;
    if (Math.hypot(ev.clientX - gesture.x, ev.clientY - gesture.y) > MOVE_LIMIT) {
      gesture.moved = true;
      this._clearLong(gesture);
    }
  }

  _pointerUp(ev) {
    if (!ev.isPrimary) { this._cancelGesture(); return; }
    const gesture = this._gesture;
    this._gesture = null;
    if (!gesture) return;
    this._clearLong(gesture);
    if (gesture.moved || gesture.long || !gesture.target) return;
    this._handleTap(gesture.target);
  }

  _cancelGesture() {
    this._gesture = null;
    this._clearLong();
  }

  _clearLong(gesture = this._gesture) {
    if (gesture?.timer) clearTimeout(gesture.timer);
    if (gesture) gesture.timer = 0;
  }

  _actionsFor(target) {
    if (!target) return null;
    const list = target.kind === 'room' ? this._config?.rooms : this._config?.devices;
    return list?.[target.id] || null;
  }

  _handleTap(target) {
    const actions = this._actionsFor(target);
    if (!actions) return;

    if (!actions.double_tap_action) {
      this._clearPendingTap();
      if (actions.tap_action) this._fire(actions.tap_action);
      return;
    }

    const now = performance.now();
    const last = this._lastTap;
    if (last && now - last.time <= DOUBLE_TAP
      && last.target.kind === target.kind && last.target.id === target.id) {
      this._clearPendingTap();
      this._fire(actions.double_tap_action);
      return;
    }

    this._clearPendingTap();
    this._lastTap = { time: now, target };
    this._tapTimer = setTimeout(() => {
      this._tapTimer = 0;
      this._lastTap = null;
      if (actions.tap_action) this._fire(actions.tap_action);
    }, DOUBLE_TAP);
  }

  _clearPendingTap() {
    if (this._tapTimer) clearTimeout(this._tapTimer);
    this._tapTimer = 0;
    this._lastTap = null;
  }

  _fire(action) {
    if (!action || action.action !== 'fire-dom-event') return;
    this.dispatchEvent(new CustomEvent('ll-custom', {
      detail: action,
      bubbles: true,
      composed: true,
    }));
  }

  /* ---------- loading and errors ---------- */

  _showLoading(show) {
    this._loading.hidden = !show;
  }

  _showPreview() {
    this._showError(false);
    this._showLoading(false);
    this._floors.hidden = true;
    this._previewEl.hidden = false;
  }

  _hidePreview() {
    this._previewEl.hidden = true;
  }

  _friendlyError(error) {
    const message = String(error?.message || error);
    if (/WebGL|precision|context/i.test(message)) {
      return 'WebGL is not available in this browser. Enable hardware acceleration, or open the dashboard in a browser that supports WebGL.';
    }
    return message;
  }

  _showError(show, message = '') {
    if (!show) {
      this._error.hidden = true;
      this._error.replaceChildren();
      return;
    }
    this._loading.hidden = true;
    this._error.hidden = false;
    const text = document.createElement('span');
    text.textContent = `The home could not be shown. ${message}`.trim();
    const actions = document.createElement('div');
    actions.className = 'hc-error-actions';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload page';
    reload.addEventListener('click', () => location.reload());
    actions.append(reload);
    this._error.replaceChildren(text, actions);
  }
}

if (!customElements.get('house-control-card')) customElements.define('house-control-card', HouseControlCard);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'house-control-card')) {
  window.customCards.push({
    type: 'house-control-card',
    name: 'House Control',
    description: 'The 3D home, with Home Assistant entity states and ll-custom actions.',
  });
}
