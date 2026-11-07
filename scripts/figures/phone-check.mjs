/**
 * "How Aegis works" figure, drawn with the Anatomy iso-kit
 * (github.com/wheresryan22/anatomy, MIT — vendored in ./vendor/anatomy).
 *
 * The object is the explanation: a phone lies on a desk with a message thread
 * open. A lens hovers over the suspicious message and a dashed scan line runs
 * across it; a wire carries the result to the Aegis shield beside the phone,
 * which shows the check. Light theme; blue is the only accent colour.
 *
 *   node scripts/figures/phone-check.mjs   →  public/figures/phone-check.svg
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from './vendor/anatomy/iso-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../public/figures/phone-check.svg');

const WIDTH = 640;
const HEIGHT = 400;

const DESK = { x: -160, y: -84, w: 320, d: 168, r: 10 };
const DESK_H = 6;

const PHONE = { x: -128, y: -70, w: 84, d: 140, r: 13 };
const PHONE_H = 7;
const SCREEN = k.insetPlan(PHONE, 5);
const SCREEN_Z = PHONE_H;
const SCREEN_TOP = SCREEN_Z + 0.5;

const BUBBLES = [
  { x: -116, y: -54, w: 46, d: 17, r: 6, cls: 'aeg-bubble' },
  { x: -116, y: -28, w: 58, d: 24, r: 6, cls: 'aeg-bubble-flag', flagged: true },
  { x: -96, y: 6, w: 44, d: 16, r: 6, cls: 'aeg-bubble-mine' },
  { x: -116, y: 32, w: 36, d: 15, r: 6, cls: 'aeg-bubble' },
];
const FLAG = BUBBLES[1];
const LENS = { cx: FLAG.x + FLAG.w / 2 + 6, cy: FLAG.y + FLAG.d / 2, r: 17, z: 30 };

const SHIELD_C = [74, 0];
const SHIELD_W = 92;
const SHIELD_D = 104;
const SHIELD_H = 12;

const P = k.fitProjection(
  [...k.boxCorners(DESK, -DESK_H, 0), [LENS.cx, LENS.cy, LENS.z + 4], [SHIELD_C[0], SHIELD_C[1], SHIELD_H + 4]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 38 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

/** Convex shield outline in plan coordinates: flat top, sides curving into a point at +y. */
function shieldRing([cx, cy], w, d, steps = 16) {
  const top = cy - d / 2;
  const shoulder = cy - d * 0.08;
  const tip = cy + d / 2;
  const side = (t) => [(w / 2) * (1 - t) * (1 + 0.85 * t), shoulder + (tip - shoulder) * t];
  const pts = [[cx - w / 2, top + 7], [cx - w / 2 + 7, top], [cx + w / 2 - 7, top], [cx + w / 2, top + 7]];
  for (let i = 0; i < steps; i++) { const [x, y] = side(i / steps); pts.push([cx + x, y]); }
  pts.push([cx, tip]);
  for (let i = steps - 1; i >= 0; i--) { const [x, y] = side(i / steps); pts.push([cx - x, y]); }
  return pts;
}

function desk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(DESK, -DESK_H, DESK_H, P)}"/>`];
  out.push(S(k.slabOf(DESK, -DESK_H, DESK_H, P, 8, 1.4), { tone: 'mid' }));
  out.push(L(k.planOutline(k.insetPlan(DESK, 6), 0, P), { tone: 'faint' }));
  const screws = k.corners(DESK, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(''), { tone: 'lo' }));
  // label plate
  const label = { x: 26, y: DESK.y + DESK.d - 18, w: 84, d: 11, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: 'mid', crease: 'none' }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 5, label.y + 7.2], 0.8, P, 'x'), 'AEGIS · CHECKED', { size: 3.8, tone: 'lo' }));
  return out.join('');
}

function phone() {
  const out = [];
  out.push(S(k.slabOf(PHONE, 0, PHONE_H, P, 10, 1.2), { tone: 'hi' }));
  out.push(S(k.slabOf(SCREEN, SCREEN_Z, 0.5, P, 8), { tone: 'mid', crease: 'none', className: 'aeg-screen' }));
  // speaker slot + camera
  const slotY = PHONE.y + 3;
  out.push(L(k.lineOnTop([-92, slotY], [-80, slotY], SCREEN_TOP, P), { tone: 'mid' }));
  out.push(D([at([-73, slotY, SCREEN_TOP])], { size: 0.7, tone: 'hi' }));
  // side buttons
  out.push(S(k.slabOf({ x: PHONE.x + PHONE.w, y: -40, w: 1.6, d: 18, r: 0.6 }, 2, 3, P, 2), { tone: 'mid', crease: 'none' }));
  for (const b of BUBBLES) {
    out.push(S(k.slabOf(b, SCREEN_TOP, b.flagged ? 1.4 : 0.9, P, 6), { tone: b.flagged ? 'hi' : 'mid', crease: 'none', className: b.cls, lit: b.flagged }));
    const lines = b.flagged ? [0.38, 0.64] : [0.5];
    const z = SCREEN_TOP + (b.flagged ? 1.4 : 0.9);
    out.push(L(lines.map((f) => k.lineOnTop([b.x + 6, b.y + b.d * f], [b.x + b.w * (f < 0.5 ? 0.82 : 0.6), b.y + b.d * f], z, P)).join(''), { tone: b.flagged ? 'blue' : 'faint' }));
  }
  // scan line across the flagged message
  const sz = SCREEN_TOP + 1.6;
  out.push(L(k.lineOnTop([SCREEN.x + 2, FLAG.y + FLAG.d + 3], [SCREEN.x + SCREEN.w - 2, FLAG.y + FLAG.d + 3], sz, P), { tone: 'blue', flow: true, className: 'aeg-scan' }));
  return out.join('');
}

