import {
  _resetComponentIds,
  defineSystem,
  Position,
  type Query,
  Velocity,
  World,
} from '@flare-engine/ecs';
import { ParticleEmitter } from '@flare-engine/particles';
import { AABB, CollisionWorld } from '@flare-engine/physics';
import {
  createFrameRenderer,
  type Drawable,
  type FrameRenderer,
  SpriteBatch,
  type SpriteDrawCommand,
  sortByDrawOrder,
} from '@flare-engine/render';
import { createBenchSession } from '@flare-engine/testing';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { createCountingSkiaStub, makeStubImage, type SkiaStub } from './skia-stub.js';

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

export type IntegrationState = {
  world: World;
  coll: CollisionWorld;
  emitter: ParticleEmitter;
  batch: SpriteBatch;
  renderer: FrameRenderer;
  stub: SkiaStub;
  image: BatchImage;
  draw: (image: BatchImage, commands: SpriteDrawCommand[]) => void;
  entityIds: number[];
  sprites: { z: number }[];
  entityCount: number;
  posQuery: Query;
};

const DT = 1 / 60;
const PARTICLE_COUNT = 300;
const SPRITE = 12;

/**
 * Play-field bounds. Entities wrap at the edges instead of integrating away
 * forever: with unbounded motion a "dense" scene disperses to a sparse one
 * while it is being measured (contact count fell 569 -> 162 -> 14 over 2000
 * frames), so the median depended on the sampler configuration and no two
 * captures measured the same workload.
 */
export const FIELD_W = 800;
export const FIELD_H = 600;

export function buildState(entityCount: number, strict = false): IntegrationState {
  const session = createBenchSession({ seed: 0xf1a8e });
  try {
    _resetComponentIds();
    const world = new World();
    const coll = new CollisionWorld();

    const entityIds: number[] = new Array(entityCount);
    const sprites: { z: number }[] = new Array(entityCount);

    for (let i = 0; i < entityCount; i++) {
      const id = world.spawn();
      const x = session.rng.float(0, FIELD_W);
      const y = session.rng.float(0, FIELD_H);
      world.add(id, Position, { x, y });
      world.add(id, Velocity, { x: session.rng.float(-60, 60), y: session.rng.float(-60, 60) });
      coll.add(id, AABB(SPRITE, SPRITE), x, y);
      entityIds[i] = id;
      sprites[i] = { z: session.rng.float(0, 100) };
    }

    const moveQuery = world.query(Position, Velocity);
    const moveSys = defineSystem(moveQuery, (entities, dt, w) => {
      for (const id of entities) {
        const p = w.get(id, Position);
        const v = w.get(id, Velocity);
        if (p && v) {
          p.x += v.x * dt;
          p.y += v.y * dt;
          // Wrap, not clamp: clamping piles entities on the edges and inflates
          // the contact count instead of holding it steady. Max travel is 1 px
          // per frame, so one conditional per axis is exact.
          if (p.x < 0) p.x += FIELD_W;
          else if (p.x >= FIELD_W) p.x -= FIELD_W;
          if (p.y < 0) p.y += FIELD_H;
          else if (p.y >= FIELD_H) p.y -= FIELD_H;
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
      // Seed stated rather than inherited: the emitter's own default is 1, so
      // this suite was deterministic only by omission.
      { maxParticles: PARTICLE_COUNT, seed: 1 },
    );
    emitter.burst(PARTICLE_COUNT);
    emitter.emitting = false;

    const batch = new SpriteBatch();
    const stub = createCountingSkiaStub({ strict });
    const renderer = createFrameRenderer(stub.module);
    const image = makeStubImage(256, 256);
    const draw = (img: BatchImage, commands: SpriteDrawCommand[]): void => {
      renderer.drawAtlas(img, commands);
    };

    return {
      world,
      coll,
      emitter,
      batch,
      renderer,
      stub,
      image,
      draw,
      entityIds,
      sprites,
      entityCount,
      posQuery,
    };
  } finally {
    session.end();
  }
}

export function frame(state: IntegrationState): void {
  state.world.step(DT);

  for (const id of state.posQuery) {
    const p = state.world.get(id, Position);
    if (p) state.coll.setPosition(id, p.x, p.y);
  }
  state.coll.step();

  state.emitter.update(DT);

  sortByDrawOrder<Drawable>(state.sprites);

  state.renderer.beginFrame(FIELD_W, FIELD_H);
  const n = state.entityCount;
  const img = state.image;
  for (let i = 0; i < n; i++) {
    state.batch.drawRaw(
      img,
      0,
      0,
      SPRITE,
      SPRITE,
      (i * 7) % FIELD_W,
      (i * 11) % FIELD_H,
      SPRITE,
      SPRITE,
    );
  }
  state.batch.flush(state.draw);
  state.renderer.endFrame();
}

/**
 * Machine-checked stationarity: returns the number of entities that escaped the
 * play field. Any non-zero value means the workload drifted while it was being
 * measured and the row's median is not comparable to any other capture.
 */
export function outOfBoundsCount(state: IntegrationState): number {
  let escaped = 0;
  for (const id of state.posQuery) {
    const p = state.world.get(id, Position);
    if (!p) continue;
    if (p.x < 0 || p.x >= FIELD_W || p.y < 0 || p.y >= FIELD_H) escaped++;
  }
  return escaped;
}

const INTEGRATION_SCENARIOS: readonly { n: number; innerIters: number }[] = [
  { n: 500, innerIters: 1 },
  { n: 1000, innerIters: 1 },
  { n: 2000, innerIters: 1 },
];

export function integrationBenches(overrides?: BenchOverrides): BenchStats[] {
  return INTEGRATION_SCENARIOS.map(({ n, innerIters }) =>
    runBench(
      {
        name: `integration.frame  ${n.toString().padStart(4)} entities + ${PARTICLE_COUNT}p`,
        setup: () => buildState(n),
        run: frame,
        innerIters,
      },
      overrides,
    ),
  );
}
