import { describe, expect, test } from 'bun:test';
import { ZONE7_BOSS_T } from '../src/config/gameplay';
import { buildZone7Schedule } from '../src/systems/spawner';

const PRIOR_ENEMIES = [
  'skrzat',
  'latawiec',
  'czart',
  'bies',
  'licho',
  'strzyga',
  'topielec',
  'mamuna',
  'nocnica',
  'poludnica',
  'wapierz',
  'dziwozona',
] as const;

describe('spawner / zone 7 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone7Schedule(0xdead_beef);
    const b = buildZone7Schedule(0xdead_beef);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only prior-zone enemy patterns spawn, monotonic times', () => {
    const s = buildZone7Schedule(7);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(PRIOR_ENEMIES as readonly string[]).toContain(wave.pattern);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('respects miniboss + boss gates', () => {
    const s = buildZone7Schedule(19);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE7_BOSS_T);
    // Quiet window around the Madej miniboss gate (95 s → 120 s per spawner).
    for (const wave of s) {
      const duringMiniboss = wave.t > 95 && wave.t < 120;
      expect(duringMiniboss).toBe(false);
    }
  });

  test('mixes multiple prior-zone patterns across seeds', () => {
    const seen = new Set<string>();
    for (const seed of [1, 42, 1337, 99999, 0xabc]) {
      for (const wave of buildZone7Schedule(seed)) seen.add(wave.pattern);
    }
    // At least 6 of the 12 prior-zone enemies must appear across the sampled
    // seeds — proves the gauntlet actually shuffles the pool, not just one
    // or two patterns.
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
});
