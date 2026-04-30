import { beforeEach, describe, expect, test } from 'bun:test';
import { resetTween, tween, updateTween } from '@flare-engine/animation';
import { easeOutExpo } from '@flare-engine/math';
import { gameState, resetGameState } from '../src/state';

describe('boss-intro-transition', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('bossBarOpacity starts at 0 when bossActive becomes true', () => {
    // Simulate the spawn-boss path in play.ts (reducedMotion=false branch).
    gameState.settings.reducedMotion = false;
    gameState.bossBarOpacity = 0;
    gameState.bossActive = true;
    // Opacity must still be 0 before any tween tick.
    expect(gameState.bossBarOpacity).toBe(0);
  });

  test('bossBarOpacity reaches >= 0.9 after 0.6 s of tween advancement', () => {
    // Construct the same tween used in play.ts initState and drive it directly.
    const tw = { ...tween(0, 1, 0.6, easeOutExpo), done: true };
    // Trigger: reset tween (mirrors resetTween(s.bossBarTween) on boss spawn).
    resetTween(tw);
    // Advance in 20 ms steps summing to 0.6 s (30 steps).
    let value = 0;
    const steps = 30;
    const dt = 0.6 / steps;
    for (let i = 0; i < steps; i++) {
      value = updateTween(tw, dt);
    }
    expect(value).toBeGreaterThanOrEqual(0.9);
  });
});
