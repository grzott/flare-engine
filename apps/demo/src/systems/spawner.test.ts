import { describe, expect, it } from 'bun:test';
import type { SpawnEvent, WaveEntry } from './spawner';
import { createSpawnerState, tickSpawner } from './spawner';

const schedule: readonly WaveEntry[] = [
  { t: 1, count: 2, pattern: 'straight', spacing: 10, startX: 100 },
  { t: 3, count: 3, pattern: 'sine', spacing: 20, startX: 50 },
];

describe('tickSpawner', () => {
  it('spawns nothing before the first wave', () => {
    const state = createSpawnerState();
    const out: SpawnEvent[] = [];
    tickSpawner(state, schedule, 0.5, out);
    expect(out.length).toBe(0);
    expect(state.nextIndex).toBe(0);
    expect(state.done).toBe(false);
  });

  it('spawns the first wave at its scheduled time', () => {
    const state = createSpawnerState();
    const out: SpawnEvent[] = [];
    tickSpawner(state, schedule, 1, out);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({ pattern: 'straight', x: 100, y: -40 });
    expect(out[1]).toEqual({ pattern: 'straight', x: 110, y: -40 });
    expect(state.nextIndex).toBe(1);
  });

  it('spawns multiple waves in one tick if dt is large', () => {
    const state = createSpawnerState();
    const out: SpawnEvent[] = [];
    tickSpawner(state, schedule, 5, out);
    expect(out.length).toBe(5);
    expect(state.done).toBe(true);
  });

  it('accumulates time across ticks', () => {
    const state = createSpawnerState();
    const out: SpawnEvent[] = [];
    tickSpawner(state, schedule, 0.4, out);
    tickSpawner(state, schedule, 0.7, out);
    expect(out.length).toBe(2);
    expect(state.nextIndex).toBe(1);
  });

  it('marks done when all waves have fired', () => {
    const state = createSpawnerState();
    const out: SpawnEvent[] = [];
    tickSpawner(state, schedule, 10, out);
    expect(state.done).toBe(true);
  });
});
