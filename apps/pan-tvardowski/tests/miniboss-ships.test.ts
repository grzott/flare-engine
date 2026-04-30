import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';
import type { ShipSpec } from '../src/shapes';

/**
 * Mini-boss ship anatomy — session #77 M1.
 * All 4 mini-bosses rewritten as ShipSpec, crimson hue family (folio XIIIb+).
 */

const { minibosses } = SHAPE_CATALOGUE;
const MINIBOSS_ENTRIES = Object.entries(minibosses) as [string, ShipSpec][];

// Crimson hue family constants (must match shape-catalogue.ts)
const CRIMSON = 0xffd4213d;
const CRIMSON_DARK = 0xff7a1322;
const CRIMSON_RUST = 0xff8b3a1f;
const CRIMSON_FAMILY = new Set([CRIMSON, CRIMSON_DARK, CRIMSON_RUST]);

describe('mini-boss ShipSpec structure — session #77 M1', () => {
  test('all 4 mini-bosses have kind=ship', () => {
    expect(MINIBOSS_ENTRIES).toHaveLength(4);
    for (const [name, spec] of MINIBOSS_ENTRIES) {
      expect(spec.kind, name).toBe('ship');
    }
  });

  test('each mini-boss hull and engine use the crimson hue family', () => {
    for (const [name, spec] of MINIBOSS_ENTRIES) {
      const hullFill = spec.hull.fill ?? 0;
      const engineFill = spec.engine.fill ?? 0;
      expect(
        CRIMSON_FAMILY.has(hullFill),
        `${name} hull fill 0x${hullFill.toString(16)} not in crimson family`,
      ).toBe(true);
      expect(
        CRIMSON_FAMILY.has(engineFill),
        `${name} engine fill 0x${engineFill.toString(16)} not in crimson family`,
      ).toBe(true);
    }
  });

  test('each mini-boss has 2 or 3 weapons', () => {
    for (const [name, spec] of MINIBOSS_ENTRIES) {
      expect(spec.weapons.length, `${name} weapons.length`).toBeGreaterThanOrEqual(2);
      expect(spec.weapons.length, `${name} weapons.length`).toBeLessThanOrEqual(3);
    }
  });
});
