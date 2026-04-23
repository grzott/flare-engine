import { describe, expect, test } from 'bun:test';
import { ZONE8_BOSS_T } from '../src/config/gameplay';
import { buildZone8Schedule } from '../src/systems/spawner';

const ALLOWED = ['moon-wraith', 'nocnica'] as const;

describe('spawner / zone 8 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone8Schedule(0xc0ffee);
    const b = buildZone8Schedule(0xc0ffee);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only allowed patterns spawn, monotonic times, terminate before boss', () => {
    const s = buildZone8Schedule(8);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(ALLOWED as readonly string[]).toContain(wave.pattern);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      expect(wave.t).toBeLessThan(ZONE8_BOSS_T);
      prev = wave.t;
    }
  });

  test('different seeds produce distinct schedules', () => {
    const a = buildZone8Schedule(1);
    const b = buildZone8Schedule(2);
    let equal = a.length === b.length;
    if (equal) {
      for (let i = 0; i < a.length; i++) {
        if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
          equal = false;
          break;
        }
      }
    }
    expect(equal).toBe(false);
  });
});
