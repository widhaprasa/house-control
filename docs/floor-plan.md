# The floor plan file

A home is one JSON document. The 3D scene, the panel and the editor are all built from it, so swapping the
file swaps the home.

- Your plan: `~/Library/Application Support/HouseControl/plan.json`
- Bundled demos: [`web/public/plans/home.json`](../web/public/plans/home.json),
  [`studio.json`](../web/public/plans/studio.json) and, on two floors, [`house.json`](../web/public/plans/house.json)

You rarely need to write it by hand — **Edit Home…** does it for you — but it is plain, stable and easy to
generate or version. Load a file with **Load Floor Plan…** in the menu bar icon's right-click menu, or with
**Import…** in the editor.

<p align="center">
  <img src="studio.png" width="300" alt="The Studio demo plan">
</p>

## Coordinates

Everything is in metres, seen from above: `x` grows to the right (east), `z` grows downwards (south).
Heights (`y`, `sill`, `head`) are metres above the floor. Angles are degrees.

## A complete small example

```jsonc
{
  "name": "Home",
  "wallHeight": 2.6,
  "interiorWallHeight": 1.25,
  "outdoorTemp": 29,
  "camera": { "azimuth": 34, "elevation": 47 },

  "rooms": [
    { "id": "living", "name": "Living", "rect": [0, 0, 6.4, 4.6], "floor": "oak" },
    { "id": "bath",   "name": "Bathroom", "rect": [6.4, 0, 2.2, 3.6], "floor": "tile" }
  ],

  "openings": [
    { "type": "door",   "from": [6.4, 1.0], "to": [6.4, 1.9] },
    { "type": "window", "from": [0, 1.0],   "to": [0, 2.6], "sill": 0.85, "head": 2.1 }
  ],

  "furniture": [
    { "type": "sofa", "pos": [3.9, 2.4], "rot": -90, "width": 2.5, "color": "#8b93a7" },
    { "type": "rug",  "pos": [2.6, 2.4], "size": [2.4, 1.6] }
  ],

  "lights": [
    { "id": "living.main", "name": "Ceiling", "room": "living", "type": "ceiling", "pos": [2.9, 2.3],
      "capabilities": ["brightness", "temp"] },
    { "id": "living.floor", "name": "Floor lamp", "room": "living", "type": "floor", "pos": [5.8, 0.6] },
    { "id": "living.tv", "name": "TV backlight", "room": "living", "type": "strip", "pos": [0.13, 2.3],
      "y": 1.05, "rot": 90, "length": 1.5, "capabilities": ["brightness", "color"], "color": "#7b5cff" }
  ],

  "acs": [
    { "id": "living.ac", "name": "Living AC", "room": "living", "wall": "west", "pos": [0, 0.8], "y": 2.2 }
  ],

  "scenes": [
    { "id": "movie", "name": "Movie", "icon": "film",
      "lights": { "*": { "on": false }, "living.tv": { "on": true, "brightness": 0.9, "color": "#6a4cff" } },
      "acs": { "*": { "target": 23 } } }
  ]
}
```

## Top level

| Field | Default | Meaning |
| --- | --- | --- |
| `name` | `"Home"` | Shown in the panel header |
| `wallHeight` | `2.6` | Height of the outer walls |
| `interiorWallHeight` | `1.25` | How much of the inner walls is drawn, so they do not hide the rooms |
| `outdoorTemp` | `27` | Used to estimate the room temperature of an AC that has no sensor |
| `camera.azimuth`, `camera.elevation` | `34`, `47` | Default view. Walls facing the camera are cut away, so the azimuth decides which side is open |
| `levels` | one floor | The floors of a home on several, lowest first. See [Floors](#levels-floors) |

## `levels`: floors

A home on one floor needs nothing here. A house on several lists its floors, lowest first:

```jsonc
"levels": [
  { "id": "ground", "name": "Ground floor" },
  { "id": "upper",  "name": "First floor", "wallHeight": 2.5 }
]
```

| Field | Meaning |
| --- | --- |
| `id` | Unique. Rooms, furniture and openings refer to it with `"level"` |
| `name` | Shown on the floor buttons of the panel and the editor |
| `wallHeight` | Optional: this floor's own wall height (the home's `wallHeight` otherwise) |

Every room, piece of furniture and opening then says which floor it is on with `"level": "<id>"`; without it, it
is on the first. Lamps and ACs are on their room's floor. All floors share one grid, so a room upstairs at
`[0, 0, 4, 3]` sits right above the room at `[0, 0, 4, 3]` downstairs. Each floor stands on the one under it
(its walls plus a 30 cm slab); the 3D view shows one floor at a time, with the floors under it, and the editor
draws the floor below faintly so walls and stairs line up. Stairs are furniture on the lower floor
(`"type": "stairs"`).

## `rooms`

