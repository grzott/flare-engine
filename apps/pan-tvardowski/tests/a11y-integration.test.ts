import { describe, expect, test } from 'bun:test';
import { motionScale } from '@flare-engine/a11y';
import { createA11yBridge } from '../src/a11y/manager';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import { gameState } from '../src/state';

interface FakeCamera {
  motionScale: number;
  setMotionScale(k: number): void;
}

function makeFakeCamera(): FakeCamera {
  return {
    motionScale: 1,
    setMotionScale(k: number) {
      this.motionScale = k;
    },
  };
}

describe('a11y bridge', () => {
  test('motionScale helper returns 0 when reducedMotion is on, 1 when off', () => {
    expect(motionScale({ reducedMotion: false })).toBe(1);
    expect(motionScale({ reducedMotion: true })).toBe(0);
  });

  test('attaching camera + postfx applies motion scale on manager change', () => {
    gameState.settings.reducedMotion = false;
    const bridge = createA11yBridge();
    const cam = makeFakeCamera();
    const pfx = createPanTvardowskiPostFx(null);
    bridge.attachCamera(cam as unknown as Parameters<typeof bridge.attachCamera>[0]);
    bridge.attachPostfx(pfx);

    // Initial attach applies current scale (1).
    expect(cam.motionScale).toBe(1);
    expect(pfx.chain.globalIntensity).toBe(1);

    bridge.manager.setReducedMotion(true);
    expect(cam.motionScale).toBe(0);
    expect(pfx.chain.globalIntensity).toBe(0);
    expect(gameState.settings.reducedMotion).toBe(true);

    bridge.manager.setReducedMotion(false);
    expect(cam.motionScale).toBe(1);
    expect(pfx.chain.globalIntensity).toBe(1);
  });
});
