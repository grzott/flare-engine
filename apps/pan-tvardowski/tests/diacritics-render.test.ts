import { describe, expect, test } from 'bun:test';
import pl from '../locales/pl.json' with { type: 'json' };

const DIACRITIC_RE = /[łćśżźńóęąŁĆŚŻŹŃÓĘĄ]/;

describe('PL diacritics render harness', () => {
  test('every PL string value that should contain a diacritic is non-empty', () => {
    const entries = Object.entries(pl as Record<string, string>).filter(([, v]) =>
      DIACRITIC_RE.test(v),
    );
    for (const [key, value] of entries) {
      expect(value.length, `key "${key}" is empty`).toBeGreaterThan(0);
    }
    expect(entries.length).toBeGreaterThan(0);
  });

  test('zones.4.name spot-check: Łęczyckie Błota', () => {
    expect((pl as Record<string, string>)['zones.4.name']).toBe('Łęczyckie Błota');
  });

  test('enemies.poludnica.name spot-check: Południca', () => {
    expect((pl as Record<string, string>)['enemies.poludnica.name']).toBe('Południca');
  });

  test('menu.settings.color_blind_mode PL value contains at least one Polish diacritic', () => {
    const value = (pl as Record<string, string | undefined>)['menu.settings.color_blind_mode'];
    expect(value).toBeDefined();
    expect(DIACRITIC_RE.test(value ?? '')).toBe(true);
  });
});
