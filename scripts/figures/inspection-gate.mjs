/**
 * "How Aegis works" figure, drawn with the Anatomy iso-kit
 * (github.com/wheresryan22/anatomy, MIT — vendored in ./vendor/anatomy).
 *
 * The object is the explanation: messages ride a conveyor through an
 * inspection gate (the Scam Checker) and a three-lamp signal tower shows the
 * verdict — green safe, amber suspicious, red danger.
 *
 *   node scripts/figures/inspection-gate.mjs   →  public/figures/inspection-gate.svg
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from './vendor/anatomy/iso-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../public/figures/inspection-gate.svg');

const WIDTH = 640;
const HEIGHT = 400;

const PLATE = { x: -150, y: -64, w: 300, d: 128, r: 8 };
const PLATE_H = 9;
const FOOT_H = 5;

const FRAME = { x: -132, y: -22, w: 176, d: 44, r: 3 };
const FRAME_Z = 6;
const FRAME_H = 9;
const BELT = { x: -128, y: -18, w: 168, d: 36, r: 2 };
const BELT_Z = FRAME_Z + FRAME_H;
const BELT_H = 1.6;
const TOP = BELT_Z + BELT_H;

const GATE_X = -44;
const POST = 8;
const POST_H = 58;
const BEAM_H = 7;

const TOWER = [96, 0];
const LAMP_R = 7.5;
const LAMPS = [
  { cls: 'aeg-lamp-safe', z: 42 },
  { cls: 'aeg-lamp-warn', z: 55.5 },
  { cls: 'aeg-lamp-danger', z: 69 },
];
const LAMP_H = 12;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [TOWER[0], TOWER[1], 86], [GATE_X, 0, POST_H + BEAM_H + 6]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of k.corners(PLATE, 20).sort((a, b) => depth(...a) - depth(...b))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: 'lo' }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: 'mid' }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: 'lo' }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(''), { tone: 'lo' }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -130, y: PLATE.y + PLATE.d - 13, w: 170, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: 'lo', crease: 'none' }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }));
  // label plate
  const label = { x: 62, y: PLATE.y + PLATE.d - 16, w: 70, d: 10, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: 'mid', crease: 'none' }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 6.6], 0.8, P, 'x'), 'AEGIS · CHECK', { size: 3.6, tone: 'lo' }));
  out.push(D([at([label.x + 2, label.y + 5, 0.8]), at([label.x + label.w - 2, label.y + 5, 0.8])], { size: 0.4 }));
  return out.join('');
}

function legs() {
  const out = [];
  const spots = [[FRAME.x + 8, FRAME.y + 6], [FRAME.x + 8, FRAME.y + FRAME.d - 6], [FRAME.x + FRAME.w - 8, FRAME.y + 6], [FRAME.x + FRAME.w - 8, FRAME.y + FRAME.d - 6]];
  for (const [x, y] of spots.sort((a, b) => depth(...a) - depth(...b))) {
    out.push(S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 0, FRAME_Z, P, 2, 0.4), { tone: 'lo' }));
  }
  return out.join('');
}

function conveyor() {
  const out = [];
  out.push(S(k.slabOf(FRAME, FRAME_Z, FRAME_H, P, 4, 0.8), { tone: 'mid' }));
  // side rail screws
  const xs = Array.from({ length: 8 }, (_, i) => FRAME.x + 12 + i * 22);
  out.push(D(xs.map((x) => at([x, FRAME.y + FRAME.d, FRAME_Z + FRAME_H / 2])), { size: 0.45, tone: 'lo' }));
  out.push(S(k.slabOf(BELT, BELT_Z, BELT_H, P, 3, 0.3), { tone: 'lo' }));
  // belt slats
  const slats = Array.from({ length: 20 }, (_, i) => BELT.x + 6 + i * 8.2)
    .map((x) => k.pathOf([at([x, BELT.y + 1.5, TOP]), at([x, BELT.y + BELT.d - 1.5, TOP])])).join('');
  out.push(L(slats, { tone: 'faint' }));
  return out.join('');
}

function envelope(x0, lit, cls) {
  const plan = { x: x0, y: -11, w: 30, d: 22, r: 1 };
  const z = TOP;
  const h = 2.4;
  const top = z + h;
  const out = [S(k.slabOf(plan, z, h, P, 2, 0.3), { tone: 'hi', lit, className: cls })];
  const c = [plan.x + plan.w / 2, plan.y + plan.d / 2 + 2, top];
  out.push(L(k.pathOf([at([plan.x + 1, plan.y + 1, top]), at(c), at([plan.x + plan.w - 1, plan.y + 1, top])]), { tone: lit ? 'lo' : 'mid' }));
  out.push(D([at(c)], { size: 0.5, tone: 'lo' }));
  return out.join('');
}

function post(y0) {
  const out = [S(k.slabOf({ x: GATE_X - POST / 2, y: y0, w: POST, d: POST, r: 1.2 }, 0, POST_H, P, 3, 0.6), { tone: 'mid' })];
  out.push(L([14, 28, 42].map((z) => k.planOutline({ x: GATE_X - POST / 2, y: y0, w: POST, d: POST, r: 1.2 }, z, P, 3)).join(''), { tone: 'faint' }));
  return out.join('');
}

function beam() {
  const plan = { x: GATE_X - 6, y: -34, w: 12, d: 68, r: 2 };
  const out = [S(k.slabOf(plan, POST_H, BEAM_H, P, 3, 0.6), { tone: 'mid' })];
  const lensY = [-20, -8, 4, 16];
  out.push(L(lensY.map((y) => k.ring(GATE_X, y + 2, 2.4, POST_H + BEAM_H, P, 18)).join(''), { tone: 'mid' }));
  out.push(D(lensY.map((y) => at([GATE_X, y + 2, POST_H + BEAM_H])), { size: 0.6, tone: 'hi' }));
  // sensor dome
  out.push(S(k.cylinder(GATE_X, 0, 4.2, POST_H + BEAM_H, 3.4, P, 32, 0.6), { tone: 'hi', lit: true, className: 'aeg-sensor' }));
  return out.join('');
}

function tower() {
  const [x, y] = TOWER;
  const out = [];
  out.push(S(k.cylinder(x, y, 13, 0, 4, P, 40, 0.8), { tone: 'lo' }));
  out.push(L(k.ring(x, y, 10, 4, P, 32), { tone: 'faint' }));
  out.push(D([0, 90, 180, 270].map((a) => at([x + 11 * Math.cos((a * Math.PI) / 180), y + 11 * Math.sin((a * Math.PI) / 180), 4])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 2.6, 4, LAMPS[0].z - 4 - 1.4, P, 20), { tone: 'mid', crease: 'none' }));
  out.push(S(k.cylinder(x, y, LAMP_R + 0.8, LAMPS[0].z - 1.4, 1.4, P, 36), { tone: 'mid' }));
  for (const { cls, z } of LAMPS) {
    out.push(S(k.cylinder(x, y, LAMP_R, z, LAMP_H, P, 40, 0.6), { tone: 'hi', className: `aeg-lamp ${cls}` }));
    out.push(L(k.sideArc(x, y, LAMP_R, z + LAMP_H / 2, P, 32), { tone: 'faint' }));
    out.push(S(k.cylinder(x, y, LAMP_R + 0.8, z + LAMP_H, 1.5, P, 36), { tone: 'mid' }));
  }
  const capZ = LAMPS[2].z + LAMP_H + 1.5;
  out.push(S(k.cylinder(x, y, 5, capZ, 2.4, P, 32, 0.6), { tone: 'mid' }));
  return out.join('');
}

const wire = () => {
  const route = [[GATE_X + 4, 30, 6], [GATE_X + 4, 46, 0.4], [TOWER[0] - 16, 46, 0.4], [TOWER[0] - 12, 6, 0.4], [TOWER[0] - 9, 2, 2]].map(at);
  return k.wireSvg(route[0], route.at(-1), { via: route.slice(1, -1), tone: 'lo', size: 1.1 });
};

// Lamp colours are the subject (verdict colours), so they are the only colour in the drawing.
const CSS = `
.aeg-lamp .iso-fill,.aeg-lamp .iso-top{fill-opacity:1}
.aeg-lamp-safe .iso-fill,.aeg-lamp-safe .iso-top{fill:#34d399}
.aeg-lamp-warn .iso-fill,.aeg-lamp-warn .iso-top{fill:#5a4a1c}
.aeg-lamp-danger .iso-fill,.aeg-lamp-danger .iso-top{fill:#4a2026}
.aeg-lamp .iso-shade{opacity:.35}
.aeg-sensor .iso-fill,.aeg-sensor .iso-top{fill:#2de2e6}
.aeg-env-ok .iso-fill,.aeg-env-ok .iso-top{fill:#163b30}
`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  standalone: 'dark',
  label: 'An inspection gate on a bench: messages ride a conveyor belt through a scanner arch. A signal tower beside it shows the verdict with three lamps — green for safe, amber for suspicious, red for danger. The green lamp is lit for the message that has passed through.',
  body: [
    `<style>${CSS}</style>`,
    plate(),
    `<g>${wire()}</g>`,
    legs(),
    post(-34),
    conveyor(),
    envelope(-118, true),
    envelope(4, false, 'aeg-env-ok'),
    post(26),
    beam(),
    tower(),
  ],
});

writeFileSync(OUT, svg);
console.log('wrote', OUT, `${(svg.length / 1024).toFixed(1)} kB`);
