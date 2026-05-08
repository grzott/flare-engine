/**
 * Android overlay-layering regression coverage.
 *
 * On Android, @shopify/react-native-skia's <Canvas> defaults to a TextureView,
 * which has known compositing issues with overlapping RN views at the same
 * elevation — full-screen overlays get clipped by the canvas even though
 * they're later in the React tree. The fix uses two complementary mechanisms:
 *
 *   1. Engine: GameView's Canvas is rendered with `opaque={true}` so it
 *      becomes a SurfaceView. SurfaceView with default z-order paints in a
 *      separate compositing layer below the regular RN view tree.
 *   2. App: every full-screen overlay's root style sets `elevation` + `zIndex`
 *      as defense-in-depth in case the SurfaceView promotion is unavailable.
 *
 * Tests pin both mechanisms so the smoke regression cannot recur silently.
 */

import { describe, expect, test } from 'bun:test';
import type { GameConfig } from '@flare-engine/react';

import { rawStyles as achievementsRaw } from '../src/hud/AchievementsOverlay.styles';
import { rawStyles as bootRaw } from '../src/hud/BootOverlay.styles';
import { rawStyles as dialogueRaw } from '../src/hud/DialogueOverlay.styles';
import { rawStyles as hudRaw } from '../src/hud/Hud.styles';
import { rawStyles as menuRaw } from '../src/hud/MenuOverlay.styles';
import { rawStyles as paywallRaw } from '../src/hud/PaywallOverlay.styles';

// Pixel 7 + react-native-skia: full-screen RN overlays need elevation > 0
// to consistently paint above the Skia Canvas. The wider smoke-test bug
// (always-rendering PaywallOverlay wrapper covering the menu) is fixed
// separately by gating PaywallOverlay on `visible`.
const MIN_ELEVATION = 4;
const MIN_ZINDEX = 4;

interface ElevatedRoot {
  elevation?: number;
  zIndex?: number;
  position?: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

function assertLifted(name: string, root: ElevatedRoot): void {
  expect(root.position, `${name} must be position:absolute`).toBe('absolute');
  expect(root.elevation ?? 0, `${name} elevation`).toBeGreaterThanOrEqual(MIN_ELEVATION);
  expect(root.zIndex ?? 0, `${name} zIndex`).toBeGreaterThanOrEqual(MIN_ZINDEX);
}

describe('overlay layering — full-screen overlays paint above the Skia Canvas', () => {
  test('AchievementsOverlay root is elevated', () => {
    assertLifted('AchievementsOverlay.root', achievementsRaw.root as ElevatedRoot);
  });

  test('BootOverlay root is elevated', () => {
    assertLifted('BootOverlay.root', bootRaw.root as ElevatedRoot);
  });

  test('MenuOverlay root is elevated', () => {
    assertLifted('MenuOverlay.root', menuRaw.root as ElevatedRoot);
  });

  test('Hud root is elevated', () => {
    assertLifted('Hud.root', hudRaw.root as ElevatedRoot);
  });

  test('DialogueOverlay root is elevated', () => {
    assertLifted('DialogueOverlay.root', dialogueRaw.root as ElevatedRoot);
  });

  test('PaywallOverlay wrapper is elevated', () => {
    assertLifted('PaywallOverlay.wrapper', paywallRaw.wrapper as ElevatedRoot);
  });
});

describe('overlay layering — engine GameConfig surface for SurfaceView promotion', () => {
  test('GameConfig accepts an `opaque` flag for the Skia Canvas', () => {
    // Compile-time assertion: this expression must typecheck. If the engine
    // drops the `opaque` field, this test fails to build.
    const cfg: GameConfig = { opaque: true };
    expect(cfg.opaque).toBe(true);
  });
});
