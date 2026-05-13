import { describe, expect, test } from 'bun:test';
import { PARTICLE_DEFS } from '../src/visual-spec/particles';

describe('atlas-particle-wire', () => {
  test('PARTICLE_DEFS has exactly 2 frames', () => {
    expect(PARTICLE_DEFS.length).toBe(2);
  });

  test('particle ids are unique', () => {
    const ids = PARTICLE_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(PARTICLE_DEFS.length);
  });

  test('frame names match String(def.id)', () => {
    for (const def of PARTICLE_DEFS) {
      expect(String(def.id)).toBe(def.id);
    }
    expect(PARTICLE_DEFS.map((d) => String(d.id))).toEqual(['particle-spark', 'particle-smoke']);
  });
});
