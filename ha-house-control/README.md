# House Control card

A Home Assistant Lovelace card that shows the 3D home from the plan JSON and fires
`fire-dom-event` actions when a lamp, AC or room is tapped.

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

There are no global/default actions. A lamp, AC or room without an entry does nothing.

## Actions

Only `fire-dom-event` is supported. The card dispatches:

```js
new CustomEvent('ll-custom', {
  detail: action,          // your config, unchanged
  bubbles: true,
  composed: true,
})
```

No `entity_id` or target is added automatically. Add it yourself under your event key.

Gestures: `tap_action`, `hold_action` (about 500 ms), `double_tap_action` (about 300 ms;
the single tap waits for the double window).

## Development

```bash
npm run dev
```

The dev page uses `dev/demo-plan.json` (a two-floor demo with rounded rooms), mock Home
Assistant states, and logs `ll-custom` events at the bottom. Open `/?test` to run the
self-check (canvas, floor switcher, tap/hold/double, floor change).

`plan.json` fields for lamps and ACs are `entity_id`; rooms have no entity.
