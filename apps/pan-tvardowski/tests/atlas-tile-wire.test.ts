import { describe, expect, test } from 'bun:test';
import { TILE_DEFS } from '../src/visual-spec';

describe('atlas-tile-wire', () => {
  test('TILE_DEFS has exactly 3 entries', () => {
    expect(TILE_DEFS.length).toBe(3);
  });

  test('all tile ids are unique', () => {
    const ids = TILE_DEFS.map((d) => String(d.id));
    expect(new Set(ids).size).toBe(TILE_DEFS.length);
  });

  test('frame names match String(def.id)', () => {
    const expected = ['tile-fire', 'tile-water', 'tile-fog'];
    const actual = TILE_DEFS.map((d) => String(d.id));
    expect(actual).toEqual(expected);
  });

  test('all tile sizes are 32×32', () => {
    for (const def of TILE_DEFS) {
      expect(def.size, `${def.id} size`).toBe(32);
    }
  });
});
