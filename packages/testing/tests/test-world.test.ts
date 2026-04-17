import { describe, expect, test } from 'bun:test';
import { defineComponent } from '@flare-engine/ecs';
import { createTestWorld } from '../src/test-world.js';

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
