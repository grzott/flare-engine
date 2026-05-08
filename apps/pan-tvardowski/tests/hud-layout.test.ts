import { describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

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

  test('minibossBar top is hudCornerY + xxl token', () => {
    expect(rawStyles.minibossBar.top).toBe(spacing.hudCornerY + spacing.xxl);
  });

  test('minibossBar left/right use hudCornerX token', () => {
    expect(rawStyles.minibossBar.left).toBe(spacing.hudCornerX);
    expect(rawStyles.minibossBar.right).toBe(spacing.hudCornerX);
  });
});
