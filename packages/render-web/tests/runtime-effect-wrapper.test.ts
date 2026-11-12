import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';
import * as postfx from '@flare-engine/postfx';
import type { CanvasKit } from 'canvaskit-wasm';
import { createWebSkiaModule } from '../src/web-skia-module.js';
import { makeMockKit } from './support/mock-kit.js';

// The postfx surface keeps its Skia shim private, so the only way to see the wrapped effect is to
// capture what it hands to createPostFxRuntime. The real exports are copied before the mock is
// installed; this file runs in its own process (scripts/test-isolated.mjs).
const realPostfx = { ...postfx };
const runtimeArgs: unknown[][] = [];
mock.module('@flare-engine/postfx', () => ({
  ...realPostfx,
  createPostFxRuntime: (...args: Parameters<typeof realPostfx.createPostFxRuntime>) => {
    runtimeArgs.push(args);
    return realPostfx.createPostFxRuntime(...args);
  },
}));
const { createPostFxSurface } = await import('../src/postfx-surface.js');

interface FakeEffect {
  calls: string[];
  shader: { id: string; delete(): void };
  childShader: { id: string; delete(): void };
  makeShaderArgs: unknown[][];
  makeShaderWithChildrenArgs: unknown[][];
  effect: Record<string, unknown>;
}

function makeFakeEffect(): FakeEffect {
  const calls: string[] = [];
  const shader = { id: 'shader', delete: () => {} };
  const childShader = { id: 'child-shader', delete: () => {} };
  const makeShaderArgs: unknown[][] = [];
  const makeShaderWithChildrenArgs: unknown[][] = [];
  const effect = {
    makeShader: (...args: unknown[]) => {
      calls.push('makeShader');
      makeShaderArgs.push(args);
      return shader;
    },
    makeShaderWithChildren: (...args: unknown[]) => {
      calls.push('makeShaderWithChildren');
      makeShaderWithChildrenArgs.push(args);
      return childShader;
    },
    getUniformCount: () => {
      calls.push('getUniformCount');
      return 3;
    },
    getUniformFloatCount: () => {
      calls.push('getUniformFloatCount');
      return 7;
    },
    getUniformName: (i: number) => {
      calls.push(`getUniformName(${i})`);
      return `u${i}`;
    },
    getUniform: (i: number) => {
      calls.push(`getUniform(${i})`);
      return { columns: 2, rows: 4, slot: i * 10, isInteger: false };
    },
  };
  return { calls, shader, childShader, makeShaderArgs, makeShaderWithChildrenArgs, effect };
}

interface FakeFactory {
  kit: CanvasKit;
  sources: string[];
  fake: FakeEffect;
}

/** A kit whose RuntimeEffect.Make records its source and returns `fake.effect`, or null. */
function withEffect(base: object, compiles = true): FakeFactory {
  const sources: string[] = [];
  const fake = makeFakeEffect();
  const kit = {
    ...base,
    RuntimeEffect: {
      Make: (sksl: string) => {
        sources.push(sksl);
        return compiles ? fake.effect : null;
      },
    },
  } as unknown as CanvasKit;
  return { kit, sources, fake };
}

const RENDERER_KIT_BASE = {
  FilterMode: { Nearest: {}, Linear: {} },
  MipmapMode: { None: {} },
};

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 64,
    height: 48,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

/** Build a postfx surface on `kit` and return the Skia shim it handed to createPostFxRuntime. */
function captureSurfaceShim(kit: CanvasKit, chain = new postfx.EffectChain()) {
  runtimeArgs.length = 0;
  const surface = createPostFxSurface(kit, makeCanvas(), chain);
  if (!surface) throw new Error('surface was not created');
  expect(runtimeArgs).toHaveLength(1);
  const args = runtimeArgs[0] as unknown[];
  return { surface, args, shim: args[0] as SkiaPostFxModuleLike };
}

const SKSL = 'half4 main(float2 p) { return half4(1); }';

/** Compile SKSL through the frame renderer module's RuntimeEffect factory. */
function rendererMake(kit: CanvasKit) {
  const factory = createWebSkiaModule(kit).RuntimeEffect;
  if (!factory) throw new Error('module has no RuntimeEffect factory');
  return factory.Make(SKSL);
}

describe('createWebSkiaModule RuntimeEffect wrapper', () => {
  it('forwards the source to CanvasKit and returns null when it does not compile', () => {
    const ok = withEffect(RENDERER_KIT_BASE);
    expect(rendererMake(ok.kit)).not.toBeNull();
    expect(ok.sources).toEqual([SKSL]);

    const bad = withEffect(RENDERER_KIT_BASE, false);
    expect(rendererMake(bad.kit)).toBeNull();
    expect(bad.sources).toEqual([SKSL]);
  });

  it('touches nothing on the effect while wrapping it', () => {
    const { kit, fake } = withEffect(RENDERER_KIT_BASE);
    rendererMake(kit);
    expect(fake.calls).toEqual([]);
  });

  it('makeShader passes the uniforms array through and returns the CanvasKit shader', () => {
    const { kit, fake } = withEffect(RENDERER_KIT_BASE);
    const wrapped = rendererMake(kit);
    const uniforms = [1, 2, 3];

    expect(wrapped?.makeShader(uniforms)).toBe(fake.shader);
    expect(fake.makeShaderArgs).toHaveLength(1);
    expect(fake.makeShaderArgs[0]).toHaveLength(1);
    expect(fake.makeShaderArgs[0]?.[0]).toBe(uniforms);
  });

  it('exposes uniform reflection, each method forwarding to its CanvasKit namesake', () => {
    const { kit, fake } = withEffect(RENDERER_KIT_BASE);
    const wrapped = rendererMake(kit);

    expect(wrapped?.getUniformCount()).toBe(3);
    expect(wrapped?.getUniformFloatCount()).toBe(7);
    expect(wrapped?.getUniformName(2)).toBe('u2');
    // Only columns/rows/slot are copied out of CanvasKit's SkSLUniform.
    expect(wrapped?.getUniform(2)).toEqual({ columns: 2, rows: 4, slot: 20 });
    expect(fake.calls).toEqual([
      'getUniformCount',
      'getUniformFloatCount',
      'getUniformName(2)',
      'getUniform(2)',
    ]);
  });
});

