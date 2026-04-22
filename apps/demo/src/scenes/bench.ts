import type { GameContextValue, Scene } from '@flare-engine/engine';
import { CollisionWorld, Position, Velocity } from '@flare-engine/engine';
import { SeededRNG } from '@flare-engine/math';
import { Layer } from '../layers';
import type { AtlasHandle } from '../spawn';
import { spawnBullet, spawnEnemy } from '../spawn';
import { destroyEntity } from '../systems/entity-ops';

export interface BenchSceneDeps {
  ctx: GameContextValue;
  atlas: AtlasHandle;
}

interface BenchLoad {
  label: string;
  enemies: number;
  bullets: number;
}

const LOADS: BenchLoad[] = [
  { label: 'light', enemies: 10, bullets: 50 },
  { label: 'medium', enemies: 30, bullets: 150 },
  { label: 'heavy', enemies: 50, bullets: 300 },
];

const SECONDS_PER_LOAD = 10;

interface BenchState {
  coll: CollisionWorld;
  loadIndex: number;
  elapsed: number;
  sampleAccum: number;
  samples: Record<string, number[]>;
  spawned: number[];
  rng: SeededRNG;
}

function spawnLoad(deps: BenchSceneDeps, state: BenchState, load: BenchLoad): void {
  const { ctx, atlas } = deps;
  const spawnCtx = { world: ctx.world, coll: state.coll, atlas };
  const W = 360;
  const H = 640;
  const rng = state.rng;
  for (let i = 0; i < load.enemies; i++) {
    const x = 24 + rng.next() * (W - 48);
    const y = 40 + rng.next() * (H * 0.6);
    const pattern = i % 3 === 0 ? 'sine' : i % 3 === 1 ? 'diagonal' : 'straight';
    const id = spawnEnemy(spawnCtx, pattern, x, y);
    state.spawned.push(id);
  }
  for (let i = 0; i < load.bullets; i++) {
    const x = 16 + rng.next() * (W - 32);
    const y = 16 + rng.next() * (H - 32);
    const angle = rng.next() * Math.PI * 2;
    const speed = 60 + rng.next() * 80;
    const layer = i % 2 === 0 ? Layer.playerBullet : Layer.enemyBullet;
    const id = spawnBullet(
      spawnCtx,
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      layer === Layer.playerBullet ? Layer.player : Layer.enemy,
    );
    state.spawned.push(id);
  }
}

function clearLoad(ctx: GameContextValue, state: BenchState): void {
  for (const id of state.spawned) destroyEntity(ctx.world, state.coll, id);
  state.spawned.length = 0;
}

function dumpCsv(state: BenchState): void {
  const header = 'load,sample_index,fps';
  const rows: string[] = [header];
  for (const load of LOADS) {
    const samples = state.samples[load.label] ?? [];
    samples.forEach((fps, i) => {
      rows.push(`${load.label},${i},${fps.toFixed(2)}`);
    });
  }
  console.log('--- BENCH FPS CSV BEGIN ---');
  console.log(rows.join('\n'));
  console.log('--- BENCH FPS CSV END ---');

  const summary: string[] = ['', 'Per-load summary:'];
  for (const load of LOADS) {
    const samples = state.samples[load.label] ?? [];
    if (samples.length === 0) {
      summary.push(`  ${load.label}: no samples`);
      continue;
    }
    let min = samples[0] as number;
    let max = samples[0] as number;
    let sum = 0;
    for (const v of samples) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const avg = sum / samples.length;
    summary.push(
      `  ${load.label} (${load.enemies}e+${load.bullets}b): min=${min.toFixed(
        1,
      )} avg=${avg.toFixed(1)} max=${max.toFixed(1)} n=${samples.length}`,
    );
  }
  console.log(summary.join('\n'));
}

export function createBenchScene(deps: BenchSceneDeps): () => Scene {
  const { ctx } = deps;
  return () => {
    let state: BenchState | null = null;
    return {
      name: 'bench',
      world: ctx.world,
      camera: deps.ctx.scenes.current?.camera ?? null!,
      onEnter() {
        const w = ctx.camera.viewportWidth || 360;
        const h = ctx.camera.viewportHeight || 640;
        ctx.camera.x = w / 2;
        ctx.camera.y = h / 2;
        ctx.camera.zoom = 1;
        ctx.camera.rotation = 0;
        const coll = new CollisionWorld();
        state = {
          coll,
          loadIndex: 0,
          elapsed: 0,
          sampleAccum: 0,
          samples: { light: [], medium: [], heavy: [] },
          spawned: [],
          rng: new SeededRNG(1337),
        };
        spawnLoad(deps, state, LOADS[0] as BenchLoad);
        console.log('[bench] starting — 3 loads x 10s each');
      },
      onUpdate(dt: number) {
        if (!state) return;
        state.elapsed += dt;
        state.sampleAccum += dt;
        if (state.sampleAccum >= 1) {
          state.sampleAccum -= 1;
          const load = LOADS[state.loadIndex] as BenchLoad;
          const fps = ctx.loop.clock.fps;
          (state.samples[load.label] as number[]).push(fps);
        }

        // Integrate positions and bounce off the viewport edges so the
        // scene actually moves — exercises render + collision each frame.
        const W = ctx.camera.viewportWidth || 360;
        const H = ctx.camera.viewportHeight || 640;
        for (const id of state.spawned) {
          const p = ctx.world.get(id, Position);
          const v = ctx.world.get(id, Velocity);
          if (!p || !v) continue;
          p.x += v.x * dt;
          p.y += v.y * dt;
          if (p.x < 0 && v.x < 0) v.x = -v.x;
          else if (p.x > W && v.x > 0) v.x = -v.x;
          if (p.y < 0 && v.y < 0) v.y = -v.y;
          else if (p.y > H && v.y > 0) v.y = -v.y;
          state.coll.setPosition(id, p.x, p.y);
        }
        state.coll.step();

        if (state.elapsed >= SECONDS_PER_LOAD) {
          state.elapsed = 0;
          clearLoad(ctx, state);
          state.loadIndex++;
          if (state.loadIndex >= LOADS.length) {
            dumpCsv(state);
            void ctx.scenes.go('menu');
            return;
          }
          spawnLoad(deps, state, LOADS[state.loadIndex] as BenchLoad);
          console.log(`[bench] load ${state.loadIndex + 1}/${LOADS.length}`);
        }
      },
      onExit() {
        if (state) clearLoad(ctx, state);
        state = null;
      },
    };
  };
}
