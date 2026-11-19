# Home Assistant card — specification

Status: implemented in `../ha-house-control/`.

## Goal

`custom:house-control-card` renders the 3D home from the plan JSON inside a normal
Lovelace card, reflects Home Assistant entity states, and runs the configured tap, hold
and double-tap actions on lamps, ACs and rooms.

## Scope

- Web only.
- A normal Lovelace card; in a **panel view** it fills the panel.
- No fixed/full-screen `background: true` layout, no card-mod code, no theme, no child cards.
- Camera: drag to orbit, wheel/two-finger to pan, pinch/⌘-scroll to zoom, like the app.
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
plan: /local/house-control/plan.json       # URL or inline plan: {...}
quality: low                               # low | high
tooltip: true                              # hover name/status for lamps and ACs
# background: transparent                 # or a CSS color/gradient/image

# Actions per plan device id; add only the gestures you want
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

- There are no default actions. A lamp, AC or room without a `tap_action` does nothing on tap; hold/double still work when configured.
- Optional `background` is a CSS color, gradient/image, or `transparent`; CSS layers render behind a transparent 3D stage. Default `#0a0e1a`.
- Optional `tooltip` defaults to `true`; set it to `false` to disable the lamp/AC hover label.
- Optional `level` sets the initial floor id; otherwise the floor last chosen on this plan name is restored, then the first floor.
- `plan` can be a URL or the plan object inline.
- `rooms.<id>` configures that room's actions. There is no global room action.
- Keys are plan ids, not HA entity ids.

## Actions

Supported actions: `fire-dom-event`, `toggle`, `turn_on`, `turn_off` and `call-service`.
Use `toggle` for off → on / on → off, or `turn_on` for on-only.

### Call a service

```yaml
devices:
  living.main:
    tap_action:
      action: call-service
      service: light.turn_on
      data:
        brightness_pct: 80
      # optional; otherwise the plan device's entity_id is used
      target:
        entity_id: light.bardi_9w_rgbww_bulb
```

`service` is `domain.service`; `data` is the service data; `target` is optional and lets a
room or a fixed entity be the service target.

`fire-dom-event` dispatches exactly the configured action, with no automatic `entity_id`,
room or target added:

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
- A drag moves the camera; a gesture only fires when the pointer stays within about 5 px.
- Double-click or double-tap empty space outside the home (no room, lamp or AC under the
  pointer) resets the camera to the plan's default view. One empty tap does nothing.
- Hovering a lamp or AC shows a tooltip with its name and status; moving off the device
  hides it. Hover is desktop-only.

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
- The 3D stage keeps the app's camera controls: drag to orbit, wheel or two fingers to pan, pinch or ⌘-scroll to zoom. The card captures touches over the stage, so use a panel view or a full-size section.
- If WebGL is unavailable or the browser cannot create a usable context, the card shows a message with a Reload page button.

## Floor switcher

- Bottom-center, like the panel in `index.html`.
- One pill per floor, lowest first.
- Active floor highlighted.
- Shows the number of lit lamps on that floor.
- Hidden when the plan has only one floor.
- Clicking a floor calls `world.setLevel(...)`.

Recommended: remember the last floor per plan in `localStorage`.

## Plan loading

- `fetch(plan)` for a URL, with no-store caching and a timeout.
- Relative URLs resolve against the Home Assistant origin (`/local/...` works).
- External URLs need CORS and HTTPS.
- Validate with `normalize`; show a card error with a Reload page button on failure.
- `plan` may also be an inline plan object for testing.
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

- `background: true` full-screen layout, fixed positioning, theme-specific styling, card-mod integration.
- Child cards inside the 3D card.
- `more-info`, `url` and `navigate` actions.
- Room entity ids in the plan/editor.
- Auto-refreshing the plan.
- HACS packaging.

## Acceptance tests

- Card loads a plan from `/local/...` in a panel view and fills the panel.
- `background: transparent` shows the HA card/page behind the stage; a color sets the stage background; a gradient/image renders behind a transparent canvas.
- Rounded and diagonal rooms render.
- Lamps/ACs reflect Home Assistant state changes.
- Tap, hold and double tap run their configured action (`fire-dom-event`, `toggle`, `turn_on`, `turn_off` or `call-service`).
- Per-device and per-room actions fire correctly.
- A target without `tap_action` does nothing on tap; actions fire only when configured.
- Double-click/tap outside the home resets a moved camera; single empty taps do nothing; target double-tap actions still fire.
- Hovering a lamp/AC shows its name/status; leaving hides the tooltip; `tooltip: false` disables it.
- A `popup_menu` listener receives the user's manually inserted `entity_id`.
- Direct `toggle` (including climate on/off) and `call-service` actions call the right service.
- Room taps fire the room action; rooms without config do nothing.
- Floor switcher switches floors and counts lit lamps.
- Invalid/missing plan shows the error state, not a crash.
- `quality: low` and `high` work; rendering pauses off-screen.
- The built JS is the only artifact needed, besides the plan JSON.

## Naming note

The per-device map is called `devices:` because its keys are plan device ids, not HA
entity ids. An `entities:` alias can be accepted later if preferred.
