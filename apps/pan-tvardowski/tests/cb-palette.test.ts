import { describe, expect, test } from 'bun:test';
import { defaultSettings } from '../src/state';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('color-blind palette', () => {
  test('cb colors are defined on ui', () => {
    expect(UI_COLORS.cb).toBeDefined();
    expect(UI_COLORS.cb.player).toBe('#FF8C42');
    expect(UI_COLORS.cb.hazard).toBe('#FFD23F');
    expect(UI_COLORS.cb.safe).toBe('#4FC3F7');
  });

  test('cb.player, cb.hazard, cb.safe are valid hex strings', () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    expect(hexRe.test(UI_COLORS.cb.player)).toBe(true);
    expect(hexRe.test(UI_COLORS.cb.hazard)).toBe(true);
    expect(hexRe.test(UI_COLORS.cb.safe)).toBe(true);
  });

  test('colorBlindMode defaults to false in defaultSettings', () => {
    const s = defaultSettings();
    expect(s.colorBlindMode).toBe(false);
  });

  test('cb colors are distinct from standard hazard and safe', () => {
    expect(UI_COLORS.cb.hazard).not.toBe(UI_COLORS.hazard);
    expect(UI_COLORS.cb.safe).not.toBe(UI_COLORS.safe);
  });

  test('cb palette has exactly three keys: player, hazard, safe', () => {
    const keys = Object.keys(UI_COLORS.cb);
    expect(keys).toEqual(['player', 'hazard', 'safe']);
  });
});
