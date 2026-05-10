import { describe, expect, test } from 'bun:test';
import { EffectChain } from '../src/chain.js';
import { createBloom, createColorGradingLut, createVignette } from '../src/effect.js';
import {
  type SkImageLike,
  type SkRectLike,
  type SkiaCanvasLike,
  type SkiaPaintLike,
  type SkiaPostFxModuleLike,
  createPostFxRuntime,
} from '../src/runtime.js';

interface MockPaint extends SkiaPaintLike {
  shaderCalls: unknown[];
}

interface DrawImageRectCall {
  image: SkImageLike;
  src: SkRectLike;
  dst: SkRectLike;
  paint: SkiaPaintLike;
}

interface MockCanvas extends SkiaCanvasLike {
  drawCalls: DrawImageRectCall[];
}

interface MakeShaderCall {
  uniforms: Float32Array;
  children: unknown[];
}

interface MockRuntimeEffect {
  makeShaderCalls: MakeShaderCall[];
  makeShader(uniforms: Float32Array, children: unknown[]): unknown;
}

function createMockRuntimeEffect(): MockRuntimeEffect {
  const effect: MockRuntimeEffect = {
    makeShaderCalls: [],
    makeShader(uniforms, children) {
      this.makeShaderCalls.push({ uniforms: new Float32Array(uniforms), children: [...children] });
      return { _shader: true };
    },
  };
  return effect;
}

function createMockPaint(): MockPaint {
  return {
    shaderCalls: [],
    setShader(shader: unknown) {
      this.shaderCalls.push(shader);
    },
  };
}

function createMockCanvas(): MockCanvas {
  return {
    drawCalls: [],
    drawImageRect(image, src, dst, paint) {
      this.drawCalls.push({ image, src: { ...src }, dst: { ...dst }, paint });
    },
  };
}

function createMockSkia(paint?: MockPaint): SkiaPostFxModuleLike {
  const effect = createMockRuntimeEffect();
  const skia: SkiaPostFxModuleLike = {
    RuntimeEffect: { Make: () => effect },
  };
  if (paint !== undefined) {
    skia.Paint = () => paint;
  }
  return skia;
}

function createMockSkiaWithTrackedEffect(
  effect: MockRuntimeEffect,
  paint: MockPaint,
): SkiaPostFxModuleLike {
  return {
    RuntimeEffect: { Make: () => effect },
    Paint: () => paint,
  };
}

const mockSource: SkImageLike = { _skImageBrand: undefined };

describe('PostFxRuntime.apply', () => {
  test('empty chain — no drawImageRect calls', () => {
    const paint = createMockPaint();
    const skia = createMockSkia(paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(canvas.drawCalls).toHaveLength(0);
  });

  test('single pass — makeShader called with correct uniforms and source as children[0]', () => {
    const effect = createMockRuntimeEffect();
    const paint = createMockPaint();
    const skia = createMockSkiaWithTrackedEffect(effect, paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette('v'));

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(effect.makeShaderCalls).toHaveLength(1);
    const call = effect.makeShaderCalls[0]!;
    expect(call.uniforms).toBeInstanceOf(Float32Array);
    expect(call.children[0]).toBe(mockSource);
  });

  test('multi-pass — makeShader called once per pass, each receives same source', () => {
    const effect = createMockRuntimeEffect();
    const paint = createMockPaint();
    const skia = createMockSkiaWithTrackedEffect(effect, paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createBloom('b'));

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(effect.makeShaderCalls).toHaveLength(2);
    for (const call of effect.makeShaderCalls) {
      expect(call.children[0]).toBe(mockSource);
    }
  });

  test('pass with child texture — children is [source, lutImage]', () => {
    const lutImage: SkImageLike = {};
    const effect = createMockRuntimeEffect();
    const paint = createMockPaint();
    const skia = createMockSkiaWithTrackedEffect(effect, paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createColorGradingLut({ lut: lutImage }, 'lut'));

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(effect.makeShaderCalls).toHaveLength(1);
    const call = effect.makeShaderCalls[0]!;
    expect(call.children).toHaveLength(2);
    expect(call.children[0]).toBe(mockSource);
    expect(call.children[1]).toBe(lutImage);
  });

  test('drawImageRect called once per pass', () => {
    const effect = createMockRuntimeEffect();
    const paint = createMockPaint();
    const skia = createMockSkiaWithTrackedEffect(effect, paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette('v'));
    chain.add(createBloom('b'));

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(canvas.drawCalls).toHaveLength(2);
  });

  test('width and height flow — src rect dimensions match arguments', () => {
    const effect = createMockRuntimeEffect();
    const paint = createMockPaint();
    const skia = createMockSkiaWithTrackedEffect(effect, paint);
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette('v'));

    rt.apply(canvas, chain, mockSource, 1280, 720);

    const call = canvas.drawCalls[0]!;
    expect(call.src.x).toBe(0);
    expect(call.src.y).toBe(0);
    expect(call.src.width).toBe(1280);
    expect(call.src.height).toBe(720);
    expect(call.dst.width).toBe(1280);
    expect(call.dst.height).toBe(720);
  });

  test('runtime.supported === false — apply is a no-op', () => {
    const rt = createPostFxRuntime(null);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette());

    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(canvas.drawCalls).toHaveLength(0);
  });

  test('Paint absent on skia module — no-op without crashing', () => {
    // skia has RuntimeEffect but no Paint factory
    const skia = createMockSkia();
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette());

    expect(() => rt.apply(canvas, chain, mockSource, 800, 600)).not.toThrow();
    expect(canvas.drawCalls).toHaveLength(0);
  });

  test('paint allocated once and reused across calls — zero-alloc', () => {
    let paintAllocCount = 0;
    const effect = createMockRuntimeEffect();
    const skia: SkiaPostFxModuleLike = {
      RuntimeEffect: { Make: () => effect },
      Paint() {
        paintAllocCount++;
        return createMockPaint();
      },
    };
    const rt = createPostFxRuntime(skia);
    const canvas = createMockCanvas();
    const chain = new EffectChain();
    chain.add(createVignette());

    rt.apply(canvas, chain, mockSource, 800, 600);
    rt.apply(canvas, chain, mockSource, 800, 600);
    rt.apply(canvas, chain, mockSource, 800, 600);

    expect(paintAllocCount).toBe(1);
    expect(canvas.drawCalls).toHaveLength(3);
  });
});
