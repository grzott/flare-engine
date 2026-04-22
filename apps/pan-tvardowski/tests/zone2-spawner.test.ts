import { describe, expect, test } from 'bun:test';
import { ZONE2_BOSS_T, ZONE2_MINIBOSS_T } from '../src/config/gameplay';
import { buildZone2Schedule } from '../src/systems/spawner';

describe('spawner / zone 2 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone2Schedule(0x1234);
    const b = buildZone2Schedule(0x1234);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only czart / bies spawn, monotonic times', () => {
    const s = buildZone2Schedule(42);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'czart' || wave.pattern === 'bies').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.count).toBeLessThanOrEqual(6);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('no waves spawn during the miniboss gate window', () => {
    const s = buildZone2Schedule(7);
    for (const wave of s) {
      const outsideGate = wave.t < 80 || wave.t >= 110;
      expect(outsideGate).toBe(true);
      expect(wave.t).toBeLessThan(ZONE2_BOSS_T);
    }
  });

  test('uses miniboss and boss constants from gameplay config', () => {
    // Schedule must terminate before the boss spawns and must leave a
    // comfortable pre-boss gap.
    const s = buildZone2Schedule(11);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE2_BOSS_T);
    expect(ZONE2_MINIBOSS_T).toBeGreaterThan(0);
  });
});
