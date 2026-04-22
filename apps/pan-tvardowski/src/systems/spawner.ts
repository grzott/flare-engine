import type { EnemyPattern } from '../components';
import { mulberry32 } from '../util/rng';

export interface WaveEntry {
  t: number;
  count: number;
  pattern: EnemyPattern;
  spacing: number;
  startX: number;
}

export interface SpawnEvent {
  pattern: EnemyPattern;
  x: number;
  y: number;
  seed: number;
}

export interface SpawnerState {
  t: number;
  nextIndex: number;
  done: boolean;
  spawnSeq: number;
}

export function createSpawnerState(): SpawnerState {
  return { t: 0, nextIndex: 0, done: false, spawnSeq: 0 };
}

export function tickSpawner(
  state: SpawnerState,
  schedule: readonly WaveEntry[],
  dt: number,
  out: SpawnEvent[],
): void {
  state.t += dt;
  while (state.nextIndex < schedule.length) {
    const wave = schedule[state.nextIndex];
    if (!wave || state.t < wave.t) break;
    for (let i = 0; i < wave.count; i++) {
      out.push({
        pattern: wave.pattern,
        x: wave.startX + i * wave.spacing,
        y: -40,
        seed: state.spawnSeq++,
      });
    }
    state.nextIndex++;
  }
  if (state.nextIndex >= schedule.length) state.done = true;
}

/**
 * Build a deterministic Zone-1 wave schedule for the given seed. Only
 * Skrzat + Latawiec spawn. Spans ~130 s (boss enters at 150 s per §BOSS_SPAWN_T).
 */
export function buildZone1Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = mulberry32(seed);
  const schedule: WaveEntry[] = [];
  let t = 3;
  while (t < 130) {
    const roll = rand();
    const pattern: EnemyPattern = roll < 0.65 ? 'skrzat' : 'latawiec';
    const count = pattern === 'skrzat' ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
    const spacing = 42;
    const maxStart = viewportWidth - (count - 1) * spacing - 40;
    const startX = 40 + rand() * Math.max(1, maxStart);
    schedule.push({ t, count, pattern, spacing, startX });
    t += 2.2 + rand() * 1.8;
  }
  return schedule;
}

/**
 * Build a deterministic Zone-2 wave schedule. Only Czart + Bies spawn.
 * Spans ~80 s before the miniboss gate at 90 s, then a lighter 80 s stretch
 * before the boss at 200 s.
 */
export function buildZone2Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = mulberry32(seed);
  const schedule: WaveEntry[] = [];
  const pushWaves = (from: number, to: number, intensity: number): number => {
    let t = from;
    while (t < to) {
      const roll = rand();
      const pattern: EnemyPattern = roll < 0.55 ? 'czart' : 'bies';
      const count = 1 + Math.floor(rand() * (pattern === 'czart' ? 2 : 3));
      const spacing = 50;
      const maxStart = viewportWidth - (count - 1) * spacing - 40;
      const startX = 40 + rand() * Math.max(1, maxStart);
      schedule.push({ t, count, pattern, spacing, startX });
      t += 2.4 + rand() * (3.0 - intensity);
    }
    return t;
  };
  pushWaves(3, 80, 1.2); // pre-miniboss
  pushWaves(110, 185, 1.4); // post-miniboss → pre-boss
  return schedule;
}
