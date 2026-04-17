import {
  Position,
  type Query,
  Velocity,
  World,
  _resetComponentIds,
  defineSystem,
} from '@flare/ecs';
import { SeededRNG } from '@flare/math';
import { ParticleEmitter } from '@flare/particles';
import { AABB, CollisionWorld } from '@flare/physics';
import { type Drawable, SpriteBatch, sortByDrawOrder } from '@flare/render';
import { type BenchStats, runBench } from './harness.js';

interface SkImageStub {
  width(): number;
  height(): number;
}

type IntegrationState = {
  world: World;
  coll: CollisionWorld;
  emitter: ParticleEmitter;
  batch: SpriteBatch;
  image: SkImageStub;
  drawAtlas: () => void;
  entityIds: number[];
  sprites: { z: number }[];
  entityCount: number;
  posQuery: Query;
};

const DT = 1 / 60;
const PARTICLE_COUNT = 300;

function buildState(entityCount: number): IntegrationState {
  _resetComponentIds();
  const world = new World();
  const coll = new CollisionWorld();
  const rng = new SeededRNG(0xf1a8e);

  const entityIds: number[] = new Array(entityCount);
  const sprites: { z: number }[] = new Array(entityCount);

  for (let i = 0; i < entityCount; i++) {
    const id = world.spawn();
    const x = rng.float(0, 800);
    const y = rng.float(0, 600);
    world.add(id, Position, { x, y });
    world.add(id, Velocity, { x: rng.float(-60, 60), y: rng.float(-60, 60) });
    coll.add(id, AABB(12, 12), x, y);
    entityIds[i] = id;
    sprites[i] = { z: rng.float(0, 100) };
  }

  const moveQuery = world.query(Position, Velocity);
  const moveSys = defineSystem(moveQuery, (entities, dt, w) => {
    for (const id of entities) {
      const p = w.get(id, Position);
      const v = w.get(id, Velocity);
      if (p && v) {
        p.x += v.x * dt;
        p.y += v.y * dt;
      }
    }
  });
  world.addSystem(moveSys._worldFn);

  const posQuery = world.query(Position);

  const emitter = new ParticleEmitter(
    {
      rate: 0,
      lifetime: 1_000_000,
      speed: 40,
      direction: 0,
      spread: Math.PI,
      gravityY: 0,
      startSize: 3,
      endSize: 0,
      startAlpha: 1,
      endAlpha: 0,
      maxParticles: PARTICLE_COUNT,
    },
    PARTICLE_COUNT,
  );
  emitter.burst(PARTICLE_COUNT);
  emitter.emitting = false;

  const batch = new SpriteBatch();
  const image: SkImageStub = { width: () => 256, height: () => 256 };
  const drawAtlas = (): void => {};

  return {
    world,
    coll,
    emitter,
    batch,
    image,
    drawAtlas,
    entityIds,
    sprites,
    entityCount,
    posQuery,
  };
}

function frame(state: IntegrationState): void {
  state.world.step(DT);

  for (const id of state.posQuery) {
    const p = state.world.get(id, Position);
    if (p) state.coll.setPosition(id, p.x, p.y);
  }
  state.coll.step();

  state.emitter.update(DT);

  sortByDrawOrder<Drawable>(state.sprites);

  const n = state.entityCount;
  const img = state.image as unknown as Parameters<typeof state.batch.drawRaw>[0];
  for (let i = 0; i < n; i++) {
    state.batch.drawRaw(img, 0, 0, 12, 12, (i * 7) % 800, (i * 11) % 600, 12, 12);
  }
  state.batch.flush(state.drawAtlas);
}

export function integrationBenches(): BenchStats[] {
  return [500, 1000, 2000].map((n) =>
    runBench({
      name: `integration.frame  ${n.toString().padStart(4)} entities + ${PARTICLE_COUNT}p`,
      setup: () => buildState(n),
      run: frame,
      innerIters: n >= 2000 ? 20 : n >= 1000 ? 40 : 100,
      samples: 30,
    }),
  );
}

export type HeapDeltaResult = {
  name: string;
  iterations: number;
  deltaBytes: number;
  bytesPerFrame: number;
};

declare const Bun: { gc(force: boolean): void } | undefined;

export function integrationHeapDelta(iterations = 500): HeapDeltaResult[] {
  const results: HeapDeltaResult[] = [];
  for (const n of [500, 1000, 2000]) {
    const state = buildState(n);
    for (let w = 0; w < 30; w++) frame(state);
    if (typeof Bun !== 'undefined') Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < iterations; i++) frame(state);
    if (typeof Bun !== 'undefined') Bun.gc(true);
    const after = process.memoryUsage().heapUsed;
    const deltaBytes = after - before;
    results.push({
      name: `integration.heap  ${n.toString().padStart(4)} entities`,
      iterations,
      deltaBytes,
      bytesPerFrame: deltaBytes / iterations,
    });
  }
  return results;
}
