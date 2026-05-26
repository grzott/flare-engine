import { describe, expect, test } from 'bun:test';
import type { ZoneFxKindId } from '../src/visual-spec/types';
import { ZONE_FX_DEFS } from '../src/visual-spec/zone-fx';

const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const VALID_KINDS: readonly ZoneFxKindId[] = ['rain', 'sun-shaft', 'dark-vignette', 'clouds'];

describe('ZONE_FX_DEFS — completeness', () => {
  test('all 8 zone IDs are present', () => {
    for (const id of ZONE_IDS) {
      expect(ZONE_FX_DEFS[id]).toBeDefined();
      expect(ZONE_FX_DEFS[id].zoneId).toBe(id);
    }
  });

  test('no duplicate zoneId values across entries', () => {
    const zoneIds = ZONE_IDS.map((id) => ZONE_FX_DEFS[id].zoneId);
    expect(new Set(zoneIds).size).toBe(8);
  });

  test('key set is exactly {1,2,3,4,5,6,7,8}', () => {
    const keys = Object.keys(ZONE_FX_DEFS)
      .map(Number)
      .sort((a, b) => a - b);
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('ZONE_FX_DEFS — kind exhaustiveness', () => {
  test("at least one entry uses 'rain'", () => {
    expect(ZONE_IDS.some((id) => ZONE_FX_DEFS[id].kind === 'rain')).toBe(true);
  });

  test("at least one entry uses 'sun-shaft'", () => {
    expect(ZONE_IDS.some((id) => ZONE_FX_DEFS[id].kind === 'sun-shaft')).toBe(true);
  });

  test("at least one entry uses 'dark-vignette'", () => {
    expect(ZONE_IDS.some((id) => ZONE_FX_DEFS[id].kind === 'dark-vignette')).toBe(true);
  });

  test("at least one entry uses 'clouds'", () => {
    expect(ZONE_IDS.some((id) => ZONE_FX_DEFS[id].kind === 'clouds')).toBe(true);
  });

  test('every entry kind is in the canonical 4-value list', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      if (!VALID_KINDS.includes(ZONE_FX_DEFS[id].kind)) {
        violations.push(`Z${id}.kind = ${ZONE_FX_DEFS[id].kind}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('ZONE_FX_DEFS — field ranges', () => {
  test('intensity is in [0, 1] for all entries', () => {
    const violations = ZONE_IDS.filter((id) => {
      const v = ZONE_FX_DEFS[id].intensity;
      return v < 0 || v > 1;
    });
    expect(violations).toEqual([]);
  });

  test('direction is in [0, 360) for all entries', () => {
    const violations = ZONE_IDS.filter((id) => {
      const v = ZONE_FX_DEFS[id].direction;
      return v < 0 || v >= 360;
    });
    expect(violations).toEqual([]);
  });

  test('speed >= 0 for all entries', () => {
    const violations = ZONE_IDS.filter((id) => ZONE_FX_DEFS[id].speed < 0);
    expect(violations).toEqual([]);
  });
});

describe('ZONE_FX_DEFS — per-zone exact-value pins', () => {
  test('Z1 rain', () => {
    expect(ZONE_FX_DEFS[1].kind).toBe('rain');
    expect(ZONE_FX_DEFS[1].intensity).toBe(0.55);
    expect(ZONE_FX_DEFS[1].direction).toBe(15);
    expect(ZONE_FX_DEFS[1].speed).toBe(180);
  });

  test('Z2 sun-shaft', () => {
    expect(ZONE_FX_DEFS[2].kind).toBe('sun-shaft');
    expect(ZONE_FX_DEFS[2].intensity).toBe(0.45);
    expect(ZONE_FX_DEFS[2].direction).toBe(0);
    expect(ZONE_FX_DEFS[2].speed).toBe(0);
  });

  test('Z3 rain', () => {
    expect(ZONE_FX_DEFS[3].kind).toBe('rain');
    expect(ZONE_FX_DEFS[3].intensity).toBe(0.7);
    expect(ZONE_FX_DEFS[3].direction).toBe(5);
    expect(ZONE_FX_DEFS[3].speed).toBe(220);
  });

  test('Z4 dark-vignette', () => {
    expect(ZONE_FX_DEFS[4].kind).toBe('dark-vignette');
    expect(ZONE_FX_DEFS[4].intensity).toBe(0.5);
    expect(ZONE_FX_DEFS[4].direction).toBe(0);
    expect(ZONE_FX_DEFS[4].speed).toBe(0);
  });

  test('Z5 dark-vignette', () => {
    expect(ZONE_FX_DEFS[5].kind).toBe('dark-vignette');
    expect(ZONE_FX_DEFS[5].intensity).toBe(0.75);
    expect(ZONE_FX_DEFS[5].direction).toBe(0);
    expect(ZONE_FX_DEFS[5].speed).toBe(0);
  });

  test('Z6 dark-vignette', () => {
    expect(ZONE_FX_DEFS[6].kind).toBe('dark-vignette');
    expect(ZONE_FX_DEFS[6].intensity).toBe(0.65);
    expect(ZONE_FX_DEFS[6].direction).toBe(0);
    expect(ZONE_FX_DEFS[6].speed).toBe(0);
  });

  test('Z7 clouds', () => {
    expect(ZONE_FX_DEFS[7].kind).toBe('clouds');
    expect(ZONE_FX_DEFS[7].intensity).toBe(0.4);
    expect(ZONE_FX_DEFS[7].direction).toBe(10);
    expect(ZONE_FX_DEFS[7].speed).toBe(60);
  });

  test('Z8 clouds', () => {
    expect(ZONE_FX_DEFS[8].kind).toBe('clouds');
    expect(ZONE_FX_DEFS[8].intensity).toBe(0.6);
    expect(ZONE_FX_DEFS[8].direction).toBe(0);
    expect(ZONE_FX_DEFS[8].speed).toBe(40);
  });
});