| Field | Meaning |
| --- | --- |
| `id` | Unique. Lights and ACs refer to it |
| `name` | Shown in the room filter |
| `rect` | `[x, z, width, depth]` — the room, or its bounding box when it is not a rectangle |
| `points` | Optional: the corners of a diagonal room, `[[x, z], [x, z], …]`, in order. Three or more |
| `radii` | Optional: one corner radius per corner, in metres (`0` is square). Matches `points`, or for a rectangle the four corners north-west, north-east, south-east, south-west. All four at half a wall make a circle |
| `floor` | `oak`, `walnut`, `tile`, `stone` or `grass` (an outdoor room, a lawn) |
| `level` | The floor (storey) it is on, on a home with [several](#levels-floors) |

Where two rooms share an edge, an inner wall appears on its own; make an L-shaped room out of two. A diagonal
room lists its corners in `points`; `rect` then stays the bounding box around them. Corners may be at any angle,
so diagonal walls work anywhere in the plan.

In the editor, double-click a room (or press **Edit corners**) to edit its corners. Drag a dot to move that
corner; double-click a wall (or press **Add corner**) to insert one; Delete removes the selected corner. Tap a
corner to select it, then set its **Corner radius** — one corner at a time. Rounding all four corners of a square
at half its wall makes it a circle. A rounded corner is drawn as a short arc, while the room keeps its real
corners, so it stays easy to edit. **Rectangle** squares it again inside its bounding box. Keep `rect` beside
`points` so the iPhone app, which reads the bounding box, can open the plan too.

```jsonc
// A living room with its north-east corner cut off
{ "id": "living", "name": "Living", "rect": [0, 0, 6, 4], "floor": "oak",
  "points": [[0, 0], [5, 0], [6, 1], [6, 4], [0, 4]] }

// A round studio, 6 × 6 m: the four corners of its square rounded at half the wall
{ "id": "studio", "name": "Studio", "rect": [0, 0, 6, 6], "radii": [3, 3, 3, 3], "floor": "oak" }
```

## `openings`

A gap in a wall, given by its two end points on that wall. It may lie on any straight wall — horizontal,
vertical or diagonal — including the walls of a diagonal room.

A rounded corner is drawn as short straight stretches, and one opening has to sit on a single stretch, so doors
and windows need a straight stretch as long as the opening.

| Field | Meaning |
| --- | --- |
| `type` | `door`, `window`, `open` (a doorway without a door, or a missing piece of wall) `glass` (a glass wall, floor to ceiling, with a thin frame) or `fence` (a wood garden fence, 1 m high) or `fence2` (a modern black steel fence with a pattern, 1 m high), across the gap |
| `from`, `to` | `[x, z]` end points |
| `sill`, `head` | Bottom and top of a window. Defaults `0.85` and `2.1` |
| `level` | Its floor, on a home with [several](#levels-floors) |

## `furniture`

Decoration only. Every piece has `type`, `pos` (`[x, z]` of its centre), an optional `rot` and, on a home with
[several floors](#levels-floors), its `level`.

| `type` | Extra options |
| --- | --- |
| `rug` | `size` (`[width, depth]`), `color` |
| `sofa` | `width`, `color` |
| `armchair` | `color` |
| `coffeeTable` | `width` |
| `tv` | `width` |
| `sideboard` | `width` |
| `diningSet` | `width`, `chairs` |
| `island` | `width`, `stools` |
| `kitchen` | `width`, `upper` (wall cabinets, `true` by default) |
| `fridge` | — |
| `bed` | `width`, `color` |
| `nightstand` | — |
| `dresser` | `width` |
| `plant` | `height` |
| `vanity` | `width` |
| `bathtub` | — |
| `toilet` | — |
| `desk` | `width` |
| `wardrobe` | `width`, `height` |
| `bookshelf` | `width`, `height` |
| `stairs` | `width`, `depth` (its length), `height` (up to the floor above by default). They climb away from the front |
| `officeChair` | `color` |
| `officeCabinet` | `width` (default 0.45), `height` (default 1.2), `color` |
| `meetingTable` | `width` (default 3.2), `depth` (default 1.4), `chairs` (along both long sides, default 0) |
| `officeTable` | `width` (default 1.8), `depth` (default 0.9), `chairs` (along both long sides, default 0) |

## `lights`

| Field | Meaning |
| --- | --- |
| `id` | Unique |
| `name` | Shown on the tile |
| `room` | The `id` of its room |
| `type` | `ceiling`, `pendant`, `spots`, `floor`, `table` or `strip` |
| `pos` | `[x, z]` |
| `y` | Height, if the default for the type does not fit |
| `rot` | Rotation, for strips and spots |
| `length` | Length of a `strip` |
| `capabilities` | Any of `brightness`, `temp`, `color`. Leave it out for a plain smart plug that only switches |
| `color` | Initial colour of a colour light |
| `link`, `tuya` | Link to a real device — see below |

## `acs`

| Field | Meaning |
| --- | --- |
| `id`, `name`, `room` | As for lights |
| `wall` | The wall it hangs on: `north`, `south`, `east` or `west` |
| `pos` | `[x, z]`, on that wall |
| `rot` | Optional: the angle of the unit in degrees, for a diagonal wall |
| `y` | Height. Default `2.2` |
| `min`, `max` | Range of the target temperature. Defaults `16` and `30` |
| `link`, `tuya` | Link to a real device — see below |
| `sensor` | A thermometer for the room — see below |

## `equipment`

Things with a real on/off state: a water dispenser, a PC or a TV. Each one is clickable in 3D and in the panel,
and its status light glows green while it is on. Same fields as `acs`, except that there is no `wall`.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `room` | As for lights |
| `type` | `waterDispenser`, `pc` (an iMac-style all-in-one), `laptop` (a MacBook-style laptop; set `y` to a desk's height, about `0.74`), `rackServer` (a server rack, 1.2 m high), `printer` (a desk printer), `tv`, `tvWall` (a TV on a wall bracket, `y` is its bottom edge, `0.8` by default), `wallSwitch` (a light switch on a wall plate; `y` is the bottom of the plate, `1` by default; `gang` is `1` (default), `2` or `3`) or `wallPlug` (a wall socket, `0.3` by default), `cctvBullet` and `cctvDome` (ceiling cameras, hanging from their `y`, `2.4` by default). All take `color`: `white` (default) or `black` |
| `pos` | `[x, z]` of its centre |
| `rot` | Optional: the angle in degrees |
| `glow` | Optional: the colour of its outline and LED when it is on: `warm` (default, a warm yellow), `blue`, `white`, `orange`, `red`, `purple`, or any `"#rrggbb"`. The outline only shows while the linked device is on |
| `link` | Link to a switch, light or `media_player` entity (Home Assistant) or to a Hue / Apple Home device |

```jsonc
{ "id": "kitchen.water", "name": "Water dispenser", "room": "kitchen", "type": "waterDispenser",
  "pos": [4.2, 1.1], "rot": 180, "link": { "service": "homeassistant", "id": "switch.water_dispenser" } }
```

A `tv` can also stay in `furniture` as plain decoration; the same type in `equipment` is clickable.

A `pc` has no desk of its own. To put it on one, set the equipment's `y` to the desk's height (about `0.74`).

## `scenes`

| Field | Meaning |
| --- | --- |
| `id`, `name` | Unique id and the label of the button |
| `icon` | `sun`, `sofa`, `film`, `moon`, `door`, `table`, `bed`, `tv` or `sparkles` |
| `lights` | Light id → what to set: `on`, `brightness` (0–1), `temp` (2200–6500 K), `color` (`#rrggbb`) |
| `acs` | AC id → what to set: `on`, `target`, `mode` (`cool`, `heat`, `dry`, `fan`, `auto`), `fan` (`auto`, `low`, `medium`, `high`, `turbo`) |

In both maps the key `"*"` applies to every device, and a device's own entry overrides it.

## Linking real devices

A light or an AC becomes real when it is linked to a device of a connected platform. The editor fills the link
in when you pick a device under **Real device**; by hand it looks like this:

```jsonc
// Home Assistant (an entity id), Philips Hue (the bridge's light id), Apple Home (HomeKit's service id)
{ "id": "living.floor", "name": "Floor lamp", "room": "living", "type": "floor", "pos": [5.8, 0.6],
  "link": { "service": "homeassistant", "id": "light.floor_lamp" } }

// An AC with a thermometer from any platform for its room temperature
{ "id": "living.ac", "name": "Living AC", "room": "living", "wall": "west", "pos": [0, 0.8],
  "link": { "service": "homeassistant", "id": "climate.living_room" },
  "sensor": { "service": "hue", "id": "<id of a Hue motion sensor's thermometer>" } }

// Smart Life keeps its own object
{ "id": "bed.ac", "name": "Bedroom AC", "room": "bedroom", "wall": "north", "pos": [2, 0],
  "tuya": { "deviceId": "<device id>", "sensorId": "<id of a Smart Life temperature sensor in the room>" } }
```

| Field | Meaning |
| --- | --- |
| `link.service` | `homeassistant`, `hue` or `homekit` |
| `link.id` | The device on that platform |
| `sensor` | ACs only, optional: `{ "service", "id" }` of a temperature sensor whose reading is shown as the room temperature. A simulated AC can have one too |
| `tuya.deviceId` | The Smart Life device |
| `tuya.sensorId` | ACs linked to Smart Life only, optional: a Smart Life temperature sensor |
| `tuya.codes.switch` | Optional: the data point that switches the device, when it is not the usual one — e.g. `"switch_2"` for the second gang of a double switch |

Devices without a link stay simulated, so a plan can mix real and imaginary ones, and one home can mix
platforms: Hue lamps, a Home Assistant air conditioner and a Smart Life plug side by side.

Device IDs identify your hardware. Remove the `link`, `sensor` and `tuya` objects before you share a plan.

## Errors

A plan that does not add up — an unknown room, a duplicate id, a self-crossing room outline, an opening shorter than 1 cm — is not
rendered half-way: the panel says what is wrong and where, and the editor shows the same in its status bar.
