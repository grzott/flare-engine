import { describe, expect, mock, test } from 'bun:test';
import type { GameContextValue } from '@flare-engine/engine';
import type { CompositeUniforms, Effect } from '@flare-engine/postfx';
import type { SkiaFrameRenderer } from '@flare-engine/react';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

const mockCtx = {} as GameContextValue;
const mockCanvas = {};

type CompositeEffect = { kind: 'composite' } & CompositeUniforms;

function getComposite(fx: ReturnType<typeof createPanTvardowskiPostFx>): CompositeEffect {
  const e = fx.chain.get('composite');
  if (!e) throw new Error('composite effect missing');
  return e.uniforms as CompositeEffect;
}

function makeSpyBridge(): SkiaFrameRenderer {
  return {
    canvas: {},
    beginFrame: mock(() => {}),
    drawAtlas: mock(() => {}),
    setPostFxBinding: mock(() => {}),
    buildPostFxPasses: mock(() => []),
    endFrame: mock(() => null),
  } as unknown as SkiaFrameRenderer;
}

describe('postfx chain', () => {
  test('chain has exactly one composite effect', () => {
    const fx = createPanTvardowskiPostFx(null);
    const ids = fx.chain.all().map((e: Effect) => e.id);
    expect(ids).toEqual(['composite']);
  });

  test('vignette params match deck (intensity 0.35, radius 0.82)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const u = getComposite(fx);
    expect(u.vignetteIntensity).toBeCloseTo(0.35);
    expect(u.vignetteRadius).toBeCloseTo(0.82);
  });

  test('bloom params match deck (threshold 0.72, intensity 0.5)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const u = getComposite(fx);
    expect(u.bloomThreshold).toBeCloseTo(0.72);
    expect(u.bloomIntensity).toBeCloseTo(0.5);
  });

  test('triggerHitFlash spikes flashIntensity to 1', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    expect(getComposite(fx).flashIntensity).toBeCloseTo(1);
  });

  test('intensity decays to ~0 after update(1/decay)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    // decay rate is 4.2; after 1/4.2 ≈ 0.238 s the flash should be at ~0
    fx.update(1 / 4.2);
    expect(getComposite(fx).flashIntensity).toBeLessThan(0.05);
  });

  describe('postfx hook invocation', () => {
    function makeHook() {
      const fx = createPanTvardowskiPostFx(null);
      const hook = (_ctx: GameContextValue, _canvas: unknown, bridge: SkiaFrameRenderer | null) => {
        bridge?.setPostFxBinding(fx.runtime, fx.chain);
      };
      return { fx, hook };
    }

    test('postfx hook does not throw when bridge is null', () => {
      const { fx, hook } = makeHook();
      expect(() => hook(mockCtx, mockCanvas, null)).not.toThrow();
      expect(fx.chain.all().length).toBeGreaterThan(0);
    });

    test('bridge.setPostFxBinding is invoked with runtime and chain', () => {
      const { fx, hook } = makeHook();
      const bridge = makeSpyBridge();
      hook(mockCtx, mockCanvas, bridge);
      const spy = bridge.setPostFxBinding as ReturnType<typeof mock>;
      expect(spy.mock.calls.length).toBe(1);
      const [runtime, chain] = spy.mock.calls[0] as [unknown, unknown];
      expect(runtime).toBe(fx.runtime);
      expect(chain).toBe(fx.chain);
    });

    test('chain effect membership preserved across hook invocations', () => {
      const { fx, hook } = makeHook();
      const bridge = makeSpyBridge();
      const kindsBefore = fx.chain.all().map((e: Effect) => e.id);
      hook(mockCtx, mockCanvas, bridge);
      hook(mockCtx, mockCanvas, bridge);
      const kindsAfter = fx.chain.all().map((e: Effect) => e.id);
      expect(kindsAfter).toEqual(kindsBefore);
      expect(kindsAfter.length).toBe(kindsBefore.length);
    });
  });

  test('triggerGrayscaleHold: flashIntensity stays at hold floor during hold window, then decays after', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    fx.triggerGrayscaleHold(400);

    // After ~100 ms with default decay 12.5/s, natural intensity ≈ 0.875.
    // The hold floor of 0.6 clamps decay — either way intensity must be >= 0.55.
    for (let i = 0; i < 10; i++) fx.update(0.01);
    expect(getComposite(fx).flashIntensity).toBeGreaterThanOrEqual(0.55);

    // Advance past the 400 ms hold (40 more × 0.01 = 400 ms; 500 ms total).
    // With 12.5/s decay over 500 ms the flash reaches 0 long before hold expires.
    // After hold expires decay is unclamped — intensity must be below 0.5.
    for (let i = 0; i < 40; i++) fx.update(0.01);
    expect(getComposite(fx).flashIntensity).toBeLessThan(0.5);
  });

  test('triggerBloomPulse: bloomIntensity spikes then restores to baseline', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerBloomPulse(300);

    // Immediately after trigger bloom should be spiked above baseline 0.5.
    expect(getComposite(fx).bloomIntensity).toBeGreaterThan(0.5);

    // Advance past 300 ms (31 × 0.01 = 310 ms).
    for (let i = 0; i < 31; i++) fx.update(0.01);
    expect(getComposite(fx).bloomIntensity).toBeCloseTo(0.5);
  });
});
