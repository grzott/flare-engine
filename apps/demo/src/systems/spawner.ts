import type { EnemyPattern } from '../components';

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
}

export interface SpawnerState {
  t: number;
  nextIndex: number;
  done: boolean;
}

export function createSpawnerState(): SpawnerState {
  return { t: 0, nextIndex: 0, done: false };
}

export function tickSpawner(
  state: SpawnerState,
  schedule: readonly WaveEntry[],
  dt: number,
  out: SpawnEvent[],
): void {
  state.t += dt;
  while (state.nextIndex < schedule.length) {
    const wave = schedule[state.nextIndex]!;
    if (state.t < wave.t) break;
    for (let i = 0; i < wave.count; i++) {
      out.push({
        pattern: wave.pattern,
        x: wave.startX + i * wave.spacing,
        y: -40,
      });
    }
    state.nextIndex++;
  }
  if (state.nextIndex >= schedule.length) state.done = true;
}
