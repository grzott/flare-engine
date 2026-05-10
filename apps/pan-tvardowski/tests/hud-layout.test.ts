import { describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';
import { HUD_SPEC } from '../src/visual-spec/hud';
import { THEME_SPEC, UI_COLORS } from '../src/visual-spec/theme';

describe('HUD layout', () => {
  test('boss bar has gold border', () => {
    expect(rawStyles.bossBarBg.borderWidth).toBe(1);
    expect(rawStyles.bossBarBg.borderColor).toBe(UI_COLORS.gold);
  });

  test('hud corner spacing matches deck', () => {
    expect(THEME_SPEC.spacing.hudCornerX).toBe(16);
    expect(THEME_SPEC.spacing.hudCornerY).toBe(32);
  });

  test('weapon meter height matches spec', () => {
    expect(THEME_SPEC.spacing.weaponMeterHeight).toBe(6);
  });

  test('weapon segment style exists', () => {
    expect(rawStyles.weaponSegment).toBeDefined();
    expect(rawStyles.weaponSegment.height).toBe(THEME_SPEC.spacing.weaponMeterHeight);
  });

  test('combo style uses crimson color', () => {
    expect(rawStyles.combo.color).toBe(UI_COLORS.crimson);
  });

  test('minibossBar top is hudCornerY + xxl token', () => {
    expect(rawStyles.minibossBar.top).toBe(THEME_SPEC.spacing.hudCornerY + THEME_SPEC.spacing.xxl);
  });

  test('minibossBar left/right use hudCornerX token', () => {
    expect(rawStyles.minibossBar.left).toBe(THEME_SPEC.spacing.hudCornerX);
    expect(rawStyles.minibossBar.right).toBe(THEME_SPEC.spacing.hudCornerX);
  });

  test("HUD_SPEC slot 'score' inset matches hudCornerX/Y tokens", () => {
    const slot = HUD_SPEC.slots.find((s) => s.id === 'score');
    expect(slot?.inset?.dx).toBe(THEME_SPEC.spacing.hudCornerX);
    expect(slot?.inset?.dy).toBe(THEME_SPEC.spacing.hudCornerY);
  });

  test("HUD_SPEC slot 'boss-bar' inset.dy matches hudCornerY token", () => {
    const slot = HUD_SPEC.slots.find((s) => s.id === 'boss-bar');
    expect(slot?.inset?.dy).toBe(THEME_SPEC.spacing.hudCornerY);
  });

  test("HUD_SPEC slot 'miniboss-bar' inset.dy is 56", () => {
    const slot = HUD_SPEC.slots.find((s) => s.id === 'miniboss-bar');
    expect(slot?.inset?.dy).toBe(56);
  });

  test("HUD_SPEC slot 'zone-banner' anchor is 'mid-center'", () => {
    const slot = HUD_SPEC.slots.find((s) => s.id === 'zone-banner');
    expect(slot?.anchor).toBe('mid-center');
  });

  test("HUD_SPEC slot 'zone-banner' inset.dy === '38%'", () => {
    const slot = HUD_SPEC.slots.find((s) => s.id === 'zone-banner');
    expect(slot?.inset?.dy).toBe('38%');
  });
});
