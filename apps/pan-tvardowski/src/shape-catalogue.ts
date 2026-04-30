/**
 * Shape catalogue — maps every gameplay entity (enemies, minibosses, bosses,
 * ships, pickups) to its composed `ShapeSpec[]`. Source: build plan §§6–12.
 *
 * This is data-only; the runtime renderer lands in M1.
 */

import type { ShapeSpec, ShipSpec } from './shapes';

// Zone palette colors inlined as ARGB ints — catalogue is self-contained so
// that renaming a palette channel can't silently re-color an entity.
const BLACK = 0xff111111;
const ORANGE = 0xffff9944;
const RED = 0xffe84b2a;
const DARK_RED = 0xff7a1a1a;
const PURPLE = 0xff8844ff;
const BLUE_GREEN = 0xff3aa08c;
const GREEN = 0xff5cae6e;
const PALE = 0xffe6dcc8;
const YELLOW_WHITE = 0xfff7f3a6;
const TEAL = 0xff3ac4b4;
const BROWN = 0xff6b4423;
const GOLD = 0xffc9a24a;
const MIRROR = 0xffc8cdd4;
const HELLFIRE = 0xffff2b2b;
const EYE_YELLOW = 0xffffdd55;

// Mini-boss hue family — crimson (folio XIIIb+)
const CRIMSON = 0xffd4213d;
const CRIMSON_DARK = 0xff7a1322;
const CRIMSON_RUST = 0xff8b3a1f;

// Boss hue family — violet (folio XIIIf)
const VIOLET_DARK = 0xff3a0f5c;
const VIOLET_DEEP = 0xff5c1a8a;
const VIOLET_MID = 0xff8844cc;

// Player ship hue family — brand-tagged (folio XIIIc)
const BOG_GREEN = 0xff1a2e1f;
const DEEP_BLUE = 0xff1a2e4a;

// ---- Enemies (14) -----------------------------------------------------------

