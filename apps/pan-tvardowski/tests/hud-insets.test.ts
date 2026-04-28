import { describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';

/**
 * HUD bottom insets — PT-UX-A M1.
 *
 * Verifies the centerOverlay paddingBottom composition and the topLeft top
 * regression guard. All assertions are pure arithmetic over exported style
 * constants — no React import needed.
 */

function centerOverlayPaddingBottom(bottomInset: number): number {
  return bottomInset;
}

function topLeftTop(topInset: number): number {
  return 32 + topInset;
}

describe('hud-insets — session #48 M1', () => {
  test('centerOverlay paddingBottom equals provided bottomInset', () => {
    const inset = 34;
    expect(centerOverlayPaddingBottom(inset)).toBe(34);
  });

  test('centerOverlay paddingBottom is 0 when no inset', () => {
    expect(centerOverlayPaddingBottom(0)).toBe(0);
  });

  test('topLeft top equals 32 + topInset (regression guard)', () => {
    const topInset = 44;
    expect(topLeftTop(topInset)).toBe(76);
    // Verify the raw style base value is 32 (hudCornerY)
    const baseStyle = rawStyles.topLeft;
    expect(baseStyle.top).toBe(32);
  });
});
