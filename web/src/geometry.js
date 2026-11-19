// Room shapes. A room is a rectangle ("rect"), or a free outline ("points"), and any
// corner may be rounded with "radii" (one radius per corner, in metres). "rect" is always
// the bounding box, so code that only needs extents keeps working; the outline itself comes
// from roomPoints(). A rounded rectangle stays a rectangle plus radii until a corner moves.

const EPS = 1e-6;

export const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

export const isPolygon = (room) => Array.isArray(room?.points) && room.points.length >= 3 && room.points.every(isPoint);

// The rectangle behind a room: "rect" on a plan, or x/z/w/d on a normalised room.
function roomRect(room) {
  if (Array.isArray(room?.rect) && room.rect.length === 4 && room.rect.every(Number.isFinite)) return room.rect;
  if ([room?.x, room?.z, room?.w, room?.d].every(Number.isFinite)) return [room.x, room.z, room.w, room.d];
  return [0, 0, 0, 0];
}

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

// The corners of a room, in order: the drawn outline's corners, not its rounded arcs.
export function roomCorners(room) {
  if (isPolygon(room)) return room.points.map(([x, z]) => [x, z]);
  const [x, z, w, d] = roomRect(room);
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
}

// One radius per corner, padded with 0 so it always matches the corners.
export function roomRadii(room, n = roomCorners(room).length) {
  const given = Array.isArray(room?.radii) ? room.radii : [];
  return Array.from({ length: n }, (_, i) => (Number.isFinite(given[i]) && given[i] > 0 ? given[i] : 0));
}

export const hasRounding = (room) => roomRadii(room).some((r) => r > 0);

// Fills room.radii so it matches the outline, dropping it when every corner is square.
export function ensureRadii(room, n = roomCorners(room).length) {
  const radii = roomRadii(room, n);
  if (radii.some((r) => r > 0)) room.radii = radii;
  else delete room.radii;
  return radii;
}

export function setCornerRadius(room, index, value) {
  const radii = roomRadii(room);
  if (index < 0 || index >= radii.length) return radii;
  radii[index] = Number.isFinite(value) && value > 0 ? value : 0;
  if (radii.some((r) => r > 0)) room.radii = radii;
  else delete room.radii;
  return radii;
}

// The geometry of one corner: how sharply it turns, its inside bisector, and the largest
// radius that fits before it eats past either neighbouring corner.
function cornerDetails(prev, corner, next, sign = 1) {
  const l1 = Math.hypot(corner[0] - prev[0], corner[1] - prev[1]);
  const l2 = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
  if (l1 < EPS || l2 < EPS) return null;
  const ux = (corner[0] - prev[0]) / l1; // along the wall coming in
  const uz = (corner[1] - prev[1]) / l1;
  const vx = (next[0] - corner[0]) / l2; // along the wall going out
  const vz = (next[1] - corner[1]) / l2;
  const cross = ux * vz - uz * vx;
  if (cross * sign <= EPS) return null; // a concave corner turns the other way
  const turn = Math.atan2(Math.abs(cross), ux * vx + uz * vz); // how sharply the walls turn
  if (turn < 0.03 || turn > Math.PI - 0.03) return null;
  const theta = Math.PI - turn; // the angle inside the corner
  const bx = -ux + vx; // the bisector of the inside angle, whichever way the outline wound
  const bz = -uz + vz;
  const bl = Math.hypot(bx, bz);
  if (bl < EPS) return null;
  return {
    l1, l2, theta,
    bisector: [bx / bl, bz / bl],
    max: 0.5 * Math.min(l1, l2) * Math.tan(theta / 2),
  };
}

// The largest radius a corner takes before two rounded corners meet (half a wall at 90°).
export function maxCornerRadius(prev, corner, next, sign = 1) {
  return cornerDetails(prev, corner, next, sign)?.max || 0;
}

// The radius whose arc passes nearest to `point`, for dragging a corner's radius grip.
export function cornerRadiusFromPoint(prev, corner, next, point, sign = 1) {
  const d = cornerDetails(prev, corner, next, sign);
  if (!d) return 0;
  const along = (point[0] - corner[0]) * d.bisector[0] + (point[1] - corner[1]) * d.bisector[1];
  const k = 1 / Math.sin(d.theta / 2) - 1;
  if (!(k > EPS)) return 0;
  return Math.max(0, Math.min(d.max, Math.max(0, along) / k));
}