const enemies = {
  skrzat: {
    kind: 'ship',
    hull: { kind: 'triangle', size: 14, fill: ORANGE },
    weapons: [{ kind: 'rect', w: 6, h: 4, fill: ORANGE, ox: 0, oy: 6 }],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  latawiec: {
    kind: 'ship',
    hull: { kind: 'triangle', size: 20, fill: RED },
    weapons: [
      { kind: 'rect', w: 5, h: 8, fill: RED, ox: -8, oy: 4 },
      { kind: 'rect', w: 5, h: 8, fill: RED, ox: 8, oy: 4 },
    ],
    engine: { kind: 'square', size: 20, fill: DARK_RED },
  },
  czart: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 5, r: 14, fill: BLACK },
    weapons: [
      { kind: 'rect', w: 4, h: 10, fill: BLACK, ox: -10, oy: -6 },
      { kind: 'rect', w: 4, h: 10, fill: BLACK, ox: 10, oy: -6 },
    ],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  bies: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 6, r: 14, fill: DARK_RED },
    weapons: [
      { kind: 'rect', w: 5, h: 10, fill: DARK_RED, ox: -10, oy: 0 },
      { kind: 'rect', w: 5, h: 10, fill: DARK_RED, ox: 10, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  licho: {
    kind: 'ship',
    hull: { kind: 'star', points: 5, rOuter: 16, rInner: 7, fill: PURPLE },
    weapons: [{ kind: 'rect', w: 4, h: 12, fill: PURPLE, ox: 0, oy: 8 }],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  strzyga: {
    kind: 'ship',
    hull: { kind: 'triangle', size: 16, fill: PALE },
    weapons: [
      { kind: 'rect', w: 14, h: 3, fill: PALE, ox: -10, oy: 0 },
      { kind: 'rect', w: 14, h: 3, fill: PALE, ox: 10, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: PALE },
  },
  topielec: {
    kind: 'ship',
    hull: { kind: 'circle', r: 14, fill: BLUE_GREEN },
    weapons: [
      { kind: 'rect', w: 4, h: 12, fill: GREEN, ox: -8, oy: 8 },
      { kind: 'rect', w: 4, h: 12, fill: GREEN, ox: 8, oy: 8 },
    ],
    engine: { kind: 'square', size: 20, fill: BLUE_GREEN },
  },
  mamuna: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 8, r: 14, fill: GREEN },
    weapons: [
      { kind: 'rect', w: 5, h: 8, fill: GREEN, ox: -10, oy: 2 },
      { kind: 'rect', w: 5, h: 8, fill: GREEN, ox: 10, oy: 2 },
    ],
    engine: { kind: 'square', size: 20, fill: GREEN },
  },
  nocnica: {
    kind: 'ship',
    hull: { kind: 'circle', r: 10, fill: BLACK },
    weapons: [{ kind: 'rect', w: 6, h: 8, fill: BLACK, ox: 0, oy: 6 }],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  poludnica: {
    kind: 'ship',
    hull: { kind: 'triangle', size: 18, fill: YELLOW_WHITE },
    weapons: [
      { kind: 'rect', w: 28, h: 2, fill: MIRROR, ox: -14, oy: 4 },
      { kind: 'rect', w: 28, h: 2, fill: MIRROR, ox: 14, oy: 4 },
    ],
    engine: { kind: 'square', size: 20, fill: YELLOW_WHITE },
  },
  wapierz: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 8, r: 18, fill: DARK_RED, stroke: BLACK, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 6, h: 12, fill: DARK_RED, ox: -12, oy: 0 },
      { kind: 'rect', w: 6, h: 12, fill: DARK_RED, ox: 12, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  hound: {
    kind: 'ship',
    hull: { kind: 'circle', r: 11, fill: BLACK },
    weapons: [
      { kind: 'rect', w: 4, h: 8, fill: DARK_RED, ox: -6, oy: 0 },
      { kind: 'rect', w: 4, h: 8, fill: DARK_RED, ox: 6, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: BLACK },
  },
  dziwozona: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 5, r: 16, fill: TEAL },
    weapons: [
      { kind: 'rect', w: 8, h: 4, fill: TEAL, ox: -16, oy: 0 },
      { kind: 'rect', w: 8, h: 4, fill: TEAL, ox: 16, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: TEAL },
  },
  'moon-wraith': {
    kind: 'ship',
    hull: { kind: 'triangle', size: 14, fill: 0xff2b2d5a },
    weapons: [{ kind: 'rect', w: 8, h: 3, fill: MIRROR, ox: 0, oy: 6 }],
    engine: { kind: 'square', size: 20, fill: 0xff2b2d5a },
  },
} as const satisfies Record<string, ShipSpec>;

// ---- Mini-bosses (4) --------------------------------------------------------
// Crimson hue family, 2–3 rect weapons each (folio XIIIb+).

const minibosses = {
  rokita: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 6, r: 30, fill: CRIMSON },
    weapons: [
      { kind: 'rect', w: 8, h: 14, fill: CRIMSON_DARK, ox: -18, oy: 0 },
      { kind: 'rect', w: 8, h: 14, fill: CRIMSON_DARK, ox: 18, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: CRIMSON_DARK },
  },
  leszy: {
    kind: 'ship',
    hull: { kind: 'ngon', n: 4, r: 32, fill: CRIMSON_DARK, stroke: CRIMSON, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 6, h: 16, fill: CRIMSON, ox: -20, oy: -4 },
      { kind: 'rect', w: 6, h: 16, fill: CRIMSON, ox: 0, oy: -20 },
      { kind: 'rect', w: 6, h: 16, fill: CRIMSON, ox: 20, oy: -4 },
    ],
    engine: { kind: 'square', size: 20, fill: CRIMSON_DARK },
  },
  'nocny-lowca': {
    kind: 'ship',
    hull: { kind: 'ngon', n: 5, r: 30, fill: CRIMSON_RUST },
    weapons: [
      { kind: 'rect', w: 10, h: 6, fill: CRIMSON, ox: -22, oy: 8 },
      { kind: 'rect', w: 10, h: 6, fill: CRIMSON, ox: 22, oy: 8 },
      { kind: 'rect', w: 10, h: 6, fill: CRIMSON, ox: 0, oy: -22 },
    ],
    engine: { kind: 'square', size: 20, fill: CRIMSON_RUST },
  },
  madej: {
    kind: 'ship',
    hull: { kind: 'triangle', size: 34, fill: CRIMSON_RUST, stroke: CRIMSON_DARK, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 12, h: 6, fill: CRIMSON_DARK, ox: -20, oy: 10 },
      { kind: 'rect', w: 12, h: 6, fill: CRIMSON_DARK, ox: 20, oy: 10 },
    ],
    engine: { kind: 'square', size: 20, fill: CRIMSON_DARK },
  },
} as const satisfies Record<string, ShipSpec>;

