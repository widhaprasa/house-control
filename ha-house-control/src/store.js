// Home Assistant state adapter for the 3D card. Keeps the state shape world.js expects:
// state.lights[id] = { on, brightness, temp, color }
// state.acs[id]    = { on, target, mode, fan, swing, sleep, eco, roomTemp, idle }
const AC_MODES = new Set(['cool', 'heat', 'dry', 'fan', 'auto']);
const FAN_MODES = new Set(['auto', 'low', 'medium', 'high', 'turbo']);

const entityOf = (device) => device?.entity_id || device?.entity || null;

function hexColor(rgb) {
  if (!Array.isArray(rgb)) return null;
  const bytes = rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(Number(v) || 0))));
  if (bytes.length < 3) return null;
  return `#${bytes.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function lightState(cfg, hass) {
  const stateObj = hass?.states?.[entityOf(cfg)];
  if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
    return { on: false, brightness: 0, temp: 3000, color: null };
  }
  const a = stateObj.attributes || {};
  const temp = Number.isFinite(a.color_temp_kelvin) ? a.color_temp_kelvin
    : Number.isFinite(a.color_temp) && a.color_temp > 0 ? Math.round(1e6 / a.color_temp)
      : 3000;
  return {
    on: stateObj.state === 'on',
    brightness: Number.isFinite(a.brightness) ? Math.min(1, Math.max(0.02, a.brightness / 255)) : 1,
    temp,
    color: hexColor(a.rgb_color),
  };
}

const offAC = (plan) => ({
  on: false, target: 24, mode: 'cool', fan: 'auto', swing: 'swing',
  sleep: false, eco: false, roomTemp: Math.min((plan.outdoorTemp ?? 27) - 2, 27), idle: false,
});

function acState(cfg, hass, plan) {
  const fallbackTemp = Math.min((plan.outdoorTemp ?? 27) - 2, 27);
  const stateObj = hass?.states?.[entityOf(cfg)];
  if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown' || stateObj.state === 'off') {
    return offAC(plan);
  }
  const a = stateObj.attributes || {};
  const target = Number.isFinite(a.temperature) ? a.temperature
    : Number.isFinite(a.target_temp_low) && Number.isFinite(a.target_temp_high)
      ? (a.target_temp_low + a.target_temp_high) / 2
      : 24;
  const rawMode = a.hvac_mode || stateObj.state;
  const mode = rawMode === 'fan_only' ? 'fan' : rawMode === 'heat_cool' ? 'auto' : AC_MODES.has(rawMode) ? rawMode : 'auto';
  const preset = String(a.preset_mode || '').toLowerCase();
  return {
    on: true,
    target,
    mode,
    fan: FAN_MODES.has(a.fan_mode) ? a.fan_mode : 'auto',
    swing: a.swing_mode === 'off' ? 'off' : 'swing',
    sleep: preset.includes('sleep'),
    eco: preset.includes('eco'),
    roomTemp: Number.isFinite(a.current_temperature) ? a.current_temperature : fallbackTemp,
    idle: false,
  };
}

export function createHAStore(plan) {
  const listeners = new Set();
  const signatures = new Map();
  const state = { lights: {}, acs: {} };

  for (const l of plan.lights) {
    state.lights[l.id] = { on: false, brightness: 0.8, temp: 3000, color: l.color || null };
  }
  for (const a of plan.acs) state.acs[a.id] = offAC(plan);

  function emit(change) {
    for (const fn of listeners) fn(change);
  }

  function updateFromHass(hass) {
    for (const l of plan.lights) {
      const next = lightState(l, hass);
      const key = JSON.stringify(next);
      if (signatures.get(l.id) === key) continue;
      signatures.set(l.id, key);
      Object.assign(state.lights[l.id], next);
      emit({ type: 'light', id: l.id });
    }
    for (const a of plan.acs) {
      const next = acState(a, hass, plan);
      const key = JSON.stringify(next);
      if (signatures.get(a.id) === key) continue;
      signatures.set(a.id, key);
      Object.assign(state.acs[a.id], next);
      emit({ type: 'ac', id: a.id });
    }
  }

  return {
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    updateFromHass,
  };
}
