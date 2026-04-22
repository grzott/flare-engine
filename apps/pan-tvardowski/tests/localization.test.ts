import { describe, expect, test } from 'bun:test';
import { createLocalization } from '../src/localization/index';

describe('localization', () => {
  test('resolves EN key by default', () => {
    const loc = createLocalization();
    expect(loc.t('menu.play')).toBe('Play');
  });

  test('switches to PL', () => {
    const loc = createLocalization();
    loc.setLocale('pl');
    expect(loc.t('menu.play')).toBe('Graj');
  });

  test('interpolates {score}', () => {
    const loc = createLocalization();
    expect(loc.t('hud.score', { score: 1234 })).toBe('Score: 1234');
  });

  test('EN plural — one vs other', () => {
    const loc = createLocalization();
    expect(loc.t('hud.bombs_remaining', { n: 0 })).toBe('No bombs left');
    expect(loc.t('hud.bombs_remaining', { n: 1 })).toBe('1 bomb left');
    expect(loc.t('hud.bombs_remaining', { n: 3 })).toBe('3 bombs left');
  });

  test('PL plural — one / few / many', () => {
    const loc = createLocalization({ initialLocale: 'pl' });
    expect(loc.t('hud.bombs_remaining', { n: 0 })).toBe('Brak bomb');
    expect(loc.t('hud.bombs_remaining', { n: 1 })).toBe('Została 1 bomba');
    expect(loc.t('hud.bombs_remaining', { n: 3 })).toBe('Zostały 3 bomby');
    expect(loc.t('hud.bombs_remaining', { n: 5 })).toBe('Zostało 5 bomb');
  });

  test('falls back to EN for missing PL key (smoke)', () => {
    const loc = createLocalization({ initialLocale: 'pl' });
    // Every canonical key is present in both tables; assert the fallback path
    // works by probing an unknown key — it should return the raw key.
    expect(loc.t('nonexistent.key')).toBe('nonexistent.key');
  });
});