// ---- Bosses (8) -------------------------------------------------------------
// Violet hue family, 2–4 rect weapons each (folio XIIIf).

const bosses = {
  // Each hull uses a distinct violet-family shade so silhouettes are
  // visually unique at phone scale. Named constants cover the primary triad;
  // intermediates are inline ARGB literals within the violet hue range.
  'smok-krzemionkowski': {
    kind: 'ship',
    hull: { kind: 'ngon', n: 6, r: 48, fill: VIOLET_DARK },
    weapons: [
      { kind: 'rect', w: 10, h: 20, fill: VIOLET_MID, ox: -32, oy: 0 },
      { kind: 'rect', w: 10, h: 20, fill: VIOLET_MID, ox: 32, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DARK },
  },
  'borowy-krol': {
    kind: 'ship',
    hull: { kind: 'ngon', n: 5, r: 52, fill: VIOLET_DEEP },
    weapons: [
      { kind: 'rect', w: 8, h: 18, fill: VIOLET_MID, ox: -36, oy: -8 },
      { kind: 'rect', w: 8, h: 18, fill: VIOLET_MID, ox: 0, oy: -36 },
      { kind: 'rect', w: 8, h: 18, fill: VIOLET_MID, ox: 36, oy: -8 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DEEP },
  },
  'wodnik-wislanny': {
    kind: 'ship',
    hull: { kind: 'circle', r: 44, fill: VIOLET_MID, stroke: VIOLET_DARK, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 10, h: 22, fill: VIOLET_DARK, ox: -30, oy: 10 },
      { kind: 'rect', w: 10, h: 22, fill: VIOLET_DARK, ox: 30, oy: 10 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_MID },
  },
  boruta: {
    kind: 'ship',
    // 0xff4a1270 — violet between VIOLET_DARK and VIOLET_DEEP
    hull: { kind: 'ngon', n: 8, r: 50, fill: 0xff4a1270, stroke: VIOLET_MID, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 8, h: 16, fill: VIOLET_MID, ox: -38, oy: -16 },
      { kind: 'rect', w: 8, h: 16, fill: VIOLET_MID, ox: -12, oy: -36 },
      { kind: 'rect', w: 8, h: 16, fill: VIOLET_MID, ox: 12, oy: -36 },
      { kind: 'rect', w: 8, h: 16, fill: VIOLET_MID, ox: 38, oy: -16 },
    ],
    engine: { kind: 'square', size: 20, fill: 0xff4a1270 },
  },
  'baba-jaga': {
    kind: 'ship',
    // 0xff6a28a8 — lighter violet, brighter than VIOLET_MID
    hull: { kind: 'ngon', n: 3, r: 48, fill: 0xff6a28a8 },
    weapons: [
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_DARK, ox: -28, oy: 12 },
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_DARK, ox: 28, oy: 12 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DARK },
  },
  'bazyliszek-warszawski': {
    kind: 'ship',
    // 0xff9d3dff — brighter violet-purple (retained from previous catalogue)
    hull: { kind: 'ngon', n: 6, r: 52, fill: 0xff9d3dff },
    weapons: [
      { kind: 'rect', w: 10, h: 18, fill: VIOLET_MID, ox: -40, oy: 0 },
      { kind: 'rect', w: 10, h: 12, fill: VIOLET_MID, ox: -20, oy: -28 },
      { kind: 'rect', w: 10, h: 12, fill: VIOLET_MID, ox: 20, oy: -28 },
      { kind: 'rect', w: 10, h: 18, fill: VIOLET_MID, ox: 40, oy: 0 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DEEP },
  },
  mefistofeles: {
    kind: 'ship',
    // 0xff2a0840 — near-black violet, darkest of the 8
    hull: { kind: 'star', points: 6, rOuter: 50, rInner: 20, fill: 0xff2a0840 },
    weapons: [
      { kind: 'rect', w: 8, h: 22, fill: VIOLET_MID, ox: -30, oy: -18 },
      { kind: 'rect', w: 8, h: 22, fill: VIOLET_MID, ox: 30, oy: -18 },
      { kind: 'rect', w: 8, h: 22, fill: VIOLET_MID, ox: 0, oy: -38 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DARK },
  },
  'lucyper-ksiezycowy': {
    kind: 'ship',
    // 0xff7020b8 — vivid mid-violet, brightest hull in the boss set
    hull: { kind: 'star', points: 8, rOuter: 54, rInner: 22, fill: 0xff7020b8 },
    weapons: [
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_MID, ox: -44, oy: -16 },
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_MID, ox: -14, oy: -44 },
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_MID, ox: 14, oy: -44 },
      { kind: 'rect', w: 8, h: 20, fill: VIOLET_MID, ox: 44, oy: -16 },
    ],
    engine: { kind: 'square', size: 20, fill: VIOLET_DEEP },
  },
} as const satisfies Record<string, ShipSpec>;

