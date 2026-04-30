import { describe, expect, test } from 'bun:test';
import { defaultSettings } from '../src/state';
import { colors } from '../src/theme/colors';

describe('color-blind palette', () => {
  test('cb colors are defined on ui', () => {
    expect(colors.ui.cb).toBeDefined();
    expect(colors.ui.cb.player).toBe('#FF8C42');
    expect(colors.ui.cb.hazard).toBe('#FFD23F');
    expect(colors.ui.cb.safe).toBe('#4FC3F7');
  });

  test('cb.player, cb.hazard, cb.safe are valid hex strings', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    expect(hexRe.test(colors.ui.cb.player)).toBe(true);
    expect(hexRe.test(colors.ui.cb.hazard)).toBe(true);
    expect(hexRe.test(colors.ui.cb.safe)).toBe(true);
  });

  test('colorBlindMode defaults to false in defaultSettings', () => {
    const s = defaultSettings();
    expect(s.colorBlindMode).toBe(false);
  });

  test('cb colors are distinct from standard hazard and safe', () => {
    expect(colors.ui.cb.hazard).not.toBe(colors.ui.hazard);
    expect(colors.ui.cb.safe).not.toBe(colors.ui.safe);
  });

  test('cb palette has exactly three keys: player, hazard, safe', () => {
    const keys = Object.keys(colors.ui.cb);
    expect(keys).toEqual(['player', 'hazard', 'safe']);
  });
});
