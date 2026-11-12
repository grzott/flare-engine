import { describe, expect, it, mock } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import { Renderer } from '../src/renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import { tint } from '../src/sprite-effects.js';

// Restore real @flare-engine/ecs BEFORE importing render-system.js.
// render-system.ts has a static `import { defineComponent } from '@flare-engine/ecs'`;
// if the ecs mock cache only has { World, Position } (set by game-view.test.ts),
// Bun throws SyntaxError: Export named 'defineComponent' not found.
// The factory must return a plain object (spread) — not a module namespace object.
const _realEcs = await import('../../ecs/src/index.js');
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));
const { World: EcsWorld } = await import('@flare-engine/ecs');

// Dynamically import render-system AFTER the ecs mock is restored so the
// static `import { defineComponent }` inside render-system.ts resolves correctly.
const {
  Sprite: RenderSprite,
  createRenderSystem,
  createProbedRenderSystem,
} = await import('../src/render-system.js');

// Define the test's Position via the real defineComponent *after* RenderSprite
// is loaded so its id increments off the live counter and cannot collide with
// RenderSprite.id. Using the canonical _realEcs.Position is order-dependent:
// its id was baked when components.ts first loaded, which may equal whatever
// the counter happens to be when render-system.ts later evaluates Sprite —
// causing world.add to overwrite the position store with sprite data and
// surfacing as `pos.x = undefined → dstX = NaN` under full-suite runs.
const EcsPosition = _realEcs.defineComponent<{ x: number; y: number }>('Position', () => ({
  x: 0,
  y: 0,
}));

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64, readPixels: () => null };
}

function mockCanvas() {
  return {
    save: () => 0,
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    clear: () => {},
  };
}

// The system subscribes to the query's add / remove signals, so every test
// drives a real World: a hand-rolled query would have to re-implement them.
const Position = EcsPosition;
const Sprite = RenderSprite;

function createECS() {
  const world = new EcsWorld();
  return { world, query: world.query(Position, Sprite) };
}

type TestWorld = ReturnType<typeof createECS>['world'];

const FRAME = { name: 'f', x: 0, y: 0, w: 32, h: 32 };
const IMAGE = mockImage();

/** Spawns a sprite whose `x` doubles as its identity in the captured draw order. */
function spawnSprite(world: TestWorld, x: number, z: number): number {
  const id = world.spawn();
  world.add(id, Position, { x, y: 0 });
  world.add(id, Sprite, { image: IMAGE, frame: FRAME, z });
  return id;
}

/** Runs one frame and returns the `x` of each queued sprite, in draw order. */
function drawnXs(batch: SpriteBatch, renderSystem: () => void): number[] {
  const xs: number[] = [];
  const original = batch.draw;
  batch.draw = (_image, _frame, dstX) => {
    xs.push(dstX);
  };
  renderSystem();
  batch.draw = original;
  return xs;
}

/**
 * A `z` that counts its own numeric reads. `sortByDrawOrder` compares with `>`,
 * which calls `valueOf` on both operands, so `reads / 2` is the number of
 * comparisons a frame made; copying the value between objects reads nothing.
 */
function countedZ(value: number, counter: { reads: number }): number {
  return {
    valueOf(): number {
      counter.reads++;
      return value;
    },
  } as unknown as number;
}

