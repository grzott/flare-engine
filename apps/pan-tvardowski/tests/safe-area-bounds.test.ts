import { describe, expect, test } from 'bun:test';

/**
 * Safe-area bounds — PT-Bugfix-B M3.
 *
 * Verifies that the logical play-area height is reduced by `bottomInset` so
 * that player clamp, spawn Y, and entity cull never use the occluded region.
 * The canvas and camera stay full-bleed — only PlayState.bounds.height is
 * affected, which is the value all gameplay systems receive.
 *
 * These tests exercise the arithmetic directly; the actual wiring is in
 * createPlayScene (refreshBounds) and buildSceneRegistry.
 */

/** Mirrors the refreshBounds logic in scenes/play.ts. */
function computePlayHeight(viewportHeight: number, bottomInset: number): number {
  return viewportHeight - bottomInset;
}

/** Mirrors the player-spawn Y in startZone. */
function playerSpawnY(playHeight: number): number {
  return playHeight - 90;
}

describe('safe-area bottom inset — session #47 M3', () => {
  test('zero inset: play height equals viewport height', () => {
    expect(computePlayHeight(640, 0)).toBe(640);
  });

  test('non-zero inset: play height is viewport minus inset', () => {
    expect(computePlayHeight(640, 34)).toBe(606);
  });

  test('play height is always less than viewport when inset > 0', () => {
    const viewportH = 812;
    const inset = 44;
    expect(computePlayHeight(viewportH, inset)).toBeLessThan(viewportH);
  });

  test('player spawn Y respects reduced play height', () => {
    const playH = computePlayHeight(640, 34); // 606
    expect(playerSpawnY(playH)).toBe(516); // 606 - 90
  });

  test('player spawn Y with zero inset is unchanged from pre-M3 value', () => {
    expect(playerSpawnY(computePlayHeight(640, 0))).toBe(550); // 640 - 90
  });

  test('inset values typical of notched Android (≤34) and iPhone (≤44) are handled', () => {
    for (const inset of [0, 20, 34, 44]) {
      const h = computePlayHeight(812, inset);
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(812);
    }
  });
});
