// Turns the rooms + openings of a plan into floors, walls and windows.
import * as THREE from 'three';
import { box, mat, at, floorMesh, slabMesh } from './kit.js';
import { SLAB } from '../config.js';
import { polygonArea, roomPoints } from '../geometry.js';

const EXT_T = 0.2;   // exterior wall thickness
const INT_T = 0.1;   // interior wall thickness
const CURB = 0.14;   // height of the cut-away walls on the camera side
const EPS = 1e-4;
const NEAR = 0.15;   // how squarely an outer wall must face the camera to be cut away
const NEAR_BAND = 0.05; // ...and how far past that before it changes its mind
const WALL_TIME = 0.28; // seconds for a wall to sink or rise

const round3 = (v) => Math.round(v * 1000) / 1000;

// A line every wall edge is put on: a direction (unit) and its distance from the origin
// along the normal. Shared and diagonal edges are found by matching these.
function lineOf(a, b) {
  let ux = b[0] - a[0];
  let uz = b[1] - a[1];
  const len = Math.hypot(ux, uz);
  ux /= len;
  uz /= len;
  // One direction per line, whichever way the two rooms wound their outline.
  if (ux < -EPS || (Math.abs(ux) <= EPS && uz < 0)) { ux = -ux; uz = -uz; }
  const nx = -uz;
  const nz = ux;
  const c = a[0] * nx + a[1] * nz;
  return {
    dir: [ux, uz], normal: [nx, nz], c,
    key: `${Math.round(Math.atan2(uz, ux) * 1e4)}:${Math.round(c * 1000)}`,
  };
}

// Splits every room edge into wall segments, classifying each as exterior / interior
// and attaching the opening (door, window, ...) that covers it, if any. Walls may run at
// any angle: a diagonal wall is the edge of a diagonal room, and a rounded corner is many short sides.
export function wallSegments(config) {
  const lines = new Map();
  const lineFor = (a, b) => {
    const l = lineOf(a, b);
    if (!lines.has(l.key)) lines.set(l.key, { ...l, edges: [], openings: [] });
    return lines.get(l.key);
  };

  for (const r of config.rooms) {
    const pts = roomPoints(r);
    // roomPoints() winds every outline the same way: positive shoelace area.
    const sign = polygonArea(pts) > 0 ? 1 : -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS) continue;
      const line = lineFor(a, b);
      const ta = a[0] * line.dir[0] + a[1] * line.dir[1];
      const tb = b[0] * line.dir[0] + b[1] * line.dir[1];
      // Such an outline is clockwise on screen, so this turns the edge a quarter to its outside.
      line.edges.push({
        a: Math.min(ta, tb), b: Math.max(ta, tb), room: r.id,
        outward: [(b[1] - a[1]) * sign, -(b[0] - a[0]) * sign],
      });
    }
  }

  for (const o of config.openings) {
    // An opening belongs to the wall line its two ends lie on.
    for (const line of lines.values()) {
      const pa = Math.abs(o.from[0] * line.normal[0] + o.from[1] * line.normal[1] - line.c);
      const pb = Math.abs(o.to[0] * line.normal[0] + o.to[1] * line.normal[1] - line.c);
      if (pa > 0.02 || pb > 0.02) continue;
      const ta = o.from[0] * line.dir[0] + o.from[1] * line.dir[1];
      const tb = o.to[0] * line.dir[0] + o.to[1] * line.dir[1];
      line.openings.push({ ...o, a: Math.min(ta, tb), b: Math.max(ta, tb) });
      break;
    }
  }

  const segments = [];
  for (const line of lines.values()) {
    const pts = [...new Set([...line.edges, ...line.openings].flatMap((e) => [round3(e.a), round3(e.b)]))]
      .sort((p, q) => p - q);
    const run = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const mid = (pts[i] + pts[i + 1]) / 2;
      const covering = line.edges.filter((e) => e.a < mid && mid < e.b);
      if (!covering.length) continue;
      const opening = line.openings.find((o) => o.a < mid && mid < o.b) || null;
      const kind = covering.length > 1 ? 'interior' : 'exterior';
      // Exterior walls face away from their room; a diagonal wall picks its nearest side.
      const out = covering[0].outward;
      const sign = out[0] * line.normal[0] + out[1] * line.normal[1] >= 0 ? 1 : -1;
      const rooms = [...new Set(covering.map((e) => e.room))].sort();
      const seg = {
        line, a: pts[i], b: pts[i + 1], kind, opening, rooms,
        normal: [line.normal[0] * sign, line.normal[1] * sign],
      };
      const prev = run[run.length - 1];
      if (prev && Math.abs(prev.b - seg.a) < EPS && prev.kind === seg.kind
        && prev.opening === seg.opening && prev.rooms.join('|') === seg.rooms.join('|')) prev.b = seg.b;
      else run.push(seg);
    }
    // Free ends get a small extension so corners close up.
    run.forEach((s, i) => {
      s.freeA = !(run[i - 1] && Math.abs(run[i - 1].b - s.a) < EPS);
      s.freeB = !(run[i + 1] && Math.abs(run[i + 1].a - s.b) < EPS);
    });
    segments.push(...run);
  }

  return segments;
}

