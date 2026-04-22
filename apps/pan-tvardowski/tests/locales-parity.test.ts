import { describe, expect, test } from 'bun:test';
import en from '../locales/en.json' with { type: 'json' };
import pl from '../locales/pl.json' with { type: 'json' };
import { LOCALIZATION_KEYS } from '../src/localization/keys';

describe('locale parity', () => {
  const enKeys = Object.keys(en).sort();
  const plKeys = Object.keys(pl).sort();
  const expected = [...LOCALIZATION_KEYS].sort();

  test('en and pl have identical key sets', () => {
    expect(enKeys).toEqual(plKeys);
  });

  test('both tables match the canonical key list', () => {
    expect(enKeys).toEqual(expected);
    expect(plKeys).toEqual(expected);
  });

  test('no empty values', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `en[${k}]`).toBe('string');
      expect((v as string).length, `en[${k}]`).toBeGreaterThan(0);
    }
    for (const [k, v] of Object.entries(pl)) {
      expect(typeof v, `pl[${k}]`).toBe('string');
      expect((v as string).length, `pl[${k}]`).toBeGreaterThan(0);
    }
  });
});
