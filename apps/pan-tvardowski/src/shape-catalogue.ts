/**
 * Shape catalogue — maps every gameplay entity (enemies, minibosses, bosses,
 * ships, pickups) to its composed `ShapeSpec[]`. Source: build plan §§6–12.
 *
 * This is data-only; the runtime renderer lands in M1.
 */

import type { ShapeSpec } from './shapes';

// Zone palette colors inlined as ARGB ints — catalogue is self-contained so
// that renaming a palette channel can't silently re-color an entity.
const BLACK = 0xff111111;
const ORANGE = 0xffff9944;
const RED = 0xffc0392b;
const DARK_RED = 0xff7a1a1a;
const PURPLE = 0xff8844ff;
const BLUE_GREEN = 0xff3aa08c;
const GREEN = 0xff5cae6e;
const PALE = 0xffe6dcc8;
const YELLOW_WHITE = 0xfff7f3a6;
const TEAL = 0xff3ac4b4;
const BROWN = 0xff6b4423;
const GOLD = 0xfff3c262;
const MIRROR = 0xffc8cdd4;
const COPPER = 0xffb5651d;
const HELLFIRE = 0xffff2b2b;
const EYE_YELLOW = 0xffffdd55;

// ---- Enemies (12) -----------------------------------------------------------

const enemies = {
  skrzat: [
    { kind: 'triangle', size: 14, fill: ORANGE },
    { kind: 'circle', r: 1.5, fill: BLACK, ox: -3, oy: 2 },
    { kind: 'circle', r: 1.5, fill: BLACK, ox: 3, oy: 2 },
  ],
  latawiec: [
    { kind: 'triangle', size: 20, fill: RED },
    {
      kind: 'polyline',
      points: [0, 8, -4, 14, 0, 11, 4, 14],
      stroke: RED,
      strokeWidth: 1.5,
    },
  ],
  czart: [
    { kind: 'ngon', n: 5, r: 14, fill: BLACK },
    { kind: 'triangle', size: 6, fill: BLACK, ox: -8, oy: -10 },
    { kind: 'triangle', size: 6, fill: BLACK, ox: 8, oy: -10 },
  ],
  bies: [
    { kind: 'ngon', n: 6, r: 14, fill: DARK_RED },
    { kind: 'circle', r: 2.5, fill: EYE_YELLOW },
  ],
  licho: [{ kind: 'star', points: 5, rOuter: 16, rInner: 7, fill: PURPLE }],
  strzyga: [
    { kind: 'triangle', size: 16, fill: PALE },
    { kind: 'rect', w: 14, h: 3, fill: PALE, ox: -10, oy: 0, rot: -0.4 },
    { kind: 'rect', w: 14, h: 3, fill: PALE, ox: 10, oy: 0, rot: 0.4 },
  ],
  topielec: [
    { kind: 'circle', r: 14, fill: BLUE_GREEN },
    {
      kind: 'polyline',
      points: [-6, 10, -8, 18, -4, 14, -2, 20],
      stroke: GREEN,
      strokeWidth: 2,
    },
    {
      kind: 'polyline',
      points: [6, 10, 8, 18, 4, 14, 2, 20],
      stroke: GREEN,
      strokeWidth: 2,
    },
  ],
  mamuna: [
    { kind: 'ngon', n: 8, r: 14, fill: GREEN },
    { kind: 'circle', r: 2, fill: PALE, ox: 0, oy: -3 },
    { kind: 'circle', r: 2, fill: PALE, ox: 0, oy: 0 },
    { kind: 'circle', r: 2, fill: PALE, ox: 0, oy: 3 },
  ],
  nocnica: [{ kind: 'circle', r: 10, fill: BLACK }],
  poludnica: [
    { kind: 'triangle', size: 18, fill: YELLOW_WHITE },
    { kind: 'rect', w: 28, h: 2, fill: MIRROR, ox: 14, oy: 4, rot: 0.3 },
  ],
  wapierz: [
    {
      kind: 'ngon',
      n: 8,
      r: 18,
      fill: DARK_RED,
      stroke: BLACK,
      strokeWidth: 2,
    },
  ],
  hound: [
    { kind: 'circle', r: 11, fill: BLACK },
    { kind: 'triangle', size: 5, fill: BLACK, ox: -6, oy: -9 },
    { kind: 'triangle', size: 5, fill: BLACK, ox: 6, oy: -9 },
    { kind: 'circle', r: 2, fill: DARK_RED, ox: -4, oy: -1 },
    { kind: 'circle', r: 2, fill: DARK_RED, ox: 4, oy: -1 },
  ],
  dziwozona: [
    { kind: 'ngon', n: 5, r: 16, fill: TEAL },
    { kind: 'triangle', size: 6, fill: TEAL, ox: -18, oy: 0 },
    { kind: 'triangle', size: 6, fill: TEAL, ox: 18, oy: 0 },
  ],
  'moon-wraith': [
    { kind: 'triangle', size: 14, fill: 0xff2b2d5a },
    { kind: 'ring', r: 10, stroke: MIRROR, strokeWidth: 1.5 },
    { kind: 'circle', r: 2, fill: MIRROR, ox: 0, oy: -2 },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Mini-bosses (4) --------------------------------------------------------

const minibosses = {
  rokita: [
    { kind: 'ngon', n: 4, r: 30, fill: GREEN },
    {
      kind: 'polyline',
      points: [-40, 0, -20, -10, 0, 0, 20, -10, 40, 0],
      stroke: BROWN,
      strokeWidth: 3,
    },
  ],
  leszy: [{ kind: 'ngon', n: 6, r: 36, fill: BROWN, stroke: GREEN, strokeWidth: 2 }],
  'nocny-lowca': [
    { kind: 'star', points: 4, rOuter: 40, rInner: 12, fill: BLACK },
    { kind: 'triangle', size: 8, fill: PALE, ox: -24, oy: 0 },
    { kind: 'triangle', size: 8, fill: PALE, ox: 24, oy: 0 },
    { kind: 'triangle', size: 8, fill: PALE, ox: 0, oy: -24 },
    { kind: 'triangle', size: 8, fill: PALE, ox: 0, oy: 24 },
  ],
  madej: [
    { kind: 'rect', w: 80, h: 16, fill: HELLFIRE },
    { kind: 'triangle', size: 10, fill: BLACK, ox: -32, oy: -10 },
    { kind: 'triangle', size: 10, fill: BLACK, ox: -16, oy: -10 },
    { kind: 'triangle', size: 10, fill: BLACK, ox: 0, oy: -10 },
    { kind: 'triangle', size: 10, fill: BLACK, ox: 16, oy: -10 },
    { kind: 'triangle', size: 10, fill: BLACK, ox: 32, oy: -10 },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Bosses (8) -------------------------------------------------------------

const bosses = {
  'smok-krzemionkowski': [
    { kind: 'ngon', n: 6, r: 48, fill: COPPER },
    { kind: 'triangle', size: 20, fill: HELLFIRE, ox: 0, oy: 32 },
  ],
  'borowy-krol': [
    { kind: 'ngon', n: 5, r: 52, fill: GREEN, stroke: BROWN, strokeWidth: 3 },
    {
      kind: 'star',
      points: 5,
      rOuter: 18,
      rInner: 7,
      fill: GOLD,
      ox: 0,
      oy: -20,
    },
  ],
  'wodnik-wislanny': [
    {
      kind: 'gradient-rect',
      w: 96,
      h: 80,
      colorA: 0xff2f5f7a,
      colorB: BLUE_GREEN,
      axis: 1,
    },
    { kind: 'circle', r: 32, fill: BLUE_GREEN },
  ],
  boruta: [
    {
      kind: 'ngon',
      n: 8,
      r: 56,
      fill: BLACK,
      stroke: HELLFIRE,
      strokeWidth: 2,
    },
    { kind: 'triangle', size: 12, fill: HELLFIRE, ox: -36, oy: -36 },
    { kind: 'triangle', size: 12, fill: HELLFIRE, ox: 36, oy: -36 },
  ],
  'baba-jaga': [
    { kind: 'ngon', n: 3, r: 48, fill: PURPLE },
    { kind: 'rect', w: 60, h: 4, fill: BROWN, ox: 0, oy: 30 },
  ],
  'bazyliszek-warszawski': [
    { kind: 'ngon', n: 6, r: 52, fill: 0xff9d3dff },
    { kind: 'circle', r: 10, fill: EYE_YELLOW },
  ],
  mefistofeles: [
    { kind: 'star', points: 6, rOuter: 56, rInner: 20, fill: HELLFIRE },
    { kind: 'circle', r: 12, fill: BLACK },
  ],
  'lucyper-ksiezycowy': [
    {
      kind: 'gradient-rect',
      w: 160,
      h: 120,
      colorA: 0xff2b2d5a,
      colorB: 0xffd6002e,
      axis: 1,
    },
    { kind: 'star', points: 8, rOuter: 60, rInner: 24, fill: MIRROR },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Ships (3) --------------------------------------------------------------

const ships = {
  'kogut-zloty': [
    { kind: 'triangle', size: 24, fill: GOLD },
    { kind: 'circle', r: 3, fill: HELLFIRE, ox: 0, oy: -10 },
  ],
  alembik: [{ kind: 'ngon', n: 5, r: 18, fill: MIRROR, stroke: COPPER, strokeWidth: 2 }],
  zwierciadlo: [
    { kind: 'ngon', n: 4, r: 20, fill: MIRROR, stroke: BLACK, strokeWidth: 2 },
    { kind: 'ring', r: 22, stroke: MIRROR, strokeWidth: 1.5 },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Weapon pickups (4) -----------------------------------------------------

const weaponPickups = {
  iskry: [
    { kind: 'circle', r: 3, fill: ORANGE, ox: -4, oy: 0 },
    { kind: 'circle', r: 3, fill: ORANGE, ox: 4, oy: 0 },
    { kind: 'circle', r: 3, fill: ORANGE, ox: 0, oy: 4 },
  ],
  piorun: [
    {
      kind: 'polyline',
      points: [-6, -8, 2, -2, -2, 2, 6, 8],
      stroke: EYE_YELLOW,
      strokeWidth: 2.5,
    },
  ],
  'sol-swiecona': [{ kind: 'ring', r: 9, stroke: MIRROR, strokeWidth: 2 }],
  'znak-pentagramu': [{ kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: PURPLE }],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Upgrade pickups (6) ----------------------------------------------------

const upgradePickups = {
  'czarna-ksiega': [{ kind: 'rect', w: 14, h: 18, fill: BLACK, stroke: GOLD, strokeWidth: 1.5 }],
  'siedmiomilowe-buty': [
    { kind: 'rect', w: 10, h: 14, fill: BROWN },
    { kind: 'rect', w: 14, h: 4, fill: BROWN, ox: 2, oy: 6 },
  ],
  'amulet-wegrowski': [
    { kind: 'ring', r: 9, stroke: GOLD, strokeWidth: 2 },
    { kind: 'circle', r: 3, fill: HELLFIRE },
  ],
  'koguci-pioro': [
    {
      kind: 'polyline',
      points: [0, -10, 3, 0, 0, 10, -3, 0, 0, -10],
      stroke: GOLD,
      strokeWidth: 2,
    },
  ],
  'srebrna-tarcza': [
    {
      kind: 'ngon',
      n: 6,
      r: 10,
      fill: MIRROR,
      stroke: BLACK,
      strokeWidth: 1.5,
    },
  ],
  'kamien-filozoficzny': [
    { kind: 'ngon', n: 8, r: 9, fill: PURPLE, stroke: GOLD, strokeWidth: 1.5 },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

export const SHAPE_CATALOGUE = Object.freeze({
  enemies,
  minibosses,
  bosses,
  ships,
  weaponPickups,
  upgradePickups,
});

export type EntityId =
  | keyof typeof enemies
  | keyof typeof minibosses
  | keyof typeof bosses
  | keyof typeof ships
  | keyof typeof weaponPickups
  | keyof typeof upgradePickups;