describe('RenderSystem', () => {
  it('queues entities with Position + Sprite into the batch', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const e1 = world.spawn();
    world.add(e1, Position, { x: 10, y: 20 });
    world.add(e1, Sprite, {
      image: mockImage(),
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
    });

    renderer.begin();
    renderSystem();
    batch.flush(() => {}, renderer);
    renderer.end();

    expect(batch.count).toBe(0);
    expect(renderer.stats.drawCalls).toBeGreaterThanOrEqual(1);
  });

  it('sorts by z-order', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const img = mockImage();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    // z=10 first
    const e1 = world.spawn();
    world.add(e1, Position, { x: 100, y: 0 });
    world.add(e1, Sprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 10,
    });

    // z=0 second (should draw first)
    const e2 = world.spawn();
    world.add(e2, Position, { x: 0, y: 0 });
    world.add(e2, Sprite, {
      image: img,
      frame: { name: 'b', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
    });

    // Capture draw order from batch
    const drawPositions: number[] = [];
    const origDraw = batch.draw.bind(batch);
    batch.draw = (image, frame, dstX, dstY, dstW?, dstH?, effect?) => {
      drawPositions.push(dstX);
      origDraw(image, frame, dstX, dstY, dstW, dstH, effect);
    };

    renderSystem();
    // e2 (z=0, x=0) should be drawn before e1 (z=10, x=100)
    expect(drawPositions[0]).toBe(0);
    expect(drawPositions[1]).toBe(100);
  });

  it('handles no matching entities', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    renderer.begin();
    renderSystem(); // Should not throw
    batch.flush(() => {}, renderer);
    renderer.end();
    expect(batch.count).toBe(0);
    expect(renderer.stats.drawCalls).toBe(0);
  });

  it('works with the real @flare-engine/ecs World and canonical Sprite component', () => {
    const world = new EcsWorld();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const query = world.query(EcsPosition, RenderSprite);
    const renderSystem = createRenderSystem(world, query, EcsPosition, RenderSprite, batch);

    const img = mockImage();
    const e1 = world.spawn();
    world.add(e1, EcsPosition, { x: 5, y: 7 });
    world.add(e1, RenderSprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 16, h: 16 },
      z: 0,
    });

    const captured: SpriteDrawCommand[] = [];
    renderer.begin();
    renderSystem();
    batch.flush((_image, commands) => {
      captured.push(...commands.map((c) => ({ ...c })));
    }, renderer);
    renderer.end();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.dstX).toBe(5);
    expect(captured[0]?.dstY).toBe(7);
  });

  it('passes Sprite.effect through to the batch command', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const img = mockImage();
    const fx = tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5);

    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const e1 = world.spawn();
    world.add(e1, Position, { x: 10, y: 20 });
    world.add(e1, Sprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
      effect: fx,
    });

    // Frame owner flushes after the system has queued its draws.
    const captured: SpriteDrawCommand[] = [];
    renderer.begin();
    renderSystem();
    batch.flush((_image, commands) => {
      captured.push(...commands.map((c) => ({ ...c })));
    }, renderer);
    renderer.end();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.effect).toBe(fx);
  });

  it('passes Sprite.rotation through to the batch command', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const img = mockImage();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const e1 = world.spawn();
    world.add(e1, Position, { x: 10, y: 20 });
    world.add(e1, Sprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
      rotation: Math.PI,
    });

    const captured: SpriteDrawCommand[] = [];
    renderer.begin();
    renderSystem();
    batch.flush((_image, commands) => {
      captured.push(...commands.map((c) => ({ ...c })));
    }, renderer);
    renderer.end();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.rotation).toBe(Math.PI);
  });

  it('omitted Sprite.rotation defaults to 0 on the batch command', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const img = mockImage();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const e1 = world.spawn();
    world.add(e1, Position, { x: 0, y: 0 });
    world.add(e1, Sprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
    });

    const captured: SpriteDrawCommand[] = [];
    renderer.begin();
    renderSystem();
    batch.flush((_image, commands) => {
      captured.push(...commands.map((c) => ({ ...c })));
    }, renderer);
    renderer.end();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.rotation).toBe(0);
  });

  it('passes Sprite.anchor through to the batch command', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    renderer.setCanvas(mockCanvas());

    const img = mockImage();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const e1 = world.spawn();
    world.add(e1, Position, { x: 100, y: 200 });
    world.add(e1, Sprite, {
      image: img,
      frame: { name: 'a', x: 0, y: 0, w: 32, h: 32 },
      z: 0,
      anchor: { x: 0.5, y: 0.5 },
    });

    const captured: SpriteDrawCommand[] = [];
    renderer.begin();
    renderSystem();
    batch.flush((_image, commands) => {
      captured.push(...commands.map((c) => ({ ...c })));
    }, renderer);
    renderer.end();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.dstX).toBe(84);
    expect(captured[0]?.dstY).toBe(184);
  });
});

