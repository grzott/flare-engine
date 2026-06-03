import { describe, expect, test } from 'bun:test';
import { THEME_SPEC } from '../src/visual-spec/theme';
import type { ZoneBgDef, ZoneBgKindId } from '../src/visual-spec/types';
import { ZONE_BG_DEFS } from '../src/visual-spec/zone-bg';

const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const VALID_KINDS: readonly ZoneBgKindId[] = [
  'roofs-city',
  'forest-canopy',
  'river-wave',
  'moon-crater',
  'cave-interior',
  'mountain-hills',
  'image',
];

describe('ZONE_BG_DEFS — completeness', () => {
  test('all 8 zone IDs are present', () => {
    for (const id of ZONE_IDS) {
      expect(ZONE_BG_DEFS[id]).toBeDefined();
      expect(ZONE_BG_DEFS[id].zoneId).toBe(id);
    }
  });

  test('no duplicate zoneId values across entries', () => {
    const zoneIds = ZONE_IDS.map((id) => ZONE_BG_DEFS[id].zoneId);
    expect(new Set(zoneIds).size).toBe(8);
  });

  test('key set is exactly {1,2,3,4,5,6,7,8}', () => {
    const keys = Object.keys(ZONE_BG_DEFS)
      .map(Number)
      .sort((a, b) => a - b);
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('ZONE_BG_DEFS — kind exhaustiveness', () => {
  test("at least one entry uses 'roofs-city'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'roofs-city')).toBe(true);
  });

  test("at least one entry uses 'forest-canopy'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'forest-canopy')).toBe(true);
  });

  test("at least one entry uses 'river-wave'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'river-wave')).toBe(true);
  });

  test("at least one entry uses 'moon-crater'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'moon-crater')).toBe(true);
  });

  test("at least one entry uses 'cave-interior'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'cave-interior')).toBe(true);
  });

  test("at least one entry uses 'mountain-hills'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'mountain-hills')).toBe(true);
  });

  test("at least one entry uses 'image'", () => {
    expect(ZONE_IDS.some((id) => ZONE_BG_DEFS[id].kind === 'image')).toBe(true);
  });

  test('every entry kind is in the canonical 7-value list', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      if (!VALID_KINDS.includes(ZONE_BG_DEFS[id].kind)) {
        violations.push(`Z${id}.kind = ${ZONE_BG_DEFS[id].kind}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('ZONE_BG_DEFS — token resolution (shader zones only)', () => {
  test('all shader-kind primaryToken and secondaryToken values resolve in THEME_SPEC.colors', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      const def: ZoneBgDef = ZONE_BG_DEFS[id];
      if (def.kind === 'image') continue;
      const primary = THEME_SPEC.colors[def.primaryToken];
      const secondary = THEME_SPEC.colors[def.secondaryToken];
      if (typeof primary !== 'string' || primary.length === 0) {
        violations.push(`Z${id}.primaryToken '${def.primaryToken}' not resolved`);
      }
      if (typeof secondary !== 'string' || secondary.length === 0) {
        violations.push(`Z${id}.secondaryToken '${def.secondaryToken}' not resolved`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('ZONE_BG_DEFS — field ranges', () => {
  test('all entries have scrollSpeed > 0', () => {
    const violations = ZONE_IDS.filter((id) => ZONE_BG_DEFS[id].scrollSpeed <= 0);
    expect(violations).toEqual([]);
  });

  test('all shader-kind entries have density > 0', () => {
    const violations: number[] = [];
    for (const id of ZONE_IDS) {
      const def: ZoneBgDef = ZONE_BG_DEFS[id];
      if (def.kind === 'image') continue;
      if (def.density <= 0) violations.push(id);
    }
    expect(violations).toEqual([]);
  });
});

describe('ZONE_BG_DEFS — per-zone exact-value pins', () => {
  test('Z1 Dachy Krakowa — image kind, scrollSpeed 18, no shader tokens', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[1];
    expect(def.kind).toBe('image');
    expect(def.scrollSpeed).toBe(18);
    expect('primaryToken' in def).toBe(false);
    expect('secondaryToken' in def).toBe(false);
    expect('density' in def).toBe(false);
  });

  test('Z2 Puszcza Mazowiecka', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[2];
    expect(def.kind).toBe('forest-canopy');
    if (def.kind === 'forest-canopy') {
      expect(def.primaryToken).toBe('moss');
      expect(def.secondaryToken).toBe('leafGreen');
      expect(def.density).toBe(6);
    }
    expect(def.scrollSpeed).toBe(12);
  });

  test('Z3 Wisła', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[3];
    expect(def.kind).toBe('river-wave');
    if (def.kind === 'river-wave') {
      expect(def.primaryToken).toBe('vistulaBlue');
      expect(def.secondaryToken).toBe('foamBlue');
      expect(def.density).toBe(2.5);
    }
    expect(def.scrollSpeed).toBe(22);
  });

  test('Z4 Łęczyckie Błota', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[4];
    expect(def.kind).toBe('forest-canopy');
    if (def.kind === 'forest-canopy') {
      expect(def.primaryToken).toBe('bogGreen');
      expect(def.secondaryToken).toBe('waterTeal');
      expect(def.density).toBe(4);
    }
    expect(def.scrollSpeed).toBe(10);
  });

  test('Z5 Łysa Góra', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[5];
    expect(def.kind).toBe('mountain-hills');
    if (def.kind === 'mountain-hills') {
      expect(def.primaryToken).toBe('crimsonDeep');
      expect(def.secondaryToken).toBe('inkBlack');
      expect(def.density).toBe(1.8);
    }
    expect(def.scrollSpeed).toBe(16);
  });

  test('Z6 Katakumby Warszawskie', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[6];
    expect(def.kind).toBe('cave-interior');
    if (def.kind === 'cave-interior') {
      expect(def.primaryToken).toBe('katakumbyDark');
      expect(def.secondaryToken).toBe('goldDeep');
      expect(def.density).toBe(10);
    }
    expect(def.scrollSpeed).toBe(8);
  });

  test('Z7 Karczma "Rzym"', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[7];
    expect(def.kind).toBe('roofs-city');
    if (def.kind === 'roofs-city') {
      expect(def.primaryToken).toBe('rust');
      expect(def.secondaryToken).toBe('pitchBrown');
      expect(def.density).toBe(5);
    }
    expect(def.scrollSpeed).toBe(15);
  });

  test('Z8 Księżyc', () => {
    const def: ZoneBgDef = ZONE_BG_DEFS[8];
    expect(def.kind).toBe('moon-crater');
    if (def.kind === 'moon-crater') {
      expect(def.primaryToken).toBe('bone');
      expect(def.secondaryToken).toBe('lunarInk');
      expect(def.density).toBe(5);
    }
    expect(def.scrollSpeed).toBe(6);
  });
});
