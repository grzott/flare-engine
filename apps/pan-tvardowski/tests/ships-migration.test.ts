import { describe, expect, it } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const ENTITY_IDS = new Set<string>([
  ...Object.keys(SHAPE_CATALOGUE.enemies),
  ...Object.keys(SHAPE_CATALOGUE.minibosses),
  ...Object.keys(SHAPE_CATALOGUE.bosses),
  ...Object.keys(SHAPE_CATALOGUE.ships),
]);

describe('SHIP_DEFS migration', () => {
  it('SHIP_DEFS contains exactly 29 entries', () => {
    expect(SHIP_DEFS.length).toBe(29);
  });

  it('every ShipDef.id is in EntityId union (SHAPE_CATALOGUE key set)', () => {
    for (const def of SHIP_DEFS) {
      expect(ENTITY_IDS.has(def.id)).toBe(true);
    }
  });

  it('every ShipDef.hullPreset resolves in HULL_PRESETS', () => {
    for (const def of SHIP_DEFS) {
      expect(HULL_PRESETS[def.hullPreset]).toBeDefined();
    }
  });
});
