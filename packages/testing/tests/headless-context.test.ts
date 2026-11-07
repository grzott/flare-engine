import { describe, expect, mock, test } from 'bun:test';

// Same restore-the-real-module dance as test-world.test.ts / mock-input.test.ts:
// other packages' test files mock these modules with stripped stubs, and the
// plain-object spread is what makes Bun's mock.module replace a cached entry.
// ecs is mocked before render is imported so render-system.ts resolves the
// same ecs module the context's World comes from.
const _realCore = await import('../../core/src/index.js');
mock.module('@flare-engine/core', () => ({ ..._realCore }));
const _realEcs = await import('../../ecs/src/index.js');
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));
const _realInput = await import('../../input/src/index.js');
mock.module('@flare-engine/input', () => ({ ..._realInput }));
const _realAssets = await import('../../assets/src/index.js');
mock.module('@flare-engine/assets', () => ({ ..._realAssets }));
const _realRender = await import('../../render/src/index.js');
mock.module('@flare-engine/render', () => ({ ..._realRender }));

const { createHeadlessContext } = await import('../src/headless-context.js');
const { MockInputManager } = await import('../src/mock-input.js');
const { Position, Velocity } = _realEcs;
const { AssetManager, getFrame } = _realAssets;
const { Camera2D } = _realRender;

const DT = 1 / 60;
const FRAMES = 1000;

/**
 * Builds a context, moves one entity by its velocity every frame, fires both
 * shakes, steps 1000 frames and records per-frame camera + entity state.
 */
function record(): Float64Array {
  const ctx = createHeadlessContext({ viewportWidth: 320, viewportHeight: 180 });
  const id = ctx.world.spawn();
  ctx.world.add(id, Position, { x: 0, y: 0 });
  ctx.world.add(id, Velocity, { x: 3, y: -2 });
  ctx.loop.onUpdate.add((dt) => {
    const pos = ctx.world.get(id, Position);
    const vel = ctx.world.get(id, Velocity);
    if (pos && vel) {
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
    }
  });
  const out = new Float64Array(FRAMES * 4);
  for (let i = 0; i < FRAMES; i++) {
    if (i === 100) ctx.camera.shake(10, 0.5);
    if (i === 500) ctx.camera.shakePerlin(10, 0.5);
    ctx.step(DT);
    const pos = ctx.world.get(id, Position);
    out[i * 4] = ctx.camera.effectiveX;
    out[i * 4 + 1] = ctx.camera.effectiveY;
    out[i * 4 + 2] = pos?.x ?? Number.NaN;
    out[i * 4 + 3] = pos?.y ?? Number.NaN;
  }
  return out;
}

