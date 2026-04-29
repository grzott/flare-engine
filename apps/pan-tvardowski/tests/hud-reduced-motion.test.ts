import { beforeEach, describe, expect, test } from 'bun:test';
import { applyShake, getReducedMotion } from '../src/a11y/reduced-motion';
import { gameState, resetGameState } from '../src/state';

describe('reduced-motion shake helper', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('getReducedMotion mirrors gameState.settings.reducedMotion', () => {
    expect(getReducedMotion()).toBe(false);
    gameState.settings.reducedMotion = true;
    expect(getReducedMotion()).toBe(true);
  });

  test('applyShake calls camera.shake when both flags allow', () => {
    let called = false;
    const camera = {
      shake: () => {
        called = true;
      },
    };
    gameState.settings.screenShake = true;
    gameState.settings.reducedMotion = false;
    applyShake(camera, 6, 0.2);
    expect(called).toBe(true);
    expect(gameState.redFlash).toBe(false);
  });

  test('applyShake suppresses shake and sets redFlash when reducedMotion=true', () => {
    let called = false;
    const camera = {
      shake: () => {
        called = true;
      },
    };
    gameState.settings.screenShake = true;
    gameState.settings.reducedMotion = true;
    applyShake(camera, 6, 0.2);
    expect(called).toBe(false);
    expect(gameState.redFlash).toBe(true);
  });

  test('applyShake suppresses shake when screenShake=false', () => {
    let called = false;
    const camera = {
      shake: () => {
        called = true;
      },
    };
    gameState.settings.screenShake = false;
    gameState.settings.reducedMotion = false;
    applyShake(camera, 6, 0.2);
    expect(called).toBe(false);
    expect(gameState.redFlash).toBe(true);
  });
});
