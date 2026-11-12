import { Position, World } from '@flare-engine/ecs';
import { createRenderSystem, type RenderSystem, Sprite, SpriteBatch } from '@flare-engine/render';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { RENDER_SYSTEM_SCENARIOS, type RenderSystemScenario } from './scenarios/render-system.js';
import { makeStubImage } from './skia-stub.js';

const VIEW_W = 800;
const VIEW_H = 600;
const SPRITE = 16;

export type RenderSystemState = {
  readonly batch: SpriteBatch;
  readonly system: RenderSystem;
  queued: number;
};

/**
 * Spawns after the system exists, as a game does under `<GameView>`, and gives
 * entity `i` the layer `i % zLayers`. Spawn order therefore disagrees with draw
 * order on almost every neighbouring pair, which is the input a system that
 * re-derived its order from the query each frame would have to re-sort each frame.
 */
export function buildRenderSystemState(scenario: RenderSystemScenario): RenderSystemState {
  const world = new World();
  const batch = new SpriteBatch();
  const system = createRenderSystem(world, world.query(Position, Sprite), Position, Sprite, batch);
  const image = makeStubImage(256, 256);
  const frame = { name: 'sprite', x: 0, y: 0, w: SPRITE, h: SPRITE };

  for (let i = 0; i < scenario.count; i++) {
    const id = world.spawn();
    world.add(id, Position, { x: (i * 7) % VIEW_W, y: (i * 11) % VIEW_H });
    world.add(id, Sprite, { image, frame, z: i % scenario.zLayers });
  }
  return { batch, system, queued: 0 };
}

/**
 * One frame of the system, then `clear()` hands the commands back to the
 * batch's pool. Flushing is the Render suite's cost; this row is the system's
 * own share: the z refresh, the sort and the per-sprite `batch.draw`.
 */
export function renderSystemRun(state: RenderSystemState): void {
  state.system();
  state.queued = state.batch.count;
  state.batch.clear();
}

export function renderSystemBenches(overrides?: BenchOverrides): BenchStats[] {
  return RENDER_SYSTEM_SCENARIOS.map((scenario) =>
    runBench(
      {
        name: scenario.name,
        setup: () => buildRenderSystemState(scenario),
        run: renderSystemRun,
        innerIters: scenario.innerIters,
      },
      overrides,
    ),
  );
}
