import { describe, expect, test } from 'bun:test';
import { ZONE4_BOSS_T } from '../src/config/gameplay';
import { buildZone4Schedule } from '../src/systems/spawner';

describe('spawner / zone 4 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone4Schedule(0xdead_beef);
    const b = buildZone4Schedule(0xdead_beef);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('only mamuna / licho spawn, monotonic times', () => {
    const s = buildZone4Schedule(13);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'mamuna' || wave.pattern === 'licho').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });

  test('terminates before zone-4 boss gate', () => {
    const s = buildZone4Schedule(17);
    const last = s[s.length - 1]!;
    expect(last.t).toBeLessThan(ZONE4_BOSS_T);
  });
});
