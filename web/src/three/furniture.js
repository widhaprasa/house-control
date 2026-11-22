// Procedural furniture library. Every builder returns a Group standing on y = 0,
// centred on its footprint and facing +z; the plan's "rot" turns it from there.
import * as THREE from 'three';
import { box, cyl, mat, at, rng } from './kit.js';

const WOOD = '#a98459';
const DARK_WOOD = '#5a4334';
const WHITE = '#eceae5';
const BLACK = '#1b1c21';
const METAL = '#9a9fa8';

const group = (...children) => {
  const g = new THREE.Group();
  g.add(...children.flat().filter(Boolean));
  return g;
};

function darker(hex, k = 0.75) {
  return `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
}

function legs(w, d, h, material, inset = 0.06, r = 0.022) {
  const out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(at(cyl(r, r * 0.8, h, material, 10), sx * (w / 2 - inset), 0, sz * (d / 2 - inset)));
  }
  return out;
}

function seating(width, depth, color, cushions) {
  const fabric = mat(color, { rough: 1 });
  const dark = mat(darker(color, 0.82), { rough: 1 });
  const arm = 0.2;
  const inner = width - arm * 2;
  const parts = [
    ...legs(width, depth, 0.1, mat(BLACK, { rough: 0.5 }), 0.08),
    at(box(width, 0.2, depth, dark, { r: 0.05 }), 0, 0.1, 0),
    at(box(inner, 0.52, 0.24, dark, { r: 0.09 }), 0, 0.3, -depth / 2 + 0.12),
  ];
  for (const sx of [-1, 1]) parts.push(at(box(arm, 0.36, depth, dark, { r: 0.08 }), sx * (width / 2 - arm / 2), 0.3, 0));
  const cw = inner / cushions;
  for (let i = 0; i < cushions; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    parts.push(at(box(cw - 0.02, 0.17, depth - 0.3, fabric, { r: 0.06 }), x, 0.3, 0.1));
    const back = at(box(cw - 0.04, 0.36, 0.16, fabric, { r: 0.07 }), x, 0.46, -depth / 2 + 0.3);
    back.rotation.x = -0.14;
    parts.push(back);
  }
  return group(parts);
}

function chair(color = BLACK) {
  const m = mat(color, { rough: 0.7 });
  const back = at(box(0.42, 0.4, 0.04, m, { r: 0.02 }), 0, 0.47, -0.2);
  back.rotation.x = -0.1;
  return group(...legs(0.42, 0.42, 0.44, m, 0.04, 0.015), at(box(0.44, 0.05, 0.44, m, { r: 0.02 }), 0, 0.42, 0), back);
}

function doorLines(width, height, y, z, count, material) {
  const out = [];
  for (let i = 1; i < count; i++) out.push(at(box(0.008, height, 0.006, material, { r: 0 }), -width / 2 + (width / count) * i, y, z));
  return out;
}

const builders = {
  rug({ size = [2, 1.4], color = '#3b4a66' }) {
    const g = group(
      at(box(size[0], 0.016, size[1], mat(color, { rough: 1 }), { r: 0.006 }), 0, 0, 0),
      at(box(size[0] - 0.24, 0.018, size[1] - 0.24, mat(darker(color, 1.18), { rough: 1 }), { r: 0.006 }), 0, 0, 0),
    );
    g.userData.flat = true;
    return g;
  },

  sofa({ width = 2.2, color = '#8b93a7' }) {
    const g = seating(width, 0.95, color, width > 2 ? 3 : 2);
    // throw pillow
    const pillow = at(box(0.36, 0.36, 0.12, mat('#d9b98a', { rough: 1 }), { r: 0.05 }), -width / 2 + 0.42, 0.46, -0.1);
    pillow.rotation.set(-0.25, 0.3, 0.1);
    g.add(pillow);
    return g;
  },

  armchair({ color = '#c28a5a' }) {
    return seating(0.92, 0.88, color, 1);
  },

  coffeeTable({ width = 1.1 }) {
    const wood = mat(WOOD, { rough: 0.6 });
    return group(
      at(box(width, 0.04, 0.58, wood, { r: 0.015 }), 0, 0.36, 0),
      at(box(width - 0.16, 0.02, 0.44, mat(BLACK, { rough: 0.5 }), { r: 0.008 }), 0, 0.14, 0),
      ...legs(width, 0.58, 0.36, mat(BLACK, { rough: 0.5 }), 0.07, 0.015),
      at(box(0.24, 0.035, 0.17, mat('#c9553f', { rough: 0.9 }), { r: 0.006 }), 0.22, 0.4, 0.05),
      at(cyl(0.05, 0.04, 0.09, mat(WHITE, { rough: 0.4 })), -0.3, 0.4, -0.08),
    );
  },

  tv({ width = 1.7 }) {
    const sw = width * 0.84;
    const sh = sw * 0.5625;
    const screen = new THREE.MeshStandardMaterial({
      color: '#05070c', roughness: 0.25, emissive: '#27407a', emissiveIntensity: 0.35,
    });
    return group(
      at(box(width, 0.36, 0.4, mat(DARK_WOOD, { rough: 0.6 }), { r: 0.015 }), 0, 0.1, 0),
      ...legs(width, 0.4, 0.1, mat(BLACK), 0.08, 0.015),
      ...doorLines(width, 0.3, 0.13, 0.2, 3, mat(BLACK)),
      at(box(sw + 0.03, sh + 0.03, 0.035, mat(BLACK, { rough: 0.4 }), { r: 0.008 }), 0, 0.72, -0.15),
      at(box(sw - 0.02, sh - 0.02, 0.01, screen, { r: 0 }), 0, 0.745, -0.129),
      at(box(0.5, 0.07, 0.09, mat('#2a2c33', { rough: 0.7 }), { r: 0.02 }), 0, 0.46, 0.05),
    );
  },

  tvWall({ width = 1.7 }) {
    // A wall TV: the screen on a wall bracket, its bottom edge at y = 0 (set the height in the editor).
    const sw = width * 0.84;
    const sh = sw * 0.5625;
    const screen = new THREE.MeshStandardMaterial({
      color: '#05070c', roughness: 0.25, emissive: '#27407a', emissiveIntensity: 0.35,
    });
    return group(
      at(box(0.06, sh * 0.6, 0.03, mat('#2a2c33', { rough: 0.5, metal: 0.5 }), { r: 0.006 }), 0, 0.1, -0.2), // bracket on the wall
      at(box(sw + 0.03, sh + 0.03, 0.035, mat(BLACK, { rough: 0.4 }), { r: 0.008 }), 0, 0, -0.15),
      at(box(sw - 0.02, sh - 0.02, 0.01, screen, { r: 0 }), 0, 0.015, -0.129),
    );
  },

  sideboard({ width = 1.6 }) {
    return group(
      ...legs(width, 0.42, 0.16, mat(BLACK), 0.07, 0.015),
      at(box(width, 0.6, 0.42, mat(WOOD, { rough: 0.6 }), { r: 0.015 }), 0, 0.16, 0),
      ...doorLines(width, 0.54, 0.19, 0.21, 4, mat(DARK_WOOD)),
      at(cyl(0.07, 0.05, 0.26, mat('#3d6b8c', { rough: 0.35 })), -width / 2 + 0.3, 0.76, 0),
      at(box(0.3, 0.05, 0.2, mat('#d8c9a8', { rough: 0.9 }), { r: 0.006 }), width / 2 - 0.35, 0.76, 0),
    );
  },

  diningSet({ width = 1.8, chairs = 6 }) {
    const depth = 0.95;
    const wood = mat('#b48d63', { rough: 0.55 });
    const g = group(
      at(box(width, 0.05, depth, wood, { r: 0.02 }), 0, 0.71, 0),
      ...legs(width, depth, 0.71, mat(BLACK, { rough: 0.5 }), 0.1, 0.028),
      at(cyl(0.16, 0.1, 0.07, mat(WHITE, { rough: 0.4 })), 0, 0.76, 0),
    );
    const perSide = Math.ceil(chairs / 2);
    for (let i = 0; i < chairs; i++) {
      const side = i < perSide ? 1 : -1;
      const k = i < perSide ? i : i - perSide;
      const n = i < perSide ? perSide : chairs - perSide;
      const c = chair('#2b2e37');
      c.position.set(-width / 2 + (width / n) * (k + 0.5), 0, side * (depth / 2 + 0.12));
      c.rotation.y = side > 0 ? Math.PI : 0;
      g.add(c);
    }
    return g;
  },

  island({ width = 2.0, stools = 3 }) {
    const g = group(
      at(box(width - 0.12, 0.88, 0.62, mat('#39424f', { rough: 0.7 }), { r: 0.015 }), 0, 0, -0.04),
      at(box(width, 0.05, 0.86, mat('#e9e7e2', { rough: 0.3 }), { r: 0.015 }), 0, 0.88, 0),
    );
    for (let i = 0; i < stools; i++) {
      const x = -width / 2 + (width / stools) * (i + 0.5);
      g.add(group(
        at(cyl(0.16, 0.16, 0.012, mat(BLACK, { rough: 0.4 })), x, 0, 0.62),
        at(cyl(0.015, 0.015, 0.64, mat(METAL, { rough: 0.3, metal: 0.8 }), 10), x, 0, 0.62),
        at(cyl(0.17, 0.15, 0.05, mat('#c28a5a', { rough: 0.9 })), x, 0.64, 0.62),
      ));
    }
    return g;
  },

  kitchen({ width = 3, upper = true }) {
    const front = mat('#e4e1da', { rough: 0.6 });
    const seam = mat('#b9b6ae');
    const n = Math.max(2, Math.round(width / 0.6));
    const g = group(
      at(box(width, 0.86, 0.6, front, { r: 0.008 }), 0, 0, 0),
      ...doorLines(width, 0.78, 0.06, 0.3, n, seam),
      at(box(width + 0.02, 0.04, 0.63, mat('#33363d', { rough: 0.35 }), { r: 0.008 }), 0, 0.86, 0.005),
      at(box(0.58, 0.012, 0.5, mat('#0c0d10', { rough: 0.15 }), { r: 0 }), -width / 4, 0.9, 0),
      at(box(0.5, 0.012, 0.38, mat(METAL, { rough: 0.3, metal: 0.9 }), { r: 0 }), width / 4, 0.9, 0.02),
      at(cyl(0.015, 0.015, 0.24, mat(METAL, { rough: 0.25, metal: 0.9 }), 10), width / 4, 0.9, -0.22),
    );
    if (upper) {
      g.add(
        at(box(width, 0.72, 0.35, front, { r: 0.008 }), 0, 1.48, -0.125),
        ...doorLines(width, 0.66, 1.51, 0.05, n, seam),
        at(box(0.7, 0.1, 0.42, mat('#2f3239', { rough: 0.4, metal: 0.4 }), { r: 0.008 }), -width / 4, 1.42, -0.09),
      );
    }
    return g;
  },

  fridge() {
    const body = mat('#c5c9d0', { rough: 0.35, metal: 0.5 });
    return group(
      at(box(0.7, 1.92, 0.68, body, { r: 0.025 }), 0, 0, 0),
      at(box(0.66, 0.008, 0.005, mat('#7c8088'), { r: 0 }), 0, 1.25, 0.34),
      at(box(0.02, 0.5, 0.03, mat('#70747c', { metal: 0.7, rough: 0.3 }), { r: 0.008 }), -0.26, 1.34, 0.35),
      at(box(0.02, 0.4, 0.03, mat('#70747c', { metal: 0.7, rough: 0.3 }), { r: 0.008 }), -0.26, 0.76, 0.35),
    );
  },

  bed({ width = 1.6, color = '#7f8fb5' }) {
    const depth = 2.1;
    const linen = mat('#f1efea', { rough: 1 });
    const g = group(
      at(box(width + 0.1, 0.26, depth + 0.04, mat(DARK_WOOD, { rough: 0.7 }), { r: 0.03 }), 0, 0.04, 0),
      at(box(width + 0.16, 1.02, 0.1, mat(darker(color, 0.6), { rough: 1 }), { r: 0.04 }), 0, 0, -depth / 2),
      at(box(width, 0.2, depth - 0.06, linen, { r: 0.07 }), 0, 0.28, 0.02),
      at(box(width + 0.05, 0.13, depth * 0.63, mat(color, { rough: 1 }), { r: 0.06 }), 0, 0.4, depth * 0.17),
      at(box(width + 0.06, 0.05, 0.3, mat(darker(color, 0.8), { rough: 1 }), { r: 0.02 }), 0, 0.5, depth * 0.36),
    );
    for (const sx of [-1, 1]) {
      const pillow = at(box(width / 2 - 0.14, 0.13, 0.42, linen, { r: 0.06 }), sx * width / 4, 0.46, -depth / 2 + 0.36);
      pillow.rotation.x = -0.18;
      g.add(pillow);
    }
    return g;
  },

  nightstand() {
    return group(
      at(box(0.46, 0.44, 0.4, mat(WOOD, { rough: 0.6 }), { r: 0.015 }), 0, 0.06, 0),
      ...legs(0.46, 0.4, 0.06, mat(BLACK), 0.06, 0.014),
      at(box(0.4, 0.006, 0.005, mat(DARK_WOOD), { r: 0 }), 0, 0.28, 0.2),
    );
  },

  dresser({ width = 1.3 }) {
    const g = group(
      ...legs(width, 0.45, 0.1, mat(BLACK), 0.06, 0.015),
      at(box(width, 0.74, 0.45, mat(WHITE, { rough: 0.6 }), { r: 0.015 }), 0, 0.1, 0),
      at(cyl(0.09, 0.07, 0.18, mat('#c9a15e', { rough: 0.4 })), width / 2 - 0.3, 0.84, 0),
    );
    for (let i = 1; i < 3; i++) g.add(at(box(width - 0.06, 0.006, 0.005, mat('#b9b6ae'), { r: 0 }), 0, 0.1 + 0.247 * i, 0.226));
    return g;
  },

  plant({ height = 1.2 }) {
    const rand = rng(Math.round(height * 1000));
    const leaves = [mat('#3f7d52', { rough: 0.9 }), mat('#4f9462', { rough: 0.9 }), mat('#35694a', { rough: 0.9 })];
    const g = group(
      at(cyl(0.17, 0.12, 0.3, mat('#d7d0c4', { rough: 0.8 })), 0, 0, 0),
      at(cyl(0.15, 0.15, 0.02, mat('#3a2c22', { rough: 1 })), 0, 0.285, 0),
      at(cyl(0.015, 0.02, height * 0.55, mat('#6b4a33', { rough: 1 }), 8), 0, 0.3, 0),
    );
    const count = Math.round(6 + height * 5);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const y = 0.5 + t * (height - 0.62);
      const spread = 0.28 * Math.sin(Math.PI * (0.25 + t * 0.7));
      const a = rand() * Math.PI * 2;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + rand() * 0.1, 1), leaves[i % 3]);
      blob.position.set(Math.cos(a) * spread * rand(), y, Math.sin(a) * spread * rand());
      blob.scale.y = 0.75 + rand() * 0.3;
      g.add(blob);
    }
    return g;
  },

  vanity({ width = 1.0 }) {
    const mirror = new THREE.MeshStandardMaterial({ color: '#b9c7dc', roughness: 0.12, metalness: 0.9 });
    return group(
      at(box(width, 0.62, 0.48, mat(WOOD, { rough: 0.6 }), { r: 0.012 }), 0, 0.2, 0),
      ...doorLines(width, 0.56, 0.23, 0.24, 2, mat(DARK_WOOD)),
      at(box(width + 0.03, 0.04, 0.5, mat(WHITE, { rough: 0.25 }), { r: 0.012 }), 0, 0.82, 0),
      at(cyl(0.19, 0.15, 0.1, mat(WHITE, { rough: 0.2 })), 0, 0.86, 0.02),
      at(cyl(0.012, 0.012, 0.2, mat(METAL, { rough: 0.2, metal: 0.9 }), 10), 0, 0.86, -0.18),
      at(box(width * 0.82, 0.8, 0.025, mirror, { r: 0.01 }), 0, 1.08, -0.225),
    );
  },

  bathtub() {
    return group(
      at(box(1.7, 0.56, 0.78, mat(WHITE, { rough: 0.25 }), { r: 0.1 }), 0, 0, 0),
      at(box(1.5, 0.02, 0.58, mat('#9fd3ec', { rough: 0.1, emissive: '#1d4f6b', emissiveIntensity: 0.25 }), { r: 0.009 }), 0, 0.545, 0),
      at(cyl(0.014, 0.014, 0.2, mat(METAL, { rough: 0.2, metal: 0.9 }), 10), -0.74, 0.56, 0),
    );
  },

  toilet() {
    const c = mat(WHITE, { rough: 0.25 });
    const bowl = at(cyl(0.19, 0.13, 0.4, c), 0, 0, 0.1);
    bowl.scale.z = 1.25;
    const lid = at(cyl(0.2, 0.2, 0.03, c), 0, 0.4, 0.1);
    lid.scale.z = 1.25;
    return group(at(box(0.38, 0.78, 0.17, c, { r: 0.03 }), 0, 0, -0.24), bowl, lid);
  },

  waterDispenser() {
    const body = mat('#eceef2', { rough: 0.4 });
    const bottle = mat('#7fb8e6', { rough: 0.15, opacity: 0.55 });
    const steel = mat('#9a9fa8', { rough: 0.3, metal: 0.7 });
    // A status light: green while the linked switch is on. Its own material, so only this one lights up.
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.01), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.4 }));
    led.position.set(0.1, 0.8, 0.175);
    const g = group(
      // Cabinet, with a seat on top for the bottle. Every part below starts where the one under it ends.
      at(box(0.32, 0.9, 0.34, body, { r: 0.03 }), 0, 0, 0),
      at(cyl(0.05, 0.06, 0.02, mat(BLACK), 16), 0, 0.9, 0), // seat: 0.90 to 0.92
      at(cyl(0.14, 0.05, 0.06, bottle, 24), 0, 0.92, 0), // neck: 0.92 to 0.98, narrow at the seat
      at(cyl(0.14, 0.14, 0.38, bottle, 24), 0, 0.98, 0), // bottle: 0.98 to 1.36
      // Two taps on the front (its face is at z = 0.17): hot (red) and cold (blue).
      at(cyl(0.012, 0.012, 0.08, steel, 8), -0.06, 0.6, 0.18),
      at(cyl(0.012, 0.012, 0.08, steel, 8), 0.06, 0.6, 0.18),
      at(box(0.05, 0.03, 0.03, mat('#d2494c'), { r: 0.008 }), -0.06, 0.66, 0.18),
      at(box(0.05, 0.03, 0.03, mat('#3d8fd6'), { r: 0.008 }), 0.06, 0.66, 0.18),
      at(box(0.2, 0.02, 0.1, mat(BLACK, { rough: 0.5 }), { r: 0.008 }), 0, 0.2, 0.22),
      led,
    );
    g.userData.led = led;
    return g;
  },

  wallSwitch({ color = 'white', gang = 1 } = {}) {
    // A light switch on a wall plate: 1, 2 or 3 gangs (toggles), with an LED that glows green
    // while its device is on. Its "y" is the bottom of the plate (1 m by default in the editor).
    const n = Math.min(3, Math.max(1, Math.round(gang)));
    const dark = color === 'black';
    const width = 0.07 * n + 0.02; // the plate grows by a gang's width
    const plate = mat(dark ? '#17181c' : '#f2f2ee', { rough: 0.3 });
    const toggle = mat(dark ? '#3c3f47' : '#d6d6d0', { rough: 0.4 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.004), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.4 }));
    led.position.set(width / 2 - 0.02, 0.1, 0.008); // top right of the plate
    const parts = [at(box(width, 0.12, 0.012, plate, { r: 0.012 }), 0, 0, 0)];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.07; // one toggle per gang, centred on the plate
      parts.push(at(box(0.03, 0.05, 0.012, toggle, { r: 0.008 }), x, 0.035, 0.012));
    }
    parts.push(led);
    const g = group(parts);
    g.userData.led = led;
    return g;
  },

  wallPlug({ color = 'white' } = {}) {
    // A wall socket: a plate with two round sockets and an earth hole, and an LED that glows green
    // while its device is on. Its "y" is the bottom of the plate (0.3 m by default in the editor).
    const dark = color === 'black';
    const plate = mat(dark ? '#17181c' : '#f2f2ee', { rough: 0.3 });
    const hole = mat('#1b1c21', { rough: 0.6 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.004), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.4 }));
    led.position.set(0.033, 0.105, 0.008);
    const parts = [at(box(0.09, 0.12, 0.012, plate, { r: 0.012 }), 0, 0, 0), led];
    // The three holes, pointing out of the plate (the cylinders are laid along z).
    for (const [x, y] of [[-0.018, 0.075], [0.018, 0.075], [0, 0.03]]) {
      const h = at(cyl(0.008, 0.008, 0.006, hole, 12), x, y, 0.006);
      h.rotation.x = Math.PI / 2;
      parts.push(h);
    }
    const g = group(parts);
    g.userData.led = led;
    return g;
  },

  cctvDome({ color = 'white' } = {}) {
    // A ceiling dome camera: a mount plate on the ceiling (y = 0) with a dome hanging from it and a dark lens.
    const shell = mat(color === 'black' ? '#1d1f24' : '#eceef2', { rough: 0.4 });
    const dark = mat('#101216', { rough: 0.2, metal: 0.4 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.4 }));
    led.position.set(0, -0.03, 0.066);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell); // the lower half
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), dark);
    lens.rotation.x = Math.PI / 2; // facing down
    lens.position.y = -0.069;
    const g = group(at(cyl(0.05, 0.05, 0.012, shell, 24), 0, 0, 0), dome, lens, led);
    g.userData.led = led;
    return g;
  },

  cctvBullet({ color = 'white' } = {}) {
    // A ceiling camera on a bracket: a stem from the ceiling (y = 0), and the camera body hanging from
    // the stem's end and tilted 60 degrees from straight down, so it looks down and out into the room.
    const shell = mat(color === 'black' ? '#1d1f24' : '#eceef2', { rough: 0.4 });
    const dark = mat('#101216', { rough: 0.2, metal: 0.4 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.4 }));
    led.position.set(0.037, -0.08, 0);
    const head = new THREE.Group();
    head.position.y = -0.1; // hinged at the bottom of the stem
    head.rotation.x = -THREE.MathUtils.degToRad(60); // 60 deg from straight down: out and down
    head.add(
      at(cyl(0.035, 0.035, 0.16, shell, 24), 0, -0.16, 0), // body, from the hinge down its own length
      at(cyl(0.03, 0.03, 0.01, dark, 20), 0, -0.17, 0), // lens cap at the front end
      led,
    );
    const g = group(
      at(cyl(0.04, 0.04, 0.012, shell, 20), 0, 0, 0), // ceiling plate
      at(cyl(0.02, 0.02, 0.1, shell, 12), 0, -0.1, 0), // stem: -0.10 to 0
      head,
    );
    g.userData.led = led;
    return g;
  },

  pc() {
    // An iMac-style all-in-one: a white display on a thin stand, with a keyboard in front. The parts stand
    // on y = 0; set the equipment's "y" to a desk's height to place it on one.
    const white = mat('#e6e8ec', { rough: 0.3, metal: 0.1 });
    const dark = mat('#101216', { rough: 0.2 });
    const glass = mat('#15243a', { rough: 0.15, emissive: '#2d6fa8', emissiveIntensity: 0.25 });
    return group(
      at(cyl(0.11, 0.11, 0.012, white, 24), 0, 0, 0), // foot
      at(cyl(0.02, 0.02, 0.2, white, 12), 0, 0.012, -0.03), // stand
      at(box(0.52, 0.36, 0.05, white, { r: 0.03 }), 0, 0.2, -0.02), // display body
      at(box(0.49, 0.33, 0.006, glass, { r: 0.004 }), 0, 0.215, 0.008), // screen, on the front
      at(box(0.4, 0.015, 0.13, white, { r: 0.005 }), 0, 0, 0.2), // keyboard
      at(box(0.37, 0.002, 0.1, dark, { r: 0.002 }), 0, 0.015, 0.2), // its keys
    );
  },

  laptop() {
    // A laptop like a MacBook: a silver base with a keyboard and trackpad, and a lid tilted a little
    // back. Set the equipment's "y" to a desk's height to place it on one.
    const silver = mat('#c9ccd2', { rough: 0.3, metal: 0.5 });
    const dark = mat('#101216', { rough: 0.25 });
    const lid = new THREE.Group();
    lid.position.set(0, 0.015, -0.11); // hinged at the back edge of the base
    lid.rotation.x = -THREE.MathUtils.degToRad(20);
    lid.add(
      at(box(0.31, 0.21, 0.01, silver, { r: 0.008 }), 0, 0, 0),
      at(box(0.29, 0.19, 0.004, dark, { r: 0.004 }), 0, 0.01, 0.005), // screen, facing forward
    );
    return group(
      at(box(0.31, 0.015, 0.22, silver, { r: 0.006 }), 0, 0, 0), // base
      at(box(0.27, 0.002, 0.09, dark, { r: 0.002 }), 0, 0.015, 0.02), // keys
      at(box(0.1, 0.002, 0.06, mat('#b6b9c0', { rough: 0.4 }), { r: 0.002 }), 0, 0.015, 0.085), // trackpad
      lid,
    );
  },

  rackServer() {
    // A server rack: a black cabinet with five rack-mounted servers across the front, each with a status LED.
    // The parts stand on y = 0; set the equipment's "y" if it should stand higher.
    const frame = mat('#1d1f24', { rough: 0.5, metal: 0.3 });
    const unit = mat('#3a3f4a', { rough: 0.4, metal: 0.4 });
    const lit = mat('#3dd68c', { rough: 0.3, emissive: '#3dd68c', emissiveIntensity: 0.8 });
    const W = 0.6;
    const D = 0.8;
    const H = 1.2;
    const parts = [at(box(W, H, D, frame, { r: 0.01 }), 0, 0, 0)];
    for (let i = 0; i < 5; i++) {
      const y = 0.1 + i * 0.2;
      parts.push(at(box(W - 0.08, 0.07, 0.02, unit, { r: 0.004 }), 0, y, D / 2 + 0.01));
      parts.push(at(box(0.012, 0.012, 0.006, lit), W / 2 - 0.07, y + 0.03, D / 2 + 0.022));
    }
    return group(parts);
  },

  printer() {
    // A desk printer: a white body with a paper tray at the front, a top slot, a control panel and paper on the tray.
    const body = mat('#eceef2', { rough: 0.45 });
    const dark = mat('#2a2d35', { rough: 0.4 });
    const tray = mat('#d6d9de', { rough: 0.5 });
    const paper = mat('#fbfbf8', { rough: 0.8 });
    return group(
      at(box(0.45, 0.2, 0.36, body, { r: 0.02 }), 0, 0, 0), // body
      at(box(0.4, 0.015, 0.2, dark, { r: 0.004 }), 0, 0.2, -0.02), // top
      at(box(0.16, 0.005, 0.02, dark, { r: 0.002 }), 0, 0.216, -0.05), // paper slot
      at(box(0.1, 0.04, 0.006, dark, { r: 0.004 }), 0.13, 0.12, 0.183), // control panel
      at(box(0.36, 0.015, 0.18, tray, { r: 0.004 }), 0, 0.04, 0.27), // output tray
      at(box(0.3, 0.03, 0.14, paper, { r: 0.002 }), 0, 0.055, 0.27), // paper on it
    );
  },

  desk({ width = 1.4 }) {
    const c = chair('#2b2e37');
    c.position.z = 0.5;
    c.rotation.y = Math.PI;
    return group(
      at(box(width, 0.04, 0.65, mat(WOOD, { rough: 0.55 }), { r: 0.012 }), 0, 0.72, 0),
      ...legs(width, 0.65, 0.72, mat(BLACK), 0.06, 0.02),
      at(box(0.56, 0.34, 0.025, mat(BLACK, { rough: 0.3 }), { r: 0.008 }), 0, 0.86, -0.18),
      at(box(0.2, 0.1, 0.12, mat(BLACK), { r: 0.008 }), 0, 0.76, -0.18),
      c,
    );
  },

  wardrobe({ width = 1.6, height = 2.1 }) {
    return group(
      at(box(width, height, 0.6, mat(WHITE, { rough: 0.6 }), { r: 0.015 }), 0, 0, 0),
      ...doorLines(width, height - 0.08, 0.04, 0.3, Math.max(2, Math.round(width / 0.55)), mat('#b9b6ae')),
    );
  },

  bookshelf({ width = 1.0, height = 1.8 }) {
    const rand = rng(Math.round(width * 100 + height * 7));
    const wood = mat(WOOD, { rough: 0.6 });
    const g = group(at(box(width, height, 0.04, wood, { r: 0 }), 0, 0, -0.14));
    for (const sx of [-1, 1]) g.add(at(box(0.03, height, 0.32, wood, { r: 0 }), sx * (width / 2 - 0.015), 0, 0));
    const shelves = Math.round(height / 0.38);
    const colors = ['#c9553f', '#3d6b8c', '#d8c9a8', '#4f9462', '#8b93a7', '#d9b98a'];
    for (let i = 0; i <= shelves; i++) {
      const y = (height - 0.03) * (i / shelves);
      g.add(at(box(width, 0.03, 0.32, wood, { r: 0 }), 0, y, 0));
      if (i === shelves) break;
      let x = -width / 2 + 0.06;
      while (x < width / 2 - 0.12) {
        const bw = 0.03 + rand() * 0.04;
        const bh = 0.2 + rand() * 0.1;
        g.add(at(box(bw, bh, 0.2, mat(colors[Math.floor(rand() * colors.length)], { rough: 0.9 }), { r: 0 }), x + bw / 2, y + 0.03, 0));
        x += bw + 0.004;
        if (rand() < 0.12) x += 0.12;
      }
    }
    return g;
  },

  // A straight flight up to the floor above: you step on at the front (+z) and climb towards the back.
  stairs({ width = 1, depth = 2.8, height = 2.9 }) {
    const steps = Math.max(3, Math.round(height / 0.18));
    const rise = height / steps;
    const run = depth / steps;
    const body = mat('#d9d4cb', { rough: 0.9 });
    const tread = mat(WOOD, { rough: 0.6 });
    const g = new THREE.Group();
    for (let i = 0; i < steps; i++) {
      const z = depth / 2 - run * (i + 0.5);
      g.add(at(box(width, rise * i + rise - 0.03, run, body, { r: 0 }), 0, 0, z));
      g.add(at(box(width + 0.02, 0.03, run + 0.02, tread, { r: 0.008 }), 0, rise * (i + 1) - 0.03, z));
    }
    // A handrail along the open side.
    const rail = mat(BLACK, { rough: 0.5 });
    const slope = Math.atan2(height, depth);
    const length = Math.hypot(height, depth);
    const bar = at(box(0.04, 0.04, length, rail, { r: 0.015 }), width / 2 - 0.03, height / 2 + 0.9, 0);
    bar.rotation.x = slope;
    g.add(bar);
    for (const t of [0.1, 0.5, 0.9]) {
      g.add(at(box(0.025, 0.9, 0.025, rail, { r: 0 }), width / 2 - 0.03, height * t, depth / 2 - depth * t));
    }
    return g;
  },
  officeChair({ color = '#2b2e37' }) {
    // A swivel office chair: a seat and back on a column, standing on a five-arm base with a wheel at each arm's end.
    const fabric = mat(color, { rough: 0.9 });
    const base = mat(BLACK, { rough: 0.5 });
    const parts = [
      at(box(0.46, 0.07, 0.46, fabric, { r: 0.03 }), 0, 0.44, 0), // seat
      at(cyl(0.03, 0.03, 0.42, base, 10), 0, 0.03, 0), // column, from the base up to the seat
    ];
    // A curved back that starts at the seat's rear edge (z = -0.23) at both sides and bows back
    // a little in the middle: a section of a large cylinder, double-sided so it reads as one panel.
    const SEAT_HALF = 0.23;
    const SAG = 0.07; // how far the middle sits behind the edges
    const R = (SEAT_HALF * SEAT_HALF + SAG * SAG) / (2 * SAG);
    const centreZ = R - 0.3; // the arc's middle is at z = -0.30 (the seat's rear edge less the sag)
    const half = Math.asin(SEAT_HALF / R);
    const shell = fabric.clone();
    shell.side = THREE.DoubleSide;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.45, 32, 1, true, Math.PI - half, 2 * half), shell);
    back.position.set(0, 0.695, centreZ); // bottom at 0.47, sunk into the seat
    back.castShadow = back.receiveShadow = true;
    parts.push(back);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const arm = at(box(0.2, 0.03, 0.04, base, { r: 0.015 }), Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1);
      arm.rotation.y = -a; // along the radius
      parts.push(arm);
      const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), base);
      wheel.position.set(Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2);
      parts.push(wheel);
    }
    return group(parts);
  },

  officeTable({ width = 1.8, depth = 0.9, chairs = 0, top: topColour = '#cdbf9f' }) {
    // A table with chairs along both long sides (half on each).
    const top = mat(topColour, { rough: 0.55 });
    const g = group(
      at(box(width, 0.05, depth, top, { r: 0.012 }), 0, 0.73, 0),
      ...legs(width, depth, 0.73, mat(METAL, { rough: 0.3, metal: 0.6 }), 0.08, 0.03),
    );
    const perSide = Math.ceil(chairs / 2);
    for (let i = 0; i < chairs; i++) {
      const side = i < perSide ? -1 : 1;
      const j = side < 0 ? i : i - perSide;
      const count = side < 0 ? perSide : chairs - perSide;
      const c = builders.officeChair({ color: '#2b2e37' });
      c.position.set(-width / 2 + width * (j + 0.5) / Math.max(1, count), 0, side * (depth / 2 + 0.4));
      if (side > 0) c.rotation.y = Math.PI; // the sitter faces the table
      g.add(c);
    }
    return g;
  },
  officeCabinet({ width = 0.45, height = 1.2, color = '#8d9399' }) {
    // A filing cabinet: a metal body with a drawer front and a handle on each drawer.
    const depth = 0.6;
    const metal = mat(color, { rough: 0.5, metal: 0.3 });
    const face = mat('#9ea4ab', { rough: 0.45, metal: 0.3 });
    const handle = mat('#3a3d44', { rough: 0.4, metal: 0.6 });
    const drawers = Math.max(2, Math.round(height / 0.3));
    const h = height / drawers;
    const parts = [at(box(width, height, depth, metal, { r: 0.012 }), 0, 0, 0)];
    for (let i = 0; i < drawers; i++) {
      const y = i * h;
      parts.push(at(box(width - 0.04, h - 0.04, 0.01, face, { r: 0.006 }), 0, y + 0.02, depth / 2 + 0.005));
      parts.push(at(box(0.12, 0.014, 0.02, handle, { r: 0.006 }), 0, y + h - 0.06, depth / 2 + 0.015));
    }
    return group(parts);
  },

  meetingTable({ width = 3.2, depth = 1.4, chairs = 0 }) {
    // A meeting table with a walnut top, a lighter inlay, brass edge trim, a pedestal base and a vase.
    const walnut = mat('#5a3f2a', { rough: 0.45 });
    const inlay = mat('#7a5a40', { rough: 0.4 });
    const brass = mat('#c9a86a', { rough: 0.25, metal: 0.8 });
    const TOP = 0.74;
    const parts = [
      at(box(width, 0.05, depth, walnut, { r: 0.02 }), 0, TOP, 0),
      at(box(width - 0.36, 0.006, depth - 0.36, inlay, { r: 0.004 }), 0, TOP + 0.05, 0),
    ];
    // Brass trim along all four edges, just below the top.
    const t = 0.02;
    parts.push(at(box(width + 0.01, t, t, brass), 0, TOP - t, depth / 2), at(box(width + 0.01, t, t, brass), 0, TOP - t, -depth / 2));
    parts.push(at(box(t, t, depth + 0.01, brass), width / 2, TOP - t, 0), at(box(t, t, depth + 0.01, brass), -width / 2, TOP - t, 0));
    // Two pedestals, each a column on a round foot.
    for (const sx of [-1, 1]) {
      const x = sx * (width / 2 - 0.45);
      parts.push(at(cyl(0.2, 0.2, 0.03, brass, 24), x, 0, 0));
      parts.push(at(cyl(0.05, 0.08, TOP - 0.03, brass, 16), x, 0.03, 0));
    }
    // A vase in the middle of the table.
    parts.push(at(cyl(0.045, 0.03, 0.2, mat('#e8e1d2', { rough: 0.3 }), 16), 0, TOP + 0.05, 0));
    // Chairs along both long sides (half on each), as the office table has them.
    const perSide = Math.ceil(chairs / 2);
    for (let i = 0; i < chairs; i++) {
      const side = i < perSide ? -1 : 1;
      const j = side < 0 ? i : i - perSide;
      const count = side < 0 ? perSide : chairs - perSide;
      const c = builders.officeChair({ color: '#3b2f25' });
      c.position.set(-width / 2 + width * (j + 0.5) / Math.max(1, count), 0, side * (depth / 2 + 0.4));
      if (side > 0) c.rotation.y = Math.PI;
      parts.push(c);
    }
    return group(parts);
  },
};

// Equipment-only pieces: they only exist as equipment (linked, clickable, with a status light).
const EQUIPMENT_ONLY = ['waterDispenser', 'pc', 'laptop', 'rackServer', 'printer', 'wallSwitch', 'wallPlug', 'cctvDome', 'cctvBullet', 'tvWall'];
// The equipment that hang on a wall (the editor snaps them to walls and faces them into the room).
export const WALL_EQUIPMENT = ['wallSwitch', 'wallPlug'];
export const FURNITURE_TYPES = Object.keys(builders).filter((t) => !EQUIPMENT_ONLY.includes(t));

// Pieces with a real on/off state. A TV is both furniture (decoration) and an equipment.
export const EQUIPMENT_TYPES = [...EQUIPMENT_ONLY, 'tv'];

// Approximate [width, depth] of each piece, for the 2D plan editor.
export function footprint(item) {
  const w = item.width;
  switch (item.type) {
    case 'rug': return item.size || [2, 1.4];
    case 'sofa': return [w || 2.2, 0.95];
    case 'armchair': return [0.92, 0.88];
    case 'coffeeTable': return [w || 1.1, 0.58];
    case 'sideboard': return [w || 1.6, 0.42];
    case 'diningSet': return [w || 1.8, 1.9];
    case 'island': return [w || 2, 1.1];
    case 'kitchen': return [w || 3, 0.62];
    case 'fridge': return [0.7, 0.68];
    case 'bed': return [(w || 1.6) + 0.1, 2.14];
    case 'nightstand': return [0.46, 0.4];
    case 'dresser': return [w || 1.3, 0.45];
    case 'plant': return [0.45, 0.45];
    case 'vanity': return [w || 1, 0.5];
    case 'bathtub': return [1.7, 0.78];
    case 'toilet': return [0.4, 0.66];
    case 'waterDispenser': return [0.4, 0.4];
    case 'pc': return [0.55, 0.36];
    case 'laptop': return [0.31, 0.24];
    case 'rackServer': return [0.6, 0.8];
    case 'printer': return [0.45, 0.4];
    case 'tv': return [w || 1.7, 0.4];
    case 'tvWall': return [w || 1.7, 0.15];
    case 'wallSwitch': return [0.07 * (item.gang || 1) + 0.02, 0.1];
    case 'wallPlug': return [0.09, 0.1];
    case 'cctvDome': return [0.14, 0.14];
    case 'cctvBullet': return [0.08, 0.08];
    case 'desk': return [w || 1.4, 0.65];
    case 'officeChair': return [0.5, 0.5];
    case 'officeTable': return [w || 1.8, item.depth || 0.9];
    case 'officeCabinet': return [w || 0.45, 0.6];
    case 'meetingTable': return [w || 3.2, item.depth || 1.4];
    case 'wardrobe': return [w || 1.6, 0.6];
    case 'bookshelf': return [w || 1, 0.32];
    case 'stairs': return [w || 1, item.depth || 2.8];
    default: return [0.6, 0.6];
  }
}

// Colours an equipment's outline and LED can glow in (a name from here, or any "#rrggbb").
export const GLOW_COLORS = { warm: '#ffd27a', blue: '#4da3ff', white: '#ffffff', orange: '#ff9a3d', red: '#ff4d4d', purple: '#b07cff' };
const glowColor = (value) => GLOW_COLORS[value] || (/^#[0-9a-f]{6}$/i.test(value || '') ? value : GLOW_COLORS.warm);

// Shows whether a linked equipment's device is on: its outline lights up in its glow colour,
// and its LED (where it has one) glows the same.
export function setFurnitureStatus(root, id, on) {
  for (const g of root.children) {
    if (g.userData.id !== id) continue;
    if (g.userData.glow) g.userData.glow.visible = Boolean(on);
    const led = g.userData.led;
    if (!led) continue;
    const c = g.userData.glowColor || GLOW_COLORS.warm;
    led.material.color.set(on ? c : '#3a3d44');
    led.material.emissive.set(on ? c : '#000000');
    led.material.emissiveIntensity = on ? 1.2 : 0;
  }
}

// An equipment's outline: a glowing shell round each part of the piece, so the light follows its real
// shape. Each part is copied, swollen a little along its surface and drawn from inside. Hidden until
// its device is on.
function ensureGlow(g, color) {
  g.updateMatrixWorld(true); // the piece is not moved yet, so every part's world matrix is relative to it
  const glow = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: glowColor(color), side: THREE.BackSide, toneMapped: false });
  const SWELL = 0.012;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    if (nor) {
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, pos.getX(i) + nor.getX(i) * SWELL, pos.getY(i) + nor.getY(i) * SWELL, pos.getZ(i) + nor.getZ(i) * SWELL);
      }
    }
    const shell = new THREE.Mesh(geo, mat);
    shell.matrixAutoUpdate = false;
    shell.matrix.copy(o.matrixWorld);
    shell.castShadow = false;
    shell.receiveShadow = false;
    glow.add(shell);
  });
  glow.visible = false;
  g.add(glow);
  g.userData.glow = glow;
  g.userData.glowColor = glowColor(color);
}

// An invisible box over an equipment, so a click on it reaches the equipment.
export function equipmentHitBox(item) {
  const [w, d] = footprint(item);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), new THREE.MeshBasicMaterial());
  hit.position.set(item.pos[0], (item.y || 0) + 0.7, item.pos[1]);
  hit.rotation.y = THREE.MathUtils.degToRad(item.rot || 0);
  hit.visible = false;
  hit.userData = { kind: 'equipment', id: item.id };
  return hit;
}

export function buildFurniture(items) {
  const root = new THREE.Group();
  for (const item of items) {
    const make = builders[item.type];
    if (!make || !Array.isArray(item.pos)) {
      console.warn(`[plan] skipping furniture of unknown type "${item.type}"`);
      continue;
    }
    const g = make(item);
    g.userData.id = item.id;
    // Measured before the piece is moved, so the outline sits round it in its own frame.
    if (item.equipment) ensureGlow(g, item.glow);
    g.position.set(item.pos[0], item.y || 0, item.pos[1]);
    g.rotation.y = THREE.MathUtils.degToRad(item.rot || 0);
    const flat = g.userData.flat;
    g.traverse((o) => {
      if (o.isMesh) { o.castShadow = !flat; o.receiveShadow = true; }
    });
    root.add(g);
  }
  return root;
}
