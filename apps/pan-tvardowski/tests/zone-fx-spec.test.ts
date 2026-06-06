import { describe, expect, test } from 'bun:test';
import type { ZoneFxDef, ZoneFxKindId } from '../src/visual-spec/types';
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

describe('ZONE_FX_DEFS — density + streakLen fields', () => {
  test('density is in [0, 1] for all zones that supply it', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      const def: ZoneFxDef = ZONE_FX_DEFS[id];
      const v = def.density;
      if (v === undefined) continue;
      if (v < 0 || v > 1) violations.push(`Z${id}.density = ${v}`);
    }
    expect(violations).toEqual([]);
  });

  test('streakLen is in (0, 1] for all zones that supply it', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      const def: ZoneFxDef = ZONE_FX_DEFS[id];
      const v = def.streakLen;
      if (v === undefined) continue;
      if (v <= 0 || v > 1) violations.push(`Z${id}.streakLen = ${v}`);
    }
    expect(violations).toEqual([]);
  });

  test('Z1 exact pins: density=0.45, streakLen=0.12', () => {
    const def: ZoneFxDef = ZONE_FX_DEFS[1];
    expect(def.density).toBe(0.45);
    expect(def.streakLen).toBe(0.12);
  });

  test('Z3 exact pins: density=0.7, streakLen=0.2', () => {
    const def: ZoneFxDef = ZONE_FX_DEFS[3];
    expect(def.density).toBe(0.7);
    expect(def.streakLen).toBe(0.2);
  });

  test('non-rain zones have density === undefined and streakLen === undefined', () => {
    const nonRainIds = ZONE_IDS.filter((id) => ZONE_FX_DEFS[id].kind !== 'rain');
    for (const id of nonRainIds) {
      const def: ZoneFxDef = ZONE_FX_DEFS[id];
      expect(def.density, `Z${id}.density`).toBeUndefined();
      expect(def.streakLen, `Z${id}.streakLen`).toBeUndefined();
    }
  });
});

describe('ZONE_FX_DEFS — weatherColor field', () => {
  test('weatherColor components are in [0, 1] for all zones that supply it', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      const def: ZoneFxDef = ZONE_FX_DEFS[id];
      const wc = def.weatherColor;
      if (wc === undefined) continue;
      for (let ch = 0; ch < 3; ch++) {
        const v = wc[ch as 0 | 1 | 2];
        if (v < 0 || v > 1) violations.push(`Z${id}.weatherColor[${ch}] = ${v}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('Z1 weatherColor exact pin [0.80, 0.76, 0.90]', () => {
    expect(ZONE_FX_DEFS[1].weatherColor).toEqual([0.8, 0.76, 0.9]);
  });

  test('Z3 weatherColor exact pin [0.72, 0.68, 0.85]', () => {
    expect(ZONE_FX_DEFS[3].weatherColor).toEqual([0.72, 0.68, 0.85]);
  });

  test('non-rain zones have weatherColor === undefined', () => {
    const nonRainIds = ZONE_IDS.filter((id) => ZONE_FX_DEFS[id].kind !== 'rain');
    for (const id of nonRainIds) {
      const def: ZoneFxDef = ZONE_FX_DEFS[id];
      expect(def.weatherColor, `Z${id}`).toBeUndefined();
    }
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
