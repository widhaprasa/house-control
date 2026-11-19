import './card.js';

const card = document.getElementById('card');
const log = document.getElementById('log');

window.addEventListener('ll-custom', (event) => {
  window.__lastEvent = event.detail;
  log.textContent = `ll-custom ${JSON.stringify(event.detail)}`;
});

const plan = await (await fetch('/dev/demo-plan.json')).json();
const states = {};

for (const light of plan.lights) {
  states[light.entity_id] = {
    entity_id: light.entity_id,
    state: 'on',
    attributes: {
      friendly_name: light.name,
      brightness: 180,
      color_temp_kelvin: 3000,
      rgb_color: [255, 160, 90],
    },
  };
}
for (const ac of plan.acs) {
  states[ac.entity_id] = {
    entity_id: ac.entity_id,
    state: 'cool',
    attributes: {
      friendly_name: ac.name,
      temperature: 23,
      current_temperature: 25,
      fan_mode: 'auto',
      swing_mode: 'off',
      hvac_modes: ['off', 'cool', 'heat'],
    },
  };
}

const event = (phase, extra) => ({ action: 'fire-dom-event', popup_menu: { phase, ...extra } });
const devices = {};
for (const light of plan.lights) {
  devices[light.id] = {
    tap_action: event('tap', { entity_id: light.entity_id }),
    hold_action: event('hold', { entity_id: light.entity_id }),
    double_tap_action: event('double', { entity_id: light.entity_id }),
  };
}
for (const ac of plan.acs) {
  devices[ac.id] = {
    tap_action: event('tap', { entity_id: ac.entity_id }),
    hold_action: event('hold', { entity_id: ac.entity_id }),
    double_tap_action: event('double', { entity_id: ac.entity_id }),
  };
}

const rooms = {};
for (const room of plan.rooms) {
  rooms[room.id] = {
    tap_action: event('tap', { room: room.id }),
    hold_action: event('hold', { room: room.id }),
    double_tap_action: event('double', { room: room.id }),
  };
}

const params = new URLSearchParams(location.search);
const config = {
  plan_url: '/dev/demo-plan.json',
  quality: 'low',
  devices,
  rooms,
  ...(params.has('transparent') ? { background: 'transparent' } : {}),
};
card.setConfig(config);
const serviceCalls = [];
window.__serviceCalls = serviceCalls;
card.hass = {
  states,
  callService: async (domain, service, data, target) => {
    serviceCalls.push({ domain, service, data, target });
  },
};
window.__houseCard = card;

