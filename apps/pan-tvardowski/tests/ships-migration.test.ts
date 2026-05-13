import { describe, expect, it } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { SHIP_DEFS } from '../src/visual-spec/ships';

describe('SHIP_DEFS migration', () => {
  it('SHIP_DEFS contains exactly 29 entries', () => {
    expect(SHIP_DEFS.length).toBe(29);
  });

  it('every ShipDef.id is a non-empty string', () => {
    for (const def of SHIP_DEFS) {
      expect(def.id.length).toBeGreaterThan(0);
    }
  });

  it('every ShipDef.hullPreset resolves in HULL_PRESETS', () => {
    for (const def of SHIP_DEFS) {
      expect(HULL_PRESETS[def.hullPreset]).toBeDefined();
    }
  });

  it('all ShipDef.ids are unique', () => {
    const ids = SHIP_DEFS.map((d) => d.id as string);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
