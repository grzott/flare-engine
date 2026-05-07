/**
 * Hull preset catalogue. ShipDef.hullColor overrides the placeholder fill
 * (0xff888888) at render time — presets carry neutral fills only for atlas
 * tile generation and silhouette testing.
 */

import type { ShapeSpec } from '@flare-engine/shapes';
import type { HullPreset, HullPresetId } from './types';

const PLACEHOLDER = 0xff888888;

const presets: Record<HullPresetId, HullPreset> = {
  triangle: {
    id: 'triangle',
    shapes: [{ kind: 'triangle', size: 20, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 10 },
      two: [
        { x: -10, y: 6 },
        { x: 10, y: 6 },
      ],
    },
    engineHook: { x: 0, y: -12 },
    engineOverflow: 0.5,
    bounds: { r: 20 },
  },

  circle: {
    id: 'circle',
    shapes: [{ kind: 'circle', r: 14, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 12 },
      two: [
        { x: -8, y: 8 },
        { x: 8, y: 8 },
      ],
    },
    engineHook: { x: 0, y: -14 },
    engineOverflow: 0.5,
    bounds: { r: 14 },
  },

  square: {
    id: 'square',
    shapes: [{ kind: 'ngon', n: 4, r: 24, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 20 },
      two: [
        { x: -16, y: 6 },
        { x: 16, y: 6 },
      ],
    },
    engineHook: { x: 0, y: -20 },
    engineOverflow: 0.5,
    bounds: { r: 24 },
  },

  'half-circle': {
    id: 'half-circle',
    shapes: [{ kind: 'ngon', n: 3, r: 48, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 28 },
      two: [
        { x: -28, y: 12 },
        { x: 28, y: 12 },
      ],
    },
    engineHook: { x: 0, y: -28 },
    engineOverflow: 0.5,
    bounds: { r: 48 },
  },

  'quarter-moon': {
    id: 'quarter-moon',
    shapes: [{ kind: 'ngon', n: 5, r: 16, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 14 },
      two: [
        { x: -16, y: 0 },
        { x: 16, y: 0 },
      ],
    },
    engineHook: { x: 0, y: -16 },
    engineOverflow: 0.5,
    bounds: { r: 16 },
  },

  'eighth-moon': {
    id: 'eighth-moon',
    shapes: [{ kind: 'ngon', n: 6, r: 14, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 12 },
      two: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
      ],
    },
    engineHook: { x: 0, y: -14 },
    engineOverflow: 0.5,
    bounds: { r: 14 },
  },

  trapeze: {
    id: 'trapeze',
    shapes: [{ kind: 'ngon', n: 8, r: 16, fill: PLACEHOLDER }] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 14 },
      two: [
        { x: -12, y: 2 },
        { x: 12, y: 2 },
      ],
    },
    engineHook: { x: 0, y: -16 },
    engineOverflow: 0.5,
    bounds: { r: 16 },
  },

  'two-triangles': {
    id: 'two-triangles',
    shapes: [
      { kind: 'star', points: 5, rOuter: 16, rInner: 7, fill: PLACEHOLDER },
    ] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 10 },
      two: [
        { x: -8, y: 4 },
        { x: 8, y: 4 },
      ],
    },
    engineHook: { x: 0, y: -14 },
    engineOverflow: 0.5,
    bounds: { r: 16 },
  },

  donut: {
    id: 'donut',
    shapes: [
      { kind: 'star', points: 6, rOuter: 50, rInner: 20, fill: PLACEHOLDER },
    ] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 30 },
      two: [
        { x: -30, y: -18 },
        { x: 30, y: -18 },
      ],
    },
    engineHook: { x: 0, y: -38 },
    engineOverflow: 0.5,
    bounds: { r: 50 },
  },

  'half-donut': {
    id: 'half-donut',
    shapes: [
      { kind: 'star', points: 8, rOuter: 54, rInner: 22, fill: PLACEHOLDER },
    ] as readonly ShapeSpec[],
    weaponHooks: {
      one: { x: 0, y: 36 },
      two: [
        { x: -44, y: -16 },
        { x: 44, y: -16 },
      ],
    },
    engineHook: { x: 0, y: -44 },
    engineOverflow: 0.5,
    bounds: { r: 54 },
  },
};

export const HULL_PRESETS: Readonly<Record<HullPresetId, HullPreset>> = Object.freeze(presets);
