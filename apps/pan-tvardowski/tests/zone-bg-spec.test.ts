import { describe, expect, test } from 'bun:test';
import { THEME_SPEC } from '../src/visual-spec/theme';
import type { ZoneBgKindId } from '../src/visual-spec/types';
import { ZONE_BG_DEFS } from '../src/visual-spec/zone-bg';

const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const VALID_KINDS: readonly ZoneBgKindId[] = [
  'roofs-city',
  'forest-canopy',
  'river-wave',
  'moon-crater',
  'cave-interior',
  'mountain-hills',
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

  test('every entry kind is in the canonical 6-value list', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      if (!VALID_KINDS.includes(ZONE_BG_DEFS[id].kind)) {
        violations.push(`Z${id}.kind = ${ZONE_BG_DEFS[id].kind}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('ZONE_BG_DEFS — token resolution', () => {
  test('all primaryToken and secondaryToken values resolve in THEME_SPEC.colors', () => {
    const violations: string[] = [];
    for (const id of ZONE_IDS) {
      const def = ZONE_BG_DEFS[id];
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

  test('all entries have density > 0', () => {
    const violations = ZONE_IDS.filter((id) => ZONE_BG_DEFS[id].density <= 0);
    expect(violations).toEqual([]);
  });
});

describe('ZONE_BG_DEFS — per-zone exact-value pins', () => {
  test('Z1 Dachy Krakowa', () => {
    expect(ZONE_BG_DEFS[1].kind).toBe('roofs-city');
    expect(ZONE_BG_DEFS[1].primaryToken).toBe('terracotta');
    expect(ZONE_BG_DEFS[1].secondaryToken).toBe('rust');
    expect(ZONE_BG_DEFS[1].scrollSpeed).toBe(18);
    expect(ZONE_BG_DEFS[1].density).toBe(7);
  });

  test('Z2 Puszcza Mazowiecka', () => {
    expect(ZONE_BG_DEFS[2].kind).toBe('forest-canopy');
    expect(ZONE_BG_DEFS[2].primaryToken).toBe('moss');
    expect(ZONE_BG_DEFS[2].secondaryToken).toBe('leafGreen');
    expect(ZONE_BG_DEFS[2].scrollSpeed).toBe(12);
    expect(ZONE_BG_DEFS[2].density).toBe(6);
  });

  test('Z3 Wisła', () => {
    expect(ZONE_BG_DEFS[3].kind).toBe('river-wave');
    expect(ZONE_BG_DEFS[3].primaryToken).toBe('vistulaBlue');
    expect(ZONE_BG_DEFS[3].secondaryToken).toBe('foamBlue');
    expect(ZONE_BG_DEFS[3].scrollSpeed).toBe(22);
    expect(ZONE_BG_DEFS[3].density).toBe(2.5);
  });

  test('Z4 Łęczyckie Błota', () => {
    expect(ZONE_BG_DEFS[4].kind).toBe('forest-canopy');
    expect(ZONE_BG_DEFS[4].primaryToken).toBe('bogGreen');
    expect(ZONE_BG_DEFS[4].secondaryToken).toBe('waterTeal');
    expect(ZONE_BG_DEFS[4].scrollSpeed).toBe(10);
    expect(ZONE_BG_DEFS[4].density).toBe(4);
  });

  test('Z5 Łysa Góra', () => {
    expect(ZONE_BG_DEFS[5].kind).toBe('mountain-hills');
    expect(ZONE_BG_DEFS[5].primaryToken).toBe('crimsonDeep');
    expect(ZONE_BG_DEFS[5].secondaryToken).toBe('inkBlack');
    expect(ZONE_BG_DEFS[5].scrollSpeed).toBe(16);
    expect(ZONE_BG_DEFS[5].density).toBe(1.8);
  });

  test('Z6 Katakumby Warszawskie', () => {
    expect(ZONE_BG_DEFS[6].kind).toBe('cave-interior');
    expect(ZONE_BG_DEFS[6].primaryToken).toBe('katakumbyDark');
    expect(ZONE_BG_DEFS[6].secondaryToken).toBe('goldDeep');
    expect(ZONE_BG_DEFS[6].scrollSpeed).toBe(8);
    expect(ZONE_BG_DEFS[6].density).toBe(10);
  });

  test('Z7 Karczma "Rzym"', () => {
    expect(ZONE_BG_DEFS[7].kind).toBe('roofs-city');
    expect(ZONE_BG_DEFS[7].primaryToken).toBe('rust');
    expect(ZONE_BG_DEFS[7].secondaryToken).toBe('pitchBrown');
    expect(ZONE_BG_DEFS[7].scrollSpeed).toBe(15);
    expect(ZONE_BG_DEFS[7].density).toBe(5);
  });

  test('Z8 Księżyc', () => {
    expect(ZONE_BG_DEFS[8].kind).toBe('moon-crater');
    expect(ZONE_BG_DEFS[8].primaryToken).toBe('bone');
    expect(ZONE_BG_DEFS[8].secondaryToken).toBe('lunarInk');
    expect(ZONE_BG_DEFS[8].scrollSpeed).toBe(6);
    expect(ZONE_BG_DEFS[8].density).toBe(5);
  });
});