describe('RenderSystem draw order across frames', () => {
  it('pays for spawn-interleaved z layers once, then sorts in linear comparisons', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const n = 400;
    const counter = { reads: 0 };
    const spawned: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const z = 1 - (i % 2);
      spawnSprite(world, i, countedZ(z, counter));
      spawned.push({ x: i, z });
    }
    // Array.prototype.sort is stable, so equal z keeps spawn (add) order.
    const expected = [...spawned].sort((a, b) => a.z - b.z).map((s) => s.x);

    expect(drawnXs(batch, renderSystem)).toEqual(expected);

    for (let frame = 0; frame < 5; frame++) {
      counter.reads = 0;
      expect(drawnXs(batch, renderSystem)).toEqual(expected);
      // A sorted list costs n - 1 comparisons; rebuilding it in query order
      // would cost about n^2 / 8 of them on every one of these frames.
      expect(counter.reads / 2).toBeLessThanOrEqual(n);
    }
  });

  it('draws equal z in add order, whatever swap-remove does to the query', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const first = spawnSprite(world, 1, 0);
    spawnSprite(world, 2, 0);
    spawnSprite(world, 3, 0);
    spawnSprite(world, 4, 0);
    expect(drawnXs(batch, renderSystem)).toEqual([1, 2, 3, 4]);

    // Swap-remove moves the last entity into the first slot of query.entities.
    world.destroy(first);
    spawnSprite(world, 5, 0);
    expect(drawnXs(batch, renderSystem)).toEqual([2, 3, 4, 5]);
  });

  it('re-sorts when a sprite changes z between frames', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const back = spawnSprite(world, 1, 0);
    spawnSprite(world, 2, 1);
    spawnSprite(world, 3, 2);
    expect(drawnXs(batch, renderSystem)).toEqual([1, 2, 3]);

    const sprite = world.get(back, Sprite);
    if (sprite) sprite.z = 5;
    expect(drawnXs(batch, renderSystem)).toEqual([2, 3, 1]);
  });

  it('draws an entity removed and re-added in the same frame once', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const churned = spawnSprite(world, 1, 0);
    spawnSprite(world, 2, 0);
    spawnSprite(world, 3, 1);
    expect(drawnXs(batch, renderSystem)).toEqual([1, 2, 3]);

    world.remove(churned, Sprite);
    world.add(churned, Sprite, { image: IMAGE, frame: FRAME, z: 0 });

    // Re-added, so it now follows the other z = 0 sprite.
    expect(drawnXs(batch, renderSystem)).toEqual([2, 1, 3]);
    expect(drawnXs(batch, renderSystem)).toEqual([2, 1, 3]);
  });

  it('keeps the order through repeated removal and reuse of its slots', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const ids: number[] = [];
    for (let i = 0; i < 10; i++) ids.push(spawnSprite(world, i, i % 3));
    drawnXs(batch, renderSystem);

    for (let i = 0; i < 10; i += 2) world.destroy(ids[i] as number);
    expect(drawnXs(batch, renderSystem)).toEqual([3, 9, 1, 7, 5]);

    spawnSprite(world, 10, 1);
    spawnSprite(world, 11, 0);
    expect(drawnXs(batch, renderSystem)).toEqual([3, 9, 11, 1, 7, 10, 5]);

    for (const id of [...query.entities]) world.destroy(id);
    expect(drawnXs(batch, renderSystem)).toEqual([]);
  });

  it('draws entities that matched the query before the system was created', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    spawnSprite(world, 1, 2);
    spawnSprite(world, 2, 1);

    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    expect(drawnXs(batch, renderSystem)).toEqual([2, 1]);
  });

  it('skips a query member that has no sprite', () => {
    const world = new EcsWorld();
    const batch = new SpriteBatch();
    // Wider than the system expects: every positioned entity matches.
    const query = world.query(Position);
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);

    const bare = world.spawn();
    world.add(bare, Position, { x: 1, y: 0 });
    spawnSprite(world, 2, 0);

    expect(drawnXs(batch, renderSystem)).toEqual([2]);

    world.add(bare, Sprite, { image: IMAGE, frame: FRAME, z: -1 });
    expect(drawnXs(batch, renderSystem)).toEqual([1, 2]);
  });

  it('dispose() drops the query subscriptions and the system stops drawing', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const renderSystem = createRenderSystem(world, query, Position, Sprite, batch);
    const callable: () => void = renderSystem;

    const kept = spawnSprite(world, 1, 0);
    expect(drawnXs(batch, callable)).toEqual([1]);

    const removed: number[] = [];
    query.onEntityRemoved.add((id) => removed.push(id));

    renderSystem.dispose();
    spawnSprite(world, 2, 0);
    world.destroy(kept);

    // The test's own subscription still fires; the system's are gone.
    expect(removed).toEqual([kept]);
    expect(drawnXs(batch, callable)).toEqual([]);
  });
});

