import { describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';
import { colors, spacing } from '../src/theme';

describe('HUD layout', () => {
  test('boss bar has gold border', () => {
    expect(rawStyles.bossBarBg.borderWidth).toBe(1);
    expect(rawStyles.bossBarBg.borderColor).toBe(colors.ui.gold);
  });

  test('hud corner spacing matches deck', () => {
    expect(spacing.hudCornerX).toBe(16);
    expect(spacing.hudCornerY).toBe(32);
  });

  test('weapon meter height matches spec', () => {
    expect(spacing.weaponMeterHeight).toBe(6);
  });

  test('weapon segment style exists', () => {
    expect(rawStyles.weaponSegment).toBeDefined();
    expect(rawStyles.weaponSegment.height).toBe(spacing.weaponMeterHeight);
  });

  test('combo style uses crimson color', () => {
    expect(rawStyles.combo.color).toBe(colors.ui.crimson);
  });
});