// One floor of the home, standing on y = 0: `level` is one of config.levels. The lowest
// stands on a plinth; a floor above it rests on a slab under each of its rooms.
// The outer walls facing the camera sink to a curb so the rooms stay in view: `view()` says
// where the camera is, `update()` moves the walls and reports when they have stopped.
export function buildHouse(config, level = config.levels[0]) {
  const group = new THREE.Group();
  const floors = [];
  const H = level.wallHeight;
  const Hi = Math.min(config.interiorWallHeight, H);
  const rooms = config.rooms.filter((r) => r.level === level.id);
  const openings = config.openings.filter((o) => o.level === level.id);
  const { minX, minZ, maxX, maxZ } = level.bounds;

  if (level.elevation === 0) {
    // Plinth the model stands on.
    const plinth = box(maxX - minX + 0.7, 0.3, maxZ - minZ + 0.7, mat('#141927', { rough: 0.9 }), { r: 0.12 });
    at(plinth, (minX + maxX) / 2, -0.305, (minZ + maxZ) / 2);
    plinth.receiveShadow = true;
    group.add(plinth);
  } else {
    const slab = mat('#1d2232', { rough: 0.9 });
    for (const r of rooms) group.add(slabMesh(r, SLAB - 0.01, slab));
  }

  for (const room of rooms) {
    const floor = floorMesh(room, room.floor);
    floor.userData = { kind: 'room', id: room.id };
    floors.push(floor);
    group.add(floor);
  }

  const wallBody = mat('#e7e3db', { rough: 0.95 });
  const wallCap = mat('#262b3a', { rough: 0.8 });
  const wallMats = [wallBody, wallBody, wallCap, wallBody, wallBody, wallBody];
  const blocker = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const glass = new THREE.MeshStandardMaterial({
    color: '#9cc0ff', roughness: 0.08, transparent: true, opacity: 0.22,
    emissive: '#3d5fae', emissiveIntensity: 0.5,
  });
  const frame = mat('#2c3142', { rough: 0.6 });

  // A wall piece running from a..b along its line, between heights y0..y1.
  const piece = (s, a, b, y0, y1, t, materials = wallMats, parent = group) => {
    const len = b - a;
    const geo = new THREE.BoxGeometry(len, y1 - y0, t);
    const m = new THREE.Mesh(geo, materials);
    const mid = (a + b) / 2;
    m.position.set(
      s.line.dir[0] * mid + s.line.normal[0] * s.line.c,
      (y0 + y1) / 2,
      s.line.dir[1] * mid + s.line.normal[1] * s.line.c,
    );
    m.rotation.y = -Math.atan2(s.line.dir[1], s.line.dir[0]);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // The four sides of the floor, each with its outer walls standing and cut away.
  const sides = new Map();
  const sideOf = (nx, nz) => {
    // Even a diagonal wall belongs to the nearest of the four sides.
    const [sx, sz] = Math.abs(nx) >= Math.abs(nz) ? [Math.sign(nx) || 1, 0] : [0, Math.sign(nz) || 1];
    const k = `${sx},${sz}`;
    if (!sides.has(k)) {
      const side = { nx: sx, nz: sz, tall: new THREE.Group(), curb: new THREE.Group(), near: null, up: 1 };
      group.add(side.tall, side.curb);
      sides.set(k, side);
    }
    return sides.get(k);
  };

  for (const s of wallSegments({ rooms, openings })) {
    const exterior = s.kind === 'exterior';
    const t = exterior ? EXT_T : INT_T;
    const a = s.a - (s.freeA ? EXT_T / 2 : 0);
    const b = s.b + (s.freeB ? EXT_T / 2 : 0);
    const type = s.opening?.type;
    let parent = group;

    if (exterior) {
      // Outward normal of an exterior wall points away from its room.
      const side = sideOf(s.normal[0], s.normal[1]);
      if (type !== 'door') piece(s, a, b, 0, CURB, t, wallMats, side.curb);
      parent = side.tall;
    }
    if (type === 'door' || type === 'open') continue;

    const height = exterior ? H : Hi;
    if (type === 'window' && exterior) {
      const { sill, head } = s.opening;
      piece(s, a, b, 0, sill, t, wallMats, parent);
      piece(s, a, b, Math.min(head, H), H, t, wallMats, parent);
      const pane = piece(s, a, b, sill, head, 0.03, glass, parent);
      pane.castShadow = false;
      const fw = 0.05;
      const bars = [[a, a + fw, sill, head], [b - fw, b, sill, head], [a, b, sill, sill + fw], [a, b, head - fw, head]];
      if (b - a > 1.2) bars.push([(a + b) / 2 - fw / 2, (a + b) / 2 + fw / 2, sill, head]);
      for (const [fa, fb, y0, y1] of bars) piece(s, fa, fb, y0, y1, 0.07, frame, parent);
      continue;
    }
    if (type === 'window') continue; // a window in an interior wall is just a gap

    piece(s, a, b, 0, height, t, wallMats, parent);
    // Interior walls are drawn cut low, but lamps should still be contained by the
    // real, full-height wall: an invisible shadow caster fills in the missing part.
    if (!exterior && Hi < H) piece(s, a, b, Hi, H, 0.04, blocker).receiveShadow = false;
  }

  const low = CURB / H;
  const pose = (side) => {
    const sunk = side.up === 0;
    side.curb.visible = sunk;
    side.tall.visible = !sunk;
    side.tall.scale.y = low + (1 - low) * side.up * side.up * (3 - 2 * side.up);
  };

  return {
    group,
    floors,
    // The camera looks from (dx, dz), a horizontal unit vector. The first call sets the walls at once.
    view(dx, dz) {
      for (const side of sides.values()) {
        const facing = side.nx * dx + side.nz * dz;
        if (side.near === null) {
          side.near = facing > NEAR;
          side.up = side.near ? 0 : 1;
          pose(side);
        } else {
          side.near = facing > NEAR + (side.near ? -NEAR_BAND : NEAR_BAND);
        }
      }
    },
    // Returns 'moving' while a wall is sinking or rising, 'stopped' on the frame the last one
    // comes to rest (the shadows are out of date then), and null otherwise.
    update(dt) {
      let moving = false;
      let stopped = false;
      for (const side of sides.values()) {
        const goal = side.near ? 0 : 1;
        if (side.up === goal) continue;
        const step = dt / WALL_TIME;
        side.up = goal > side.up ? Math.min(goal, side.up + step) : Math.max(goal, side.up - step);
        pose(side);
        if (side.up === goal) stopped = true;
        else moving = true;
      }
      return moving ? 'moving' : stopped ? 'stopped' : null;
    },
  };
}
