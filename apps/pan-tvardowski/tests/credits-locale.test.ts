import { describe, expect, test } from 'bun:test';
import { CREDITS_SECTIONS } from '../src/hud/credits-sections';
import { createLocalization } from '../src/localization/index';

describe('credits locale — session #50 M1', () => {
  test('six sections defined', () => {
    expect(CREDITS_SECTIONS).toHaveLength(6);
  });

  test('all credits keys resolve non-empty in EN', () => {
    const loc = createLocalization();
    for (const section of CREDITS_SECTIONS) {
      const title = loc.t(section.titleKey);
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe(section.titleKey);
      for (const lineKey of section.lineKeys) {
        const line = loc.t(lineKey);
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toBe(lineKey);
      }
    }
  });

  test('all credits keys resolve non-empty in PL', () => {
    const loc = createLocalization({ initialLocale: 'pl' });
    for (const section of CREDITS_SECTIONS) {
      const title = loc.t(section.titleKey);
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe(section.titleKey);
      for (const lineKey of section.lineKeys) {
        const line = loc.t(lineKey);
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toBe(lineKey);
      }
    }
  });
});
