import { describe, expect, it } from 'bun:test';
import { isZone, parsePrivacy, parseSlot, parseZoneStats } from '../src/save/migrate';

describe('parseZoneStats', () => {
  it('returns {} for null input', () => {
    expect(parseZoneStats(null)).toEqual({});
  });

  it('skips entry missing noHit field', () => {
    // deaths and bestTimeMs present but noHit absent — guard !isBool(e.noHit) fires
    const result = parseZoneStats({ z1: { deaths: 1, bestTimeMs: 1000 } });
    expect(result).toEqual({});
  });

  it('preserves bestTimeMs: null when explicitly null', () => {
    const result = parseZoneStats({ z1: { deaths: 1, bestTimeMs: null, noHit: true } });
    expect(result).toEqual({ z1: { deaths: 1, bestTimeMs: null, noHit: true } });
  });
});

describe('parseSlot', () => {
  it('returns null for null input', () => {
    expect(parseSlot(null)).toBeNull();
  });

  it('returns null when bestScore is NaN (non-finite guard)', () => {
    const result = parseSlot({
      index: 0,
      runs: 0,
      bestScore: Number.NaN,
      lastScore: 0,
      bossDefeated: false,
      savedAt: 0,
    });
    expect(result).toBeNull();
  });
});

describe('isZone', () => {
  it('returns false for z9 (outside ZONE_IDS range)', () => {
    expect(isZone('z9')).toBe(false);
  });
});

describe('parsePrivacy', () => {
  it('returns all-false defaults for array input', () => {
    expect(parsePrivacy([])).toEqual({ analyticsOptIn: false, crashOptIn: false });
  });
});
