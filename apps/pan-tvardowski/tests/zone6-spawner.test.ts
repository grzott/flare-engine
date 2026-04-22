import { describe, expect, test } from 'bun:test';
import { ZONE6_BOSS_T, ZONE6_MINIBOSS_T } from '../src/config/gameplay';
import { buildZone6Schedule } from '../src/systems/spawner';

describe('spawner / zone 6 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone6Schedule(0xcafe_babe);
    const b = buildZone6Schedule(0xcafe_babe);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only wapierz / poludnica spawn, monotonic times', () => {
    const s = buildZone6Schedule(7);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'wapierz' || wave.pattern === 'poludnica').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('respects miniboss + boss gates', () => {
    const s = buildZone6Schedule(19);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE6_BOSS_T);
    // There must be a quiet window around the miniboss gate.
    for (const wave of s) {
      const duringMiniboss = wave.t > ZONE6_MINIBOSS_T - 10 && wave.t < ZONE6_MINIBOSS_T + 20;
      expect(duringMiniboss).toBe(false);
    }
  });

  test('includes both patterns over many seeds', () => {
    const seen = new Set<string>();
    for (const seed of [1, 42, 1337, 99999]) {
      for (const wave of buildZone6Schedule(seed)) seen.add(wave.pattern);
    }
    expect(seen.has('wapierz')).toBe(true);
    expect(seen.has('poludnica')).toBe(true);
  });
});
