import { describe, expect, mock, test } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { GameContextValue } from '@flare-engine/engine';
import type { Effect } from '@flare-engine/postfx';
import type { SkiaFrameRenderer } from '@flare-engine/react';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';

const mockCtx = {} as GameContextValue;
const mockCanvas = {};

function makeSpyBridge(snapshotReturn: SkImageLike | null = null): SkiaFrameRenderer {
  return {
    canvas: {},
    beginFrame: mock(() => {}),
    drawAtlas: mock(() => {}),
    captureSceneSnapshot: mock(() => snapshotReturn),
    applyPostFx: mock(() => {}),
    endFrame: mock(() => null),
  } as unknown as SkiaFrameRenderer;
}

describe('postfx chain', () => {
  test('chain has vignette + bloom + grayscale-flash', () => {
    const fx = createPanTvardowskiPostFx(null);
    const ids = fx.chain.all().map((e: Effect) => e.id);
    expect(ids).toContain('vignette');
    expect(ids).toContain('bloom');
    expect(ids).toContain('grayscale-flash');
  });

  test('vignette params match deck (intensity 0.35, radius 0.82)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const v = fx.chain.all().find((e: Effect) => e.id === 'vignette');
    if (v?.uniforms.kind !== 'vignette') throw new Error('vignette missing');
    expect(v.uniforms.intensity).toBeCloseTo(0.35);
    expect(v.uniforms.radius).toBeCloseTo(0.82);
  });

  test('bloom params match deck (threshold 0.72, intensity 0.5)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const b = fx.chain.all().find((e: Effect) => e.id === 'bloom');
    if (b?.uniforms.kind !== 'bloom') throw new Error('bloom missing');
    expect(b.uniforms.threshold).toBeCloseTo(0.72);
    expect(b.uniforms.intensity).toBeCloseTo(0.5);
  });

  test('triggerHitFlash spikes grayscale-flash intensity to 1', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    const f = fx.chain.all().find((e: Effect) => e.id === 'grayscale-flash');
    if (f?.uniforms.kind !== 'grayscale-flash') throw new Error('grayscale-flash missing');
    expect(f.uniforms.intensity).toBeCloseTo(1);
  });

  test('intensity decays to ~0 after update(1/decay)', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.triggerHitFlash();
    // decay rate is 4.2; after 1/4.2 ≈ 0.238 s the flash should be at ~0
    fx.update(1 / 4.2);
    const f = fx.chain.all().find((e: Effect) => e.id === 'grayscale-flash');
    if (f?.uniforms.kind !== 'grayscale-flash') throw new Error('grayscale-flash missing');
    expect(f.uniforms.intensity).toBeLessThan(0.05);
  });

  describe('postfx hook invocation', () => {
    const bounds = { width: 360, height: 720 };

    function makeHook() {
      const fx = createPanTvardowskiPostFx(null);
      const hook = (_ctx: GameContextValue, _canvas: unknown, bridge: SkiaFrameRenderer | null) => {
        fx.buildPass(bounds.width, bounds.height);
        const snapshot = bridge?.captureSceneSnapshot(bounds.width, bounds.height) ?? null;
        bridge?.applyPostFx(fx.runtime, fx.chain, snapshot, bounds.width, bounds.height);
      };
      return { fx, hook };
    }

    test('postfx hook does not throw when bridge is null', () => {
      const { fx, hook } = makeHook();
      expect(() => hook(mockCtx, mockCanvas, null)).not.toThrow();
      expect(fx.chain.all().length).toBeGreaterThan(0);
    });

    test('bridge.applyPostFx is invoked with runtime + chain + null source + numeric w/h when bridge non-null', () => {
      const { fx, hook } = makeHook();
      const bridge = makeSpyBridge();
      hook(mockCtx, mockCanvas, bridge);
      const spy = bridge.applyPostFx as ReturnType<typeof mock>;
      expect(spy.mock.calls.length).toBe(1);
      const [runtime, chain, source, w, h] = spy.mock.calls[0] as [
        unknown,
        unknown,
        unknown,
        number,
        number,
      ];
      expect(runtime).toBe(fx.runtime);
      expect(chain).toBe(fx.chain);
      expect(source).toBeNull();
      expect(w).toBe(bounds.width);
      expect(h).toBe(bounds.height);
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

    test('captureSceneSnapshot is called before applyPostFx and its return value flows into source', () => {
      const { hook } = makeHook();
      const bridge = makeSpyBridge();
      const captureSpy = bridge.captureSceneSnapshot as ReturnType<typeof mock>;
      const applyspy = bridge.applyPostFx as ReturnType<typeof mock>;
      hook(mockCtx, mockCanvas, bridge);
      expect(captureSpy.mock.calls.length).toBe(1);
      expect(applyspy.mock.calls.length).toBe(1);
      const captureOrder = captureSpy.mock.invocationCallOrder?.[0] ?? 0;
      const applyOrder = applyspy.mock.invocationCallOrder?.[0] ?? 1;
      expect(captureOrder).toBeLessThan(applyOrder);
      const [, , source] = applyspy.mock.calls[0] as [unknown, unknown, unknown];
      expect(source).toBeNull();
    });

    test('non-null snapshot from captureSceneSnapshot flows into applyPostFx source', () => {
      const fakeImage = { __kind: 'SkImageLike' } as unknown as SkImageLike;
      const { hook } = makeHook();
      const bridge = makeSpyBridge(fakeImage);
      hook(mockCtx, mockCanvas, bridge);
      const applyspy = bridge.applyPostFx as ReturnType<typeof mock>;
      const [, , source] = applyspy.mock.calls[0] as [unknown, unknown, unknown];
      expect(source).toBe(fakeImage);
    });

    test('null from captureSceneSnapshot flows into applyPostFx source as null', () => {
      const { hook } = makeHook();
      const bridge = makeSpyBridge(null);
      hook(mockCtx, mockCanvas, bridge);
      const applyspy = bridge.applyPostFx as ReturnType<typeof mock>;
      const [, , source] = applyspy.mock.calls[0] as [unknown, unknown, unknown];
      expect(source).toBeNull();
    });
  });
});
