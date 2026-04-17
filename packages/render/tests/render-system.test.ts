import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare/assets';
import { Position as EcsPosition, World as EcsWorld } from '@flare/ecs';
import type { ComponentDef, Query, World } from '@flare/ecs';
import { Sprite as RenderSprite, createRenderSystem } from '../src/render-system.js';
import type { PositionData, SpriteData } from '../src/render-system.js';
import { Renderer } from '../src/renderer.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { tint } from '../src/sprite-effects.js';

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64 };
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

/**
 * Create a minimal mock World+Query for testing the render system
 * without requiring the actual @flare/ecs runtime.
 */
function createMockECS() {
  const entities = new Map<number, Map<unknown, unknown>>();
  let nextId = 1;

  const queryEntities = new Set<number>();

  const world = {
    spawn(): number {
      const id = nextId++;
      entities.set(id, new Map());
      return id;
    },
    add<T>(entityId: number, def: ComponentDef<T>, data: T): void {
      const comps = entities.get(entityId)!;
      comps.set(def, data);
      queryEntities.add(entityId);
    },
    get<T>(entityId: number, def: ComponentDef<T>): T | undefined {
      return entities.get(entityId)?.get(def) as T | undefined;
    },
  } as unknown as World;

  const query = {
    [Symbol.iterator](): IterableIterator<number> {
      return queryEntities.values();
    },
    get count() {
      return queryEntities.size;
    },
  } as unknown as Query;

  return { world, query };
}

const Position = {
  id: 0,
  bit: 1,
  name: 'Position',
  create: () => ({ x: 0, y: 0 }),
} as unknown as ComponentDef<PositionData>;
const Sprite = {
  id: 1,
  bit: 2,
  name: 'Sprite',
  create: () => ({
    image: mockImage(),
    frame: { name: 'default', x: 0, y: 0, w: 32, h: 32 },
    z: 0,
  }),
} as unknown as ComponentDef<SpriteData>;
describe('RenderSystem', () => {
  it('queues entities with Position + Sprite into the batch', () => {
    const { world, query } = createMockECS();
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
    const { world, query } = createMockECS();
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
    const { world, query } = createMockECS();
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

  it('works with the real @flare/ecs World and canonical Sprite component', () => {
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
    const { world, query } = createMockECS();
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
});
