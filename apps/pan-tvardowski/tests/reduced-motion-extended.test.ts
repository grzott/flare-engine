import { afterEach, describe, expect, mock, test } from 'bun:test';
import { getParallaxVelocity, sigilOpacity } from '../src/a11y/reduced-motion';
import { applyShakePerlin } from '../src/a11y/reduced-motion';
import { gameState, resetGameState } from '../src/state';

describe('applyShakePerlin reduced-motion gate', () => {
  afterEach(() => {
    resetGameState();
  });

  test('reducedMotion=true: sets redFlash=true, does not call shakePerlin', () => {
    gameState.settings.reducedMotion = true;
    gameState.settings.screenShake = true;
    const spyShakePerlin = mock(() => {});
    const camera = { shakePerlin: spyShakePerlin };

    applyShakePerlin(camera, 10, 0.32);

    expect(gameState.redFlash).toBe(true);
    expect(spyShakePerlin).not.toHaveBeenCalled();
  });
});

describe('reduced-motion extended helpers', () => {
  test('sigilOpacity returns 1.0 when reducedMotion=false', () => {
    expect(sigilOpacity(false)).toBe(1.0);
  });

  test('sigilOpacity returns 0.7 when reducedMotion=true', () => {
    expect(sigilOpacity(true)).toBe(0.7);
  });

  test('getParallaxVelocity passes base through when reducedMotion=false', () => {
    expect(getParallaxVelocity(20, false)).toBe(20);
    expect(getParallaxVelocity(-5, false)).toBe(-5);
  });

  test('getParallaxVelocity returns 0 for any base when reducedMotion=true', () => {
    expect(getParallaxVelocity(20, true)).toBe(0);
    expect(getParallaxVelocity(8, true)).toBe(0);
    expect(getParallaxVelocity(-3, true)).toBe(0);
  });
});
