import { describe, expect, mock, test } from 'bun:test';

// Restore real @flare-engine/core and @flare-engine/ecs before importing
// test-world.ts.  Other test files (react/game-view.test.ts etc.) mock both
// packages with stripped stubs.  The plain-object spread is required because
// Bun's mock.module won't replace a cached entry when the factory returns a
// module namespace object.
//
// NOTE: use _realEcs.defineComponent directly — do NOT re-import
// @flare-engine/ecs after mock.module(), because Bun's ESM live-binding cache
// keeps the export shape of the previously-cached mock (only { World, Position })
// and silently drops any new exports returned by the factory.
const _realCore = await import('../../core/src/index.ts');
mock.module('@flare-engine/core', () => ({ ..._realCore }));
const _realEcs = await import('../../ecs/src/index.ts');
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));

const { createTestWorld } = await import('../src/test-world.js');
const defineComponent = _realEcs.defineComponent;

describe('createTestWorld', () => {
  test('returns a wired World + GameLoop + FakeClock', () => {
    const t = createTestWorld();
    expect(t.world).toBeDefined();
    expect(t.loop).toBeDefined();
    expect(t.clock.now).toBe(0);
    expect(t.loop.tick).toBe(t.clock.requestFrame);
    expect(t.loop.cancelTick).toBe(t.clock.cancelFrame);
  });

  test('step drives onUpdate deterministically', () => {
    const t = createTestWorld();
    const dts: number[] = [];
    t.loop.onUpdate.add((dt) => dts.push(dt));
    t.step(1 / 60);
    t.step(1 / 60);
    expect(dts.length).toBe(2);
    expect(dts[0]).toBeCloseTo(1 / 60);
  });

  test('stepFrames runs N frames of equal dt', () => {
    const t = createTestWorld();
    let frames = 0;
    t.loop.onUpdate.add(() => {
      frames++;
    });
    t.stepFrames(5);
    expect(frames).toBe(5);
  });

  test('ECS systems see expected dt', () => {
    const Tag = defineComponent<{ n: number }>('test:Tag', () => ({ n: 0 }));
    const t = createTestWorld();
    const id = t.world.spawn();
    t.world.add(id, Tag, { n: 0 });
    t.loop.onUpdate.add((dt) => {
      const tag = t.world.get(id, Tag);
      if (tag) tag.n += dt;
    });
    t.stepFrames(3, 0.1);
    expect(t.world.get(id, Tag)?.n).toBeCloseTo(0.3);
  });

  test('forwards fixedDt and maxDt to the loop', () => {
    const t = createTestWorld({ fixedDt: 1 / 30 });
    expect(t.loop.clock.fixedDt).toBeCloseTo(1 / 30);
  });
});