// A rounded corner: the arc that cuts it, from where it leaves the wall before it to where
// it meets the wall after. `sign` is the winding of the outline (the sign of polygonArea).
// Null when the corner is concave or nearly straight, or when no radius fits between its walls.
export function cornerArc(prev, corner, next, radius, sign = 1) {
  const l1 = Math.hypot(corner[0] - prev[0], corner[1] - prev[1]);
  const l2 = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
  if (l1 < EPS || l2 < EPS || !(radius > 0)) return null;
  const ux = (corner[0] - prev[0]) / l1; // along the wall coming in
  const uz = (corner[1] - prev[1]) / l1;
  const vx = (next[0] - corner[0]) / l2; // along the wall going out
  const vz = (next[1] - corner[1]) / l2;
  const cross = ux * vz - uz * vx;
  if (cross * sign <= EPS) return null; // a concave corner turns the other way
  const turn = Math.atan2(Math.abs(cross), ux * vx + uz * vz); // how sharply the walls turn
  if (turn < 0.03 || turn > Math.PI - 0.03) return null;
  const theta = Math.PI - turn; // the angle inside the corner
  // The arc may not eat past either neighbouring corner, so a big radius is trimmed. At
  // exactly half the shorter wall two rounded corners meet, turning a square into a circle.
  const t = Math.min(radius / Math.tan(theta / 2), 0.5 * Math.min(l1, l2));
  if (t < 1e-4) return null;
  const r = t * Math.tan(theta / 2);
  const t1 = [corner[0] - ux * t, corner[1] - uz * t];
  const t2 = [corner[0] + vx * t, corner[1] + vz * t];
  // The centre sits along the bisector of the corner, inside the room.
  const bx = -ux + vx;
  const bz = -uz + vz;
  const bl = Math.hypot(bx, bz);
  if (bl < EPS) return null;
  const reach = r / Math.sin(theta / 2);
  const cx = corner[0] + (bx / bl) * reach;
  const cz = corner[1] + (bz / bl) * reach;
  const a1 = Math.atan2(t1[1] - cz, t1[0] - cx);
  let sweep = Math.atan2(t2[1] - cz, t2[0] - cx) - a1;
  while (sweep > Math.PI) sweep -= Math.PI * 2; // the short way round cuts the corner
  while (sweep < -Math.PI) sweep += Math.PI * 2;
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
  const arc = [];
  for (let k = 0; k <= n; k++) {
    const a = a1 + (sweep * k) / n;
    arc.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return arc;
}

// The room's drawn outline: its corners, with each rounded corner replaced by its arc.
// Always positive shoelace area (clockwise on the plan), which the wall builder relies on.
export function roomPoints(room) {
  let corners = roomCorners(room);
  let radii = roomRadii(room, corners.length);
  const sign = polygonArea(corners) < 0 ? -1 : 1;
  if (sign < 0) { corners = corners.reverse(); radii = radii.reverse(); }
  if (!radii.some((r) => r > 0)) return corners;
  const out = [];
  corners.forEach((p, i) => {
    const prev = corners[(i - 1 + corners.length) % corners.length];
    const next = corners[(i + 1) % corners.length];
    const arc = radii[i] > 0 ? cornerArc(prev, p, next, radii[i], 1) : null;
    if (arc) out.push(...arc);
    else out.push(p);
  });
  // Where two rounded corners meet they share a point; the outline keeps one copy.
  const clean = out.filter((p, i) => Math.hypot(p[0] - out[(i - 1 + out.length) % out.length][0],
    p[1] - out[(i - 1 + out.length) % out.length][1]) > 5e-4);
  return clean.length >= 3 ? clean : corners;
}

export function rectFromPoints(points) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const z = Math.min(...zs);
  return [x, z, Math.max(...xs) - x, Math.max(...zs) - z];
}

// [x, z, width, depth] around a room of any shape.
export function roomBounds(room) {
  if (isPolygon(room)) return rectFromPoints(room.points);
  return roomRect(room).slice();
}

