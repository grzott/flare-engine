import { describe, expect, test } from 'bun:test';
import { ZONE3_BOSS_T } from '../src/config/gameplay';
import { buildZone3Schedule } from '../src/systems/spawner';

describe('spawner / zone 3 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone3Schedule(0xc0ffee);
    const b = buildZone3Schedule(0xc0ffee);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only topielec / strzyga spawn, monotonic times', () => {
    const s = buildZone3Schedule(7);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'topielec' || wave.pattern === 'strzyga').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('terminates before zone-3 boss gate', () => {
    const s = buildZone3Schedule(11);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE3_BOSS_T);
  });
});