// ---- Ships (3) --------------------------------------------------------------
// Brand-tagged hue families, 2 rect weapons each, glow:'friendly' (folio XIIIc).

const ships = {
  'kogut-zloty': {
    kind: 'ship',
    glow: 'friendly',
    hull: { kind: 'triangle', size: 28, fill: GOLD },
    weapons: [
      { kind: 'rect', w: 6, h: 12, fill: GOLD, ox: -14, oy: 8 },
      { kind: 'rect', w: 6, h: 12, fill: GOLD, ox: 14, oy: 8 },
    ],
    engine: { kind: 'square', size: 20, fill: GOLD },
  },
  alembik: {
    kind: 'ship',
    glow: 'friendly',
    hull: { kind: 'ngon', n: 6, r: 22, fill: BOG_GREEN, stroke: GREEN, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 6, h: 14, fill: GREEN, ox: -16, oy: 6 },
      { kind: 'rect', w: 6, h: 14, fill: GREEN, ox: 16, oy: 6 },
    ],
    engine: { kind: 'square', size: 20, fill: BOG_GREEN },
  },
  zwierciadlo: {
    kind: 'ship',
    glow: 'friendly',
    hull: { kind: 'ngon', n: 4, r: 24, fill: DEEP_BLUE, stroke: MIRROR, strokeWidth: 2 },
    weapons: [
      { kind: 'rect', w: 6, h: 14, fill: MIRROR, ox: -16, oy: 6 },
      { kind: 'rect', w: 6, h: 14, fill: MIRROR, ox: 16, oy: 6 },
    ],
    engine: { kind: 'square', size: 20, fill: DEEP_BLUE },
  },
} as const satisfies Record<string, ShipSpec>;

// ---- Weapon pickups (4) -----------------------------------------------------

const weaponPickups = {
  iskry: [
    { kind: 'circle', r: 3, fill: ORANGE, ox: -4, oy: 0, glow: 'friendly' },
    { kind: 'circle', r: 3, fill: ORANGE, ox: 4, oy: 0 },
    { kind: 'circle', r: 3, fill: ORANGE, ox: 0, oy: 4 },
  ],
  piorun: [
    {
      kind: 'polyline',
      points: [-6, -8, 2, -2, -2, 2, 6, 8],
      stroke: EYE_YELLOW,
      strokeWidth: 2.5,
      glow: 'friendly',
    },
  ],
  'sol-swiecona': [{ kind: 'ring', r: 9, stroke: MIRROR, strokeWidth: 2, glow: 'friendly' }],
  'znak-pentagramu': [
    { kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: PURPLE, glow: 'friendly' },
  ],
} as const satisfies Record<string, readonly ShapeSpec[]>;

// ---- Upgrade pickups (6) ----------------------------------------------------

const upgradePickups = {
  'czarna-ksiega': [
    { kind: 'rect', w: 14, h: 18, fill: BLACK, stroke: GOLD, strokeWidth: 1.5, glow: 'friendly' },
  ],
  'siedmiomilowe-buty': [
    { kind: 'rect', w: 10, h: 14, fill: BROWN, glow: 'friendly' },
    { kind: 'rect', w: 14, h: 4, fill: BROWN, ox: 2, oy: 6 },
  ],
  'amulet-wegrowski': [
    { kind: 'ring', r: 9, stroke: GOLD, strokeWidth: 2, glow: 'friendly' },
    { kind: 'circle', r: 3, fill: HELLFIRE },
  ],
  'koguci-pioro': [
    {
      kind: 'polyline',
      points: [0, -10, 3, 0, 0, 10, -3, 0, 0, -10],
      stroke: GOLD,
      strokeWidth: 2,
      glow: 'friendly',
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
      glow: 'friendly',
    },
  ],
  'kamien-filozoficzny': [
    {
      kind: 'ngon',
      n: 8,
      r: 9,
      fill: PURPLE,
      stroke: GOLD,
      strokeWidth: 1.5,
      glow: 'friendly',
    },
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