describe('createHeadlessContext', () => {
  test('steps 1000 frames with rawDt exactly 1/60 on every frame', () => {
    const ctx = createHeadlessContext();
    let frames = 0;
    let exact = 0;
    ctx.loop.onUpdate.add(() => {
      frames++;
      if (ctx.loop.clock.rawDt === DT) exact++;
    });
    ctx.stepFrames(FRAMES, DT);
    expect(frames).toBe(FRAMES);
    expect(exact).toBe(FRAMES);
    expect(ctx.loop.clock.elapsed).toBeCloseTo(FRAMES / 60);
  });

  test('builds on createTestWorld: fake clock wired, fixedDt and maxDt forwarded', () => {
    const ctx = createHeadlessContext({ fixedDt: 1 / 30, maxDt: 0.1 });
    expect(ctx.loop.tick).toBe(ctx.clock.requestFrame);
    expect(ctx.loop.cancelTick).toBe(ctx.clock.cancelFrame);
    expect(ctx.loop.clock.fixedDt).toBeCloseTo(1 / 30);
    let fixedTicks = 0;
    ctx.loop.onFixedUpdate.add(() => {
      fixedTicks++;
    });
    ctx.step(1);
    expect(ctx.loop.clock.rawDt).toBe(0.1);
    expect(fixedTicks).toBe(3);
  });

  test('camera shakes displace effectiveX/Y and settle back after their duration', () => {
    const ctx = createHeadlessContext();
    const { camera } = ctx;
    const displaced = (): boolean =>
      camera.effectiveX !== camera.x || camera.effectiveY !== camera.y;

    ctx.stepFrames(100, DT);
    expect(() => camera.shake(10, 0.5)).not.toThrow();
    let shakeSeen = false;
    for (let i = 0; i < 40; i++) {
      ctx.step(DT);
      if (displaced()) shakeSeen = true;
    }
    expect(shakeSeen).toBe(true);
    expect(displaced()).toBe(false);

    ctx.stepFrames(360, DT);
    expect(() => camera.shakePerlin(10, 0.5)).not.toThrow();
    let perlinSeen = false;
    for (let i = 0; i < 40; i++) {
      ctx.step(DT);
      if (displaced()) perlinSeen = true;
    }
    expect(perlinSeen).toBe(true);
    expect(displaced()).toBe(false);
  });

  test('sheet resolves every frame name to the single stub frame', () => {
    const { sheet } = createHeadlessContext();
    expect(sheet.frameMap.get('anything')).toBe(0);
    expect(sheet.frameMap.has('nope')).toBe(true);
    expect(sheet.frames).toHaveLength(1);
    expect(sheet.animations.size).toBe(0);
    expect(getFrame(sheet, 'whatever')).toEqual({ name: 'headless', x: 0, y: 0, w: 8, h: 8 });
    expect(getFrame(sheet, 'other')).toBe(sheet.frames[0]);
  });

  test('two independent contexts produce byte-identical 1000-frame recordings', () => {
    const a = record();
    const b = record();
    expect(new Uint8Array(a.buffer)).toEqual(new Uint8Array(b.buffer));

    let shakeFrames = 0;
    for (let i = 0; i < FRAMES; i++) {
      if (a[i * 4] !== 0 || a[i * 4 + 1] !== 0) shakeFrames++;
    }
    expect(shakeFrames).toBeGreaterThan(0);
    expect(a[(FRAMES - 1) * 4 + 2]).toBeCloseTo(50);
    expect(a[(FRAMES - 1) * 4 + 3]).toBeCloseTo(-1000 / 30);
  });

  test('viewport options reach the camera; the default matches new Camera2D()', () => {
    const sized = createHeadlessContext({ viewportWidth: 320, viewportHeight: 180 });
    expect(sized.camera.viewportWidth).toBe(320);
    expect(sized.camera.viewportHeight).toBe(180);

    const plain = createHeadlessContext();
    const fresh = new Camera2D();
    expect(plain.camera.viewportWidth).toBe(fresh.viewportWidth);
    expect(plain.camera.viewportHeight).toBe(fresh.viewportHeight);
  });

  test('one viewport dimension without the other throws RangeError', () => {
    expect(() => createHeadlessContext({ viewportWidth: 320 })).toThrow(RangeError);
    expect(() => createHeadlessContext({ viewportHeight: 180 })).toThrow(RangeError);
  });

  test('scenes passes through by identity and is undefined when omitted', () => {
    const scenes = { current: 'menu' };
    // Typed assignments: typecheck:tests fails if `S` stops being inferred from `scenes`.
    const given: { current: string } = createHeadlessContext({ scenes }).scenes;
    const omitted: undefined = createHeadlessContext().scenes;
    expect(given).toBe(scenes);
    expect(omitted).toBeUndefined();
  });

  test('assets is an AssetManager whose default loader resolves null', async () => {
    const { assets } = createHeadlessContext();
    expect(assets).toBeInstanceOf(AssetManager);
    await assets.load([{ key: 'k', type: 'json', path: 'k.json' }]);
    expect(assets.has('k')).toBe(true);
    expect(assets.get('k')).toBeNull();
  });

  test('input is a MockInputManager whose per-frame flags clear on step', () => {
    const ctx = createHeadlessContext();
    expect(ctx.input).toBeInstanceOf(MockInputManager);
    ctx.input.tap(4, 5);
    expect(ctx.input.pointer.justPressed).toBe(true);
    expect(ctx.input.pointer.justReleased).toBe(true);
    ctx.step(DT);
    expect(ctx.input.pointer.justPressed).toBe(false);
    expect(ctx.input.pointer.justReleased).toBe(false);
    expect(ctx.input.pointer.position).toEqual({ x: 4, y: 5 });
  });
});
