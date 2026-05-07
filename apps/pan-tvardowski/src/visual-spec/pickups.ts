import type { PickupDef, PickupSpecId, WeaponSpecId } from './types';

const pid = (s: string) => s as PickupSpecId;
const wid = (s: string) => s as WeaponSpecId;

// Colors mirror shape-catalogue.ts ARGB constants — kept local so pickup
// shapes are self-contained and unaffected by catalogue renames.
const ORANGE = 0xffff9944;
const EYE_YELLOW = 0xffffdd55;
const MIRROR = 0xffc8cdd4;
const PURPLE = 0xff8844ff;
const BLACK = 0xff111111;
const GOLD = 0xffc9a24a;
const HELLFIRE = 0xffff2b2b;
const BROWN = 0xff6b4423;

export const PICKUP_DEFS: readonly PickupDef[] = [
  // ---- Weapon-swap pickups (4) -----------------------------------------------
  {
    id: pid('pickup-iskry'),
    shapes: [
      { kind: 'circle', r: 3, fill: ORANGE, ox: -4, oy: 0, glow: 'friendly' },
      { kind: 'circle', r: 3, fill: ORANGE, ox: 4, oy: 0 },
      { kind: 'circle', r: 3, fill: ORANGE, ox: 0, oy: 4 },
    ],
    effect: { kind: 'weapon-swap', weapon: wid('iskry') },
    glow: 'friendly',
  },
  {
    id: pid('pickup-piorun'),
    shapes: [
      {
        kind: 'polyline',
        points: [-6, -8, 2, -2, -2, 2, 6, 8],
        stroke: EYE_YELLOW,
        strokeWidth: 2.5,
        glow: 'friendly',
      },
    ],
    effect: { kind: 'weapon-swap', weapon: wid('piorun') },
    glow: 'friendly',
  },
  {
    id: pid('pickup-sol-swiecona'),
    shapes: [{ kind: 'ring', r: 9, stroke: MIRROR, strokeWidth: 2, glow: 'friendly' }],
    effect: { kind: 'weapon-swap', weapon: wid('sol-swiecona') },
    glow: 'friendly',
  },
  {
    id: pid('pickup-znak-pentagramu'),
    shapes: [{ kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: PURPLE, glow: 'friendly' }],
    effect: { kind: 'weapon-swap', weapon: wid('znak-pentagramu') },
    glow: 'friendly',
  },

  // ---- Upgrade pickups (6) ---------------------------------------------------
  {
    id: pid('pickup-czarna-ksiega'),
    shapes: [
      { kind: 'rect', w: 14, h: 18, fill: BLACK, stroke: GOLD, strokeWidth: 1.5, glow: 'friendly' },
    ],
    effect: { kind: 'bomb' },
    glow: 'friendly',
  },
  {
    id: pid('pickup-siedmiomilowe-buty'),
    shapes: [
      { kind: 'rect', w: 10, h: 14, fill: BROWN, glow: 'friendly' },
      { kind: 'rect', w: 14, h: 4, fill: BROWN, ox: 2, oy: 6 },
    ],
    effect: { kind: 'speed-boost', multiplier: 1.5, durationMs: 5000 },
    glow: 'friendly',
  },
  {
    id: pid('pickup-amulet-wegrowski'),
    shapes: [
      { kind: 'ring', r: 9, stroke: GOLD, strokeWidth: 2, glow: 'friendly' },
      { kind: 'circle', r: 3, fill: HELLFIRE },
    ],
    effect: { kind: 'invuln', durationMs: 4000 },
    glow: 'friendly',
  },
  {
    id: pid('pickup-koguci-pioro'),
    shapes: [
      {
        kind: 'polyline',
        points: [0, -10, 3, 0, 0, 10, -3, 0, 0, -10],
        stroke: GOLD,
        strokeWidth: 2,
        glow: 'friendly',
      },
    ],
    effect: { kind: 'damage-boost', multiplier: 2.0, durationMs: 6000 },
    glow: 'friendly',
  },
  {
    id: pid('pickup-srebrna-tarcza'),
    shapes: [
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
    effect: { kind: 'shield', hits: 3 },
    glow: 'friendly',
  },
  {
    id: pid('pickup-kamien-filozoficzny'),
    shapes: [
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
    effect: { kind: 'screen-clear' },
    glow: 'friendly',
  },
] as const;
