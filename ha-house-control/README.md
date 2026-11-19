# House Control card

A Home Assistant Lovelace card that shows the 3D home from the plan JSON and runs the
configured actions when a lamp, AC or room is tapped.

The full specification is in [`../web/CARD.md`](../web/CARD.md).

## Build

```bash
cd ha-house-control
npm install
npm run build
```

The bundle is `dist/house-control-card.js`.

## Install

1. Copy `dist/house-control-card.js` to `/config/www/house-control/house-control-card.js`.
2. Add it as a **JavaScript module** resource:
   `/local/house-control/house-control-card.js`.
3. Put the plan JSON at `/config/www/house-control/plan.json`.
4. Add the card to a panel view.

```yaml
type: custom:house-control-card
plan_url: /local/house-control/plan.json
quality: low
# background: transparent   # default #0a0e1a; transparent follows the HA card

devices:
  living.main:
    tap_action:
      action: fire-dom-event
      popup_menu:
        entity_id: light.living_room_main
  living.ac:
    tap_action:
      action: fire-dom-event
      popup_menu:
        entity_id: climate.living_room

rooms:
  living:
    tap_action:
      action: fire-dom-event
      popup_menu:
        room: living
```


## Background

The 3D stage is `#0a0e1a` by default. Set `background: transparent` to let the Home
Assistant card/page background show through, or use any CSS color:

```yaml
background: transparent
```

This is the card stage color, not Lovelace's `background: true` layout option. The
dashboard background itself comes from your Home Assistant theme/dashboard.

## Generate the card config from a plan

```bash
node scripts/plan-to-config.mjs path/to/plan.json > house-control-card.yaml
```

or:

```bash
npm run --silent config -- path/to/plan.json > house-control-card.yaml
```

Options:

- `--plan-url /local/house-control/plan.json` — the URL the card will fetch.
- `--quality low|high` — defaults to `low`.
- `--no-actions` — emit only the card header (type, plan URL and quality), without actions.

The generated config has per-device and per-room `tap_action` / `hold_action` /
`double_tap_action` entries, all using `action: fire-dom-event` with a `popup_menu`
containing the device `entity_id` or the room id. Edit those `popup_menu` blocks for your
own listener. Lamps/ACs without an `entity_id` are skipped and listed on stderr.

## Actions

Supported: `fire-dom-event`, `toggle`, `turn_on`, `turn_off`, `call-service`.

There are no default actions. A lamp, AC or room without `tap_action` does nothing on
tap. For a lamp that toggles, add:

```yaml
devices:
  <plan-lamp-id>:
    tap_action:
      action: toggle
      entity_id: light.bardi_9w_rgbww_bulb
```

Use `action: turn_on` for on-only (off → on; on does nothing).

### Call a service

```yaml
devices:
  living.main:
    tap_action:
      action: call-service
      service: light.turn_on
      data:
        brightness_pct: 80
        rgb_color: [255, 170, 90]
      # Optional. Omit it to use the clicked lamp's plan entity_id.
      target:
        entity_id: light.bardi_9w_rgbww_bulb
```

- `service` is `domain.service`, e.g. `light.turn_on`, `climate.set_temperature`,
  `script.turn_on`, `scene.turn_on`.
- `data` is the service data (brightness, temperature, etc.).
- `target` is optional. Without it the card uses the clicked device's plan `entity_id`
  (or `entity_id` on the action itself).
- Works for `tap_action`, `hold_action` and `double_tap_action`, and for rooms when you
  give an explicit `target`.

`fire-dom-event` dispatches:

```js
new CustomEvent('ll-custom', {
  detail: action,          // your config, unchanged
  bubbles: true,
  composed: true,
})
```

For `fire-dom-event`, no `entity_id` or target is added automatically; add it yourself under your event key.

Gestures: `tap_action`, `hold_action` (about 500 ms), `double_tap_action` (about 300 ms;
the single tap waits for the double window). The 3D stage keeps the app's camera: drag to
orbit, wheel or two fingers to pan, pinch or ⌘-scroll to zoom.

## Development

```bash
npm run dev
```

The dev page uses `dev/demo-plan.json` (a two-floor demo with rounded rooms), mock Home
Assistant states, and logs `ll-custom` events at the bottom. Open `/?test` to run the
self-check (canvas, floor switcher, tap/hold/double, direct actions, floor change), or
`/?transparent` to preview a transparent stage.

`plan.json` fields for lamps and ACs are `entity_id`; rooms have no entity.
