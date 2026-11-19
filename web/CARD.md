# Home Assistant card — specification

Status: implemented in `../ha-house-control/`.

## Goal

`custom:house-control-card` renders the 3D home from the plan JSON inside a normal
Lovelace card, reflects Home Assistant entity states, and fires `fire-dom-event` actions
from taps, long presses and double taps on lamps, ACs and rooms.

## Scope

- Web only.
- A normal Lovelace card; in a **panel view** it fills the panel.
- No `background` mode, no card-mod code, no theme, no child cards.
- No camera orbit; gestures only.
- The plan is loaded once per card load.
- Ship a single JS bundle; no HACS packaging.

The user may style the card with their own card-mod if they want it fixed/full-screen.

## Plan JSON

Produced by the standalone editor (`editor.html`).

- Lamps and ACs carry an optional Home Assistant entity id:
  ```jsonc
  { "id": "living.main", "room": "living", "type": "ceiling", "pos": [2.9, 6.0],
    "entity_id": "light.living_room_main" }
  { "id": "living.ac", "room": "living", "wall": "west", "pos": [0, 4.45],
    "entity_id": "climate.living_room" }
  ```
- No actions are stored in the plan.
- Rooms have no entity id.

The editor writes `entity_id`; older plans that still have `entity` are migrated when the
field is edited.

## Card configuration

```yaml
type: custom:house-control-card
plan_url: /local/house-control/plan.json   # or inline plan: {...}
quality: low                               # low | high

# Actions per plan device id; there are no default/global actions
devices:
  living.main:
    tap_action:
      action: fire-dom-event
      popup_menu:
        entity_id: light.living_room_main
    hold_action:
      action: fire-dom-event
      popup_menu:
        entity_id: light.living_room_main
    double_tap_action:
      action: fire-dom-event
      popup_menu:
        entity_id: light.living_room_main
  living.ac:
    tap_action:
      action: fire-dom-event
      popup_menu:
        entity_id: climate.living_room

# Per room id; rooms without an entry do nothing
rooms:
  living:
    tap_action:
      action: fire-dom-event
      popup_menu:
        # room menu
```

- Every lamp/AC gets its actions under `devices.<id>`. There is no default/global action; a device without an entry does nothing.
- `rooms.<id>` configures that room's actions. There is no global room action.
- Keys are plan ids, not HA entity ids.

## Actions

Only `fire-dom-event` is implemented for v1. No action means nothing happens.

The card dispatches exactly the configured action, with no automatic `entity_id`, room or
target added:

```js
this.dispatchEvent(new CustomEvent('ll-custom', {
  detail: action,   // e.g. { action: 'fire-dom-event', popup_menu: {...} }
  bubbles: true,
  composed: true,
}));
```

The user inserts `entity_id` manually where their listener expects it, for example:

```yaml
tap_action:
  action: fire-dom-event
  popup_menu:
    entity_id: light.living_room_main
```

### Gestures

- `tap_action`: short press, no movement.
- `hold_action`: about 500 ms without movement; suppresses the tap.
- `double_tap_action`: two taps within about 300 ms; when configured, the single tap waits
  for that window.
- Lamps and ACs win over room floors when both are under the pointer.
- No camera drag/zoom. Vertical page scrolling remains available.

## State mapping

The plan's `entity_id` is the state binding for the 3D scene.

- `light.*`, `switch.*`, `input_boolean.*`
  - on/off
  - brightness (`attributes.brightness / 255`)
  - colour temperature (`color_temp_kelvin`, or mireds converted to K)
  - colour (`rgb_color` → hex)
- `climate.*`
  - on/off
  - target temperature
  - HVAC mode (`fan_only` → fan, `heat_cool` → auto)
  - fan mode, swing mode
  - current temperature
- Unbound devices and missing/unavailable entities are shown off.

The card does not modify the plan's state entity from the action config; the action config
is only passed to `ll-custom`.

## Scene

- Reuse the existing Three.js world, house, lamps and ACs.
- Fill the panel in a panel view; `ResizeObserver` keeps the canvas sized.
- `quality: low` — no bloom, reduced/no shadows, capped pixel ratio.
- `quality: high` — full bloom and shadows.
- Default `low`.
- Pause rendering when the card is off-screen or the browser tab is hidden.
- Dispose the renderer and listeners when the card is removed.
- The plan's camera and levels are used.

## Floor switcher

- Bottom-center, like the panel in `index.html`.
- One pill per floor, lowest first.
- Active floor highlighted.
- Shows the number of lit lamps on that floor.
- Hidden when the plan has only one floor.
- Clicking a floor calls `world.setLevel(...)`.

Recommended: remember the last floor per plan in `localStorage`.

## Plan loading

- `fetch(plan_url)` with no-store caching and a timeout.
- Relative URLs resolve against the Home Assistant origin (`/local/...` works).
- External URLs need CORS and HTTPS.
- Validate with `normalize`; show a card error with **Retry** on failure.
- Inline `plan:` is an optional fallback for testing.
- Load once; reload the dashboard to pick up a changed plan.

## Build and install

The card lives in [`../ha-house-control/`](../ha-house-control/).

```bash
cd ha-house-control
npm install
npm run build
```

- The bundle is `ha-house-control/dist/house-control-card.js`.
- Copy it to `/config/www/house-control/house-control-card.js`.
- Add a Lovelace **JavaScript module** resource:
  `/local/house-control/house-control-card.js`.
- Put the plan at `/config/www/house-control/plan.json`.
- No HACS; no package registry.

## Editor

The standalone editor writes `entity_id` on lamps and ACs (older `entity` values are
migrated when edited). The Bindings dialog and duplicate/export logic use the same field.

## Out of scope for v1

- `background: true`, fixed positioning, transparent themes, card-mod integration.
- Child cards inside the 3D card.
- `more-info`, `toggle`, `call-service`, `url`, `navigate` actions.
- Room entity ids in the plan/editor.
- Auto-refreshing the plan.
- Camera orbit/zoom in the card.
- HACS packaging.

## Acceptance tests

- Card loads a plan from `/local/...` in a panel view and fills the panel.
- Rounded and diagonal rooms render.
- Lamps/ACs reflect Home Assistant state changes.
- Tap, hold and double tap fire `ll-custom` with the exact configured action config.
- Per-device and per-room actions fire correctly; a lamp/AC or room without config does nothing.
- A `popup_menu` listener receives the user's manually inserted `entity_id`.
- Room taps fire the room action; rooms without config do nothing.
- Floor switcher switches floors and counts lit lamps.
- Invalid/missing plan shows the error state, not a crash.
- `quality: low` and `high` work; rendering pauses off-screen.
- The built JS is the only artifact needed, besides the plan JSON.

## Naming note

The per-device map is called `devices:` because its keys are plan device ids, not HA
entity ids. An `entities:` alias can be accepted later if preferred.