if (new URLSearchParams(location.search).has('test')) {
  // Synthetic PointerEvents do not own a real pointerId; ignore pointer capture errors
  // from the world's camera controls during the test.
  const setCapture = HTMLCanvasElement.prototype.setPointerCapture;
  HTMLCanvasElement.prototype.setPointerCapture = function (id) {
    try { setCapture.call(this, id); } catch { /* synthetic pointer */ }
  };

  // Simulate Home Assistant setting the config again after the card is already up.
  setTimeout(() => card.setConfig(config), 1500);

  setTimeout(() => {
    card._fire?.({ action: 'fire-dom-event', popup_menu: { test: true } });
  }, 3000);

  // Find a real 3D target and send a pointer tap through the card's gesture handler.
  function findTarget(kind) {
    const canvas = card.shadowRoot.querySelector('.hc-canvas');
    const rect = canvas.getBoundingClientRect();
    for (let y = rect.top + 10; y < rect.bottom - 10; y += 10) {
      for (let x = rect.left + 10; x < rect.right - 10; x += 10) {
        const target = card._world?.pickAt(x, y);
        if (target && (!kind || target.kind === kind)) return { x, y, target };
      }
    }
    return null;
  }

  function findEmpty() {
    const canvas = card.shadowRoot.querySelector('.hc-canvas');
    const rect = canvas.getBoundingClientRect();
    for (let y = rect.top + 10; y < rect.bottom - 10; y += 10) {
      for (let x = rect.left + 10; x < rect.right - 10; x += 10) {
        if (!card._world?.pickAt(x, y)) return { x, y };
      }
    }
    return null;
  }

  function send(hit, type, extra = {}) {
    const canvas = card.shadowRoot.querySelector('.hc-canvas');
    return canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, clientX: hit.x, clientY: hit.y,
      button: 0, buttons: type === 'pointerdown' ? 1 : 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra,
    }));
  }

  setTimeout(() => {
    const hit = findTarget('room') || findTarget();
    if (!hit) return;
    window.__tapTarget = hit.target;
    send(hit, 'pointerdown');
    send(hit, 'pointerup');
    setTimeout(() => { window.__tapEvent = window.__lastEvent; }, 400);
  }, 3200);

  setTimeout(() => {
    const buttons = card.shadowRoot.querySelectorAll('.hc-floor');
    if (buttons[1]) {
      buttons[1].click();
      window.__floorSwitched = card._level;
    }
  }, 3800);

  setTimeout(() => {
    const hit = findTarget();
    if (!hit) return;
    send(hit, 'pointerdown');
    setTimeout(() => {
      send(hit, 'pointerup');
      setTimeout(() => { window.__holdEvent = window.__lastEvent; }, 100);
    }, 650);
  }, 4000);

  setTimeout(() => {
    const light = plan.lights[0];
    const ac = plan.acs[0];
    if (light) {
      card._fire({ action: 'toggle' }, { kind: 'light', id: light.id });
      card._fire({ action: 'call-service', service: 'script.turn_on', target: { entity_id: light.entity_id } }, { kind: 'light', id: light.id });
    }
    if (ac) card._fire({ action: 'toggle' }, { kind: 'ac', id: ac.id });
  }, 4800);

  setTimeout(() => {
    const hit = findTarget();
    if (!hit) return;
    send(hit, 'pointerdown');
    send(hit, 'pointerup');
    setTimeout(() => {
      send(hit, 'pointerdown');
      send(hit, 'pointerup');
    }, 80);
    setTimeout(() => { window.__doubleEvent = window.__lastEvent; }, 400);
  }, 5200);

  setTimeout(() => {
    window.__resetCalls = 0;
    const world = card._world;
    if (world) {
      const reset = world.resetView.bind(world);
      world.resetView = () => { window.__resetCalls += 1; reset(); };
    }
    // Move the camera away from its default so a reset is observable.
    const canvas = card.shadowRoot.querySelector('.hc-canvas');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: -160,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
  }, 5400);

  setTimeout(() => {
    window.__emptyPoint = findEmpty();
    if (!window.__emptyPoint) return;
    send(window.__emptyPoint, 'pointerdown');
    send(window.__emptyPoint, 'pointerup');
    setTimeout(() => { window.__singleReset = window.__resetCalls || 0; }, 50);
  }, 5520);

  setTimeout(() => {
    if (!window.__emptyPoint) return;
    send(window.__emptyPoint, 'pointerdown');
    send(window.__emptyPoint, 'pointerup');
    setTimeout(() => { window.__doubleReset = window.__resetCalls || 0; }, 300);
  }, 5640);

  setTimeout(() => {
    const root = card.shadowRoot;
    const canvas = root?.querySelector('.hc-canvas');
    const floors = [...(root?.querySelectorAll('.hc-floor') || [])].map((b) => ({
      name: b.querySelector('span')?.textContent,
      active: b.classList.contains('active'),
      count: b.querySelector('.hc-count')?.textContent,
    }));
    const error = root?.querySelector('.hc-error');
    window.__houseCheck = {
      canvas: !!canvas,
      background: root ? getComputedStyle(root.querySelector('.hc-card')).backgroundColor : null,
      width: canvas?.clientWidth || 0,
      height: canvas?.clientHeight || 0,
      floors,
      level: card._level,
      tapTarget: window.__tapTarget || null,
      tapEvent: window.__tapEvent || null,
      floorSwitched: window.__floorSwitched || null,
      holdEvent: window.__holdEvent || null,
      doubleEvent: window.__doubleEvent || null,
      singleReset: window.__singleReset ?? null,
      doubleReset: window.__doubleReset ?? null,
      error: error && !error.hidden ? error.textContent : null,
      serviceCalls: window.__serviceCalls || [],
      lastEvent: window.__lastEvent || null,
    };
    log.textContent = JSON.stringify(window.__houseCheck);
  }, 6200);
}
