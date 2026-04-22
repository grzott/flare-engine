import { describe, expect, test } from 'bun:test';
import { buildZone1Schedule } from '../src/systems/spawner';

describe('spawner / zone 1 schedule', () => {
  test('deterministic for a given seed', () => {
    const a = buildZone1Schedule(0x1234);
    const b = buildZone1Schedule(0x1234);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  test('different seeds diverge', () => {
    const a = buildZone1Schedule(1);
    const b = buildZone1Schedule(2);
    // Overwhelmingly likely at least one wave differs.
    let differs = false;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i]!.t !== b[i]!.t || a[i]!.pattern !== b[i]!.pattern) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  test('only zone-1 enemy patterns spawn, monotonic times, bounded counts', () => {
    const s = buildZone1Schedule(42);
    expect(s.length).toBeGreaterThan(0);
    let prev = -1;
    for (const wave of s) {
      expect(wave.pattern === 'skrzat' || wave.pattern === 'latawiec').toBe(true);
      expect(wave.count).toBeGreaterThan(0);
      expect(wave.count).toBeLessThanOrEqual(6);
      expect(wave.t).toBeGreaterThan(prev);
      prev = wave.t;
    }
  });
});