describe('createPostFxSurface RuntimeEffect shim', () => {
  it('creates its postfx runtime with no options, so the verbose diagnostic stays off', () => {
    const { kit } = withEffect(makeMockKit().kit);
    const { args } = captureSurfaceShim(kit);
    expect(args).toHaveLength(1);
  });

  it('forwards the source to CanvasKit and returns null when it does not compile', () => {
    const ok = withEffect(makeMockKit().kit);
    expect(captureSurfaceShim(ok.kit).shim.RuntimeEffect.Make(SKSL)).not.toBeNull();
    expect(ok.sources).toEqual([SKSL]);

    const bad = withEffect(makeMockKit().kit, false);
    expect(captureSurfaceShim(bad.kit).shim.RuntimeEffect.Make(SKSL)).toBeNull();
    expect(bad.sources).toEqual([SKSL]);
  });

  it('touches nothing on the effect while wrapping it', () => {
    const { kit, fake } = withEffect(makeMockKit().kit);
    captureSurfaceShim(kit).shim.RuntimeEffect.Make(SKSL);
    expect(fake.calls).toEqual([]);
  });

  it('makeShaderWithChildren passes uniforms and children through', () => {
    const { kit, fake } = withEffect(makeMockKit().kit);
    const wrapped = captureSurfaceShim(kit).shim.RuntimeEffect.Make(SKSL);
    const uniforms = new Float32Array([0.5, 0.25]);
    const children = [{ id: 'src' }];

    expect(wrapped?.makeShaderWithChildren(uniforms, children)).toBe(fake.childShader);
    expect(fake.makeShaderWithChildrenArgs).toHaveLength(1);
    expect(fake.makeShaderWithChildrenArgs[0]).toHaveLength(2);
    expect(fake.makeShaderWithChildrenArgs[0]?.[0]).toBe(uniforms);
    expect(fake.makeShaderWithChildrenArgs[0]?.[1]).toBe(children);
  });

  it('makeShaderWithChildren substitutes an empty array for omitted children', () => {
    const { kit, fake } = withEffect(makeMockKit().kit);
    const wrapped = captureSurfaceShim(kit).shim.RuntimeEffect.Make(SKSL);

    wrapped?.makeShaderWithChildren(new Float32Array(1));
    expect(fake.makeShaderWithChildrenArgs[0]?.[1]).toEqual([]);
  });

  it('exposes getUniformFloatCount, forwarding to CanvasKit only when called', () => {
    const { kit, fake } = withEffect(makeMockKit().kit);
    const wrapped = captureSurfaceShim(kit).shim.RuntimeEffect.Make(SKSL);
    expect(fake.calls).toEqual([]);
    expect(wrapped?.getUniformFloatCount?.()).toBe(7);
    expect(fake.calls).toEqual(['getUniformFloatCount']);
  });

  it('would feed the postfx compile diagnostic only under a verbose runtime', () => {
    const info = spyOn(console, 'info').mockImplementation(() => {});
    const { kit, fake } = withEffect(makeMockKit().kit);
    const { shim } = captureSurfaceShim(kit);

    realPostfx.createPostFxRuntime(shim).compile('vignette');
    expect(info).not.toHaveBeenCalled();
    expect(fake.calls).toEqual([]);

    realPostfx.createPostFxRuntime(shim, { verbose: true }).compile('vignette');
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toContain('getUniformFloatCount=7');
    info.mockRestore();
  });

  it('compositing a chain compiles and draws without reflection or console output', () => {
    const info = spyOn(console, 'info').mockImplementation(() => {});
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const { kit, fake, sources } = withEffect(makeMockKit().kit);
    const chain = new postfx.EffectChain();
    chain.add(postfx.createVignette('v', { intensity: 0.5 }));
    const { surface } = captureSurfaceShim(kit, chain);

    surface.composite();

    expect(sources).toEqual([postfx.VIGNETTE_SKSL]);
    expect(fake.calls).toEqual(['makeShaderWithChildren']);
    expect(fake.makeShaderWithChildrenArgs[0]?.[0]).toBeInstanceOf(Float32Array);
    expect(fake.makeShaderWithChildrenArgs[0]?.[1]).toHaveLength(1);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    info.mockRestore();
    warn.mockRestore();
  });
});

describe('one wrapper for both sites', () => {
  it('the renderer module and the postfx shim wrap one effect into the same shape', () => {
    const renderer = withEffect(RENDERER_KIT_BASE);
    const surface = withEffect(makeMockKit().kit);
    const fromRenderer = rendererMake(renderer.kit);
    const fromSurface = captureSurfaceShim(surface.kit).shim.RuntimeEffect.Make(SKSL);

    const shape = (o: object | null): string[] =>
      Object.entries(o ?? {})
        .map(([key, value]) => `${key}:${typeof value}`)
        .sort();
    expect(shape(fromRenderer)).toEqual([
      'getUniform:function',
      'getUniformCount:function',
      'getUniformFloatCount:function',
      'getUniformName:function',
      'makeShader:function',
      'makeShaderWithChildren:function',
    ]);
    expect(shape(fromSurface)).toEqual(shape(fromRenderer));
  });
});