// A system that is subscribed but not called (paused, or dropped without
// dispose() while its query lives on) only ever sees the add / remove signals.
describe('RenderSystem storage while the system is not called', () => {
  it('stays bounded through add / remove cycles that leave nothing alive', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const { slotCount } = createProbedRenderSystem(world, query, Position, Sprite, batch);

    for (let i = 0; i < 10_000; i++) world.destroy(spawnSprite(world, i, 0));

    expect(query.entities.length).toBe(0);
    expect(slotCount()).toBeLessThanOrEqual(64);
  });

  it('stays within a constant factor of the live count as the world churns', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const { slotCount } = createProbedRenderSystem(world, query, Position, Sprite, batch);

    let peakLive = 0;
    let peakSlots = 0;
    for (let cycle = 0; cycle < 20; cycle++) {
      const ids: number[] = [];
      for (let i = 0; i < 1000; i++) ids.push(spawnSprite(world, i, 0));
      peakLive = Math.max(peakLive, query.entities.length);
      peakSlots = Math.max(peakSlots, slotCount());
      for (let i = 0; i < 990; i++) world.destroy(ids[i] as number);
    }

    // 20,000 adds in total; 200 are still alive, and at most 1,190 ever were at once.
    expect(query.entities.length).toBe(200);
    expect(peakLive).toBe(1190);
    expect(peakSlots).toBeLessThanOrEqual(2 * peakLive + 1);
    expect(slotCount()).toBeLessThanOrEqual(2 * peakLive + 1);
  });

  it('draws z-sorted with equal z in join order after an add compacted the storage', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const { system, slotCount } = createProbedRenderSystem(world, query, Position, Sprite, batch);

    // 40 joiners over 2 layers; all but four leave, none of it seen by a frame.
    const early: number[] = [];
    for (let i = 0; i < 40; i++) early.push(spawnSprite(world, i, i % 2));
    const kept = new Set([3, 10, 21, 36]);
    for (let i = 0; i < 40; i++) if (!kept.has(i)) world.destroy(early[i] as number);
    expect(slotCount()).toBe(40);

    // One of the survivors leaves and rejoins: it now follows its z peers.
    world.remove(early[10] as number, Sprite);
    world.add(early[10] as number, Sprite, { image: IMAGE, frame: FRAME, z: 0 });

    // These joins reclaim the dead slots without a frame having run.
    for (let i = 100; i < 140; i++) spawnSprite(world, i, i % 2);
    expect(query.entities.length).toBe(44);
    expect(slotCount()).toBeLessThan(40 + 1 + 40);

    const evens: number[] = [];
    const odds: number[] = [];
    for (let i = 100; i < 140; i++) (i % 2 === 0 ? evens : odds).push(i);
    const expected = [36, 10, ...evens, 3, 21, ...odds];
    expect(drawnXs(batch, system)).toEqual(expected);
    expect(drawnXs(batch, system)).toEqual(expected);

    // A later joiner still lands behind everything at its z.
    spawnSprite(world, 200, 0);
    expect(drawnXs(batch, system)).toEqual([36, 10, ...evens, 200, 3, 21, ...odds]);
  });

  it('draws nothing twice when entities leave and rejoin around a compaction', () => {
    const { world, query } = createECS();
    const batch = new SpriteBatch();
    const { system } = createProbedRenderSystem(world, query, Position, Sprite, batch);

    const ids: number[] = [];
    for (let i = 0; i < 30; i++) ids.push(spawnSprite(world, i, 0));
    for (let round = 0; round < 50; round++) {
      for (let i = 0; i < 30; i++) {
        world.remove(ids[i] as number, Sprite);
        world.add(ids[i] as number, Sprite, { image: IMAGE, frame: FRAME, z: 0 });
      }
    }

    const expected: number[] = [];
    for (let i = 0; i < 30; i++) expected.push(i);
    expect(drawnXs(batch, system)).toEqual(expected);
  });
});