export function roomCenter(room) {
  const [x, z, w, d] = roomBounds(room);
  return [x + w / 2, z + d / 2];
}

export function polygonCentroid(points) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f;
    cx += (p[0] + q[0]) * f;
    cz += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < EPS) {
    return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

// A point to put the room's name on: the middle of the shape, not of its bounding box,
// so a concave or diagonal room keeps its label inside.
export function roomLabelPoint(room) {
  if (!isPolygon(room)) return roomCenter(room);
  const c = polygonCentroid(roomPoints(room));
  return pointInRoom(room, c) ? c : roomCenter(room);
}

export function distanceToSegment([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > EPS ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const onSegment = (a, b, p) => Math.abs(orient(a, b, p)) <= EPS
  && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS
  && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;

function segmentsMeet(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS))
    && ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

// A simple outline: three or more corners, no zero-length walls, and no edges crossing or
// doubling back over each other. Self-crossing rooms are refused rather than drawn oddly.
export function isSimplePolygon(points) {
  const n = points.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS) return false;
  }
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // edges that share a corner
      const c = points[j];
      const d = points[(j + 1) % n];
      if (segmentsMeet(a, b, c, d)) return false;
    }
  }
  return true;
}

// Whether a point lies on the room's outline (its walls), give or take `tol`.
export function pointOnOutline(room, point, tol = 0.01) {
  const pts = roomPoints(room);
  for (let i = 0; i < pts.length; i++) {
    if (distanceToSegment(point, pts[i], pts[(i + 1) % pts.length]) <= tol) return true;
  }
  return false;
}

export function distanceToOutline(room, point) {
  const pts = roomPoints(room);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) best = Math.min(best, distanceToSegment(point, pts[i], pts[(i + 1) % pts.length]));
  return best;
}

// Is the point inside the room? `pad` grows the room by that many metres.
export function pointInRoom(room, point, pad = 0) {
  const pts = roomPoints(room);
  const [px, pz] = point;
  // A positive pad grows the room, a negative one shrinks it (to keep things off the walls).
  if (pad) {
    const d = distanceToOutline(room, point);
    if (pad > 0 && d <= pad) return true;
    if (pad < 0 && d < -pad) return false;
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if ((zi > pz) !== (zj > pz)) {
      const x = ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
      if (px < x) inside = !inside;
    }
  }
  return inside;
}

// Moves a room and its outline; "rect" is left as the caller wants it (the editor fixes it).
export function translateRoom(room, dx, dz) {
  if (Array.isArray(room.points)) room.points = room.points.map(([x, z]) => [x + dx, z + dz]);
  if (Array.isArray(room.rect)) room.rect = [room.rect[0] + dx, room.rect[1] + dz, room.rect[2], room.rect[3]];
  else if (Array.isArray(room.points)) room.rect = rectFromPoints(room.points);
}

// Stretches a room from one bounding box to another. A polygon's corners move with it;
// corner radii stay as they are, so a circle keeps its roundness and is clamped at the walls.
export function scaleRoom(room, from, to) {
  if (Array.isArray(room.points)) {
    const [ox, oz, ow, od] = from;
    const [nx, nz, nw, nd] = to;
    const sx = ow > EPS ? nw / ow : 1;
    const sz = od > EPS ? nd / od : 1;
    room.points = room.points.map(([x, z]) => [nx + (x - ox) * sx, nz + (z - oz) * sz]);
  }
  room.rect = [to[0], to[1], to[2], to[3]];
}

// Sets a room's bounding box, keeping the shape inside it.
export function resizeRoom(room, rect) {
  scaleRoom(room, roomBounds(room), rect);
}

// Makes a room a free outline from its corners (drops the rectangle form).
export function setRoomPoints(room, points, radii) {
  const n = points.length;
  const given = radii ? radii : roomRadii(room, n);
  room.points = points.map(([x, z]) => [x, z]);
  if (given.some((r) => r > 0)) room.radii = Array.from({ length: n }, (_, i) => (given[i] > 0 ? given[i] : 0));
  else delete room.radii;
  delete room.round;
  room.rect = rectFromPoints(room.points);
}

// Back to the rectangle its bounding box describes.
export function makeRectangular(room) {
  delete room.points;
  delete room.radii;
  delete room.round;
}
