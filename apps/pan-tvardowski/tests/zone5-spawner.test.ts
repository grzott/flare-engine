import { describe, expect, test } from 'bun:test';
import { ZONE5_BOSS_T } from '../src/config/gameplay';
import { buildZone5Schedule } from '../src/systems/spawner';

describe('spawner / zone 5 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone5Schedule(0xdead_beef);
    const b = buildZone5Schedule(0xdead_beef);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only nocnica / dziwozona spawn, monotonic times', () => {
    const s = buildZone5Schedule(13);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'nocnica' || wave.pattern === 'dziwozona').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('terminates before zone-5 boss gate', () => {
    const s = buildZone5Schedule(17);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE5_BOSS_T);
  });

  test('includes both patterns over many seeds', () => {
    // Across several seeds the mix should surface both patterns — not a strict
    // per-seed guarantee, but a sanity check against a broken 100/0 split.
    const seen = new Set<string>();
    for (const seed of [1, 42, 1337, 99999]) {
      for (const wave of buildZone5Schedule(seed)) seen.add(wave.pattern);
    }
    expect(seen.has('nocnica')).toBe(true);
    expect(seen.has('dziwozona')).toBe(true);
  });
});