function lens() {
  const { cx, cy, r, z } = LENS;
  const out = [];
  // shadow ring on the screen
  out.push(L(k.ring(cx, cy, r * 0.9, SCREEN_TOP + 0.2, P, 40), { tone: 'faint', dashed: true }));
  out.push(L(k.rise([cx, cy + r], SCREEN_TOP + 1.6, z, P), { tone: 'faint', dotted: true }));
  out.push(S(k.cylinder(cx, cy, r, z, 2.4, P, 48, 0.4), { tone: 'hi', className: 'aeg-lens' }));
  out.push(L(k.ring(cx, cy, r - 3, z + 2.4, P, 40), { tone: 'blue' }));
  // handle
  out.push(S(k.slabOf({ x: cx + r - 2, y: cy - 3, w: 30, d: 6, r: 2.6 }, z + 0.2, 2, P, 3), { tone: 'mid', crease: 'none' }));
  return out.join('');
}

function shield() {
  const ring = shieldRing(SHIELD_C, SHIELD_W, SHIELD_D);
  const out = [];
  out.push(`<path class="iso-halo" d="${k.pathOf(ring.map(([x, y]) => at([x, y, -2])), true)}"/>`);
  out.push(S(k.extrude(ring, 0, SHIELD_H, P, { convex: true, bevel: 1 }), { tone: 'hi', className: 'aeg-shield' }));
  const inner = shieldRing(SHIELD_C, SHIELD_W - 16, SHIELD_D - 18);
  out.push(L(k.onTop(inner, SHIELD_H, P, true), { tone: 'lit', className: 'aeg-shield-inset' }));
  // check mark on top
  const [cx, cy] = SHIELD_C;
  const check = [[cx - 22, cy - 6], [cx - 6, cy + 12], [cx + 18, cy - 24]];
  out.push(L(k.onTop(check, SHIELD_H + 0.1, P), { tone: 'lit', className: 'aeg-check' }));
  return out.join('');
}

const wire = () => {
  const route = [[PHONE.x + PHONE.w - 2, 34, 2], [PHONE.x + PHONE.w + 14, 50, 0.4], [SHIELD_C[0] - 30, 50, 0.4], [SHIELD_C[0] - 26, 30, 2]].map(at);
  return k.wireSvg(route[0], route.at(-1), { via: route.slice(1, -1), tone: 'mid', flow: true, size: 1.1 });
};

// Blue is the only accent; everything else stays in the kit's light greys.
const CSS = `
.aeg-screen .iso-top{fill:#f3f7ff}
.aeg-bubble .iso-top{fill:#eef2f8}
.aeg-bubble-mine .iso-top{fill:#dbe7ff}
.aeg-bubble-flag .iso-top{fill:#ffffff}
.aeg-bubble-flag>.iso-edge,.aeg-bubble-flag .iso-line{stroke:#2563eb}
.aeg-lens .iso-top{fill:#e8f0ff;fill-opacity:.85}
.aeg-shield .iso-top{fill:#2563eb}
.aeg-shield .iso-shade{fill:#1d4ed8}
.aeg-shield .iso-shade[data-shade="0"]{fill:#1e40af}
.aeg-shield .iso-fill{fill:#2563eb}
.aeg-shield-inset{stroke:#93b4ff !important}
.aeg-check{stroke:#ffffff !important;stroke-width:3.2px !important}
.iso-line[data-tone="blue"]{stroke:#2563eb}
.aeg-scan{stroke-width:1.2px}
`;

// The desk is always painted first; everything on it is ordered by depth.
const parts = [
  { d: depth(-40, 70, 0), svg: `<g>${wire()}</g>` },
  { d: depth(SHIELD_C[0], SHIELD_C[1]), svg: shield() },
  { d: depth(PHONE.x + PHONE.w / 2, PHONE.y + PHONE.d / 2), svg: phone() },
  { d: depth(LENS.cx, LENS.cy, LENS.z) + 1000, svg: lens() },
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  standalone: 'light',
  label: 'A phone lies on a desk with a message thread open. A magnifying lens hovers over one suspicious message while a blue scan line runs across it, and a wire carries the result to a blue Aegis shield beside the phone, marked with a white check.',
  body: [`<style>${CSS}</style>`, desk(), ...parts.sort((a, b) => a.d - b.d).map((p) => p.svg)],
});

writeFileSync(OUT, svg);
console.log('wrote', OUT, `${(svg.length / 1024).toFixed(1)} kB`);
