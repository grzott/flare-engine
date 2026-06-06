import { SeededRNG } from '@flare-engine/math';
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

interface WaveParams {
  pick: (roll: number) => EnemyPattern;
  count: (pattern: EnemyPattern, r: number) => number;
  spacing: (pattern: EnemyPattern) => number;
  timing: (r: number) => number;
}

function pushWaves(
  rand: SeededRNG,
  schedule: WaveEntry[],
  viewportWidth: number,
  from: number,
  to: number,
  p: WaveParams,
): void {
  let t = from;
  while (t < to) {
    const pattern = p.pick(rand.next()); // draw 1
    const count = p.count(pattern, rand.next()); // draw 2 (UNCONDITIONAL)
    const spacing = p.spacing(pattern);
    const maxStart = viewportWidth - (count - 1) * spacing - 40;
    const startX = 40 + rand.next() * Math.max(1, maxStart); // draw 3
    schedule.push({ t, count, pattern, spacing, startX });
    t += p.timing(rand.next()); // draw 4
  }
}

/**
 * Build a deterministic Zone-1 wave schedule for the given seed. Only
 * Skrzat + Latawiec spawn. Spans ~130 s (boss enters at 150 s per §BOSS_SPAWN_T).
 */
export function buildZone1Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  pushWaves(rand, schedule, viewportWidth, 3, 130, {
    pick: (r) => (r < 0.65 ? 'skrzat' : 'latawiec'),
    count: (p, r) => (p === 'skrzat' ? 3 + Math.floor(r * 3) : 1 + Math.floor(r * 2)),
    spacing: () => 42,
    timing: (r) => 2.2 + r * 1.8,
  });
  return schedule;
}

/**
 * Build a deterministic Zone-2 wave schedule. Only Czart + Bies spawn.
 * Spans ~80 s before the miniboss gate at 90 s, then a lighter 80 s stretch
 * before the boss at 200 s.
 */
export function buildZone2Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  const params = (intensity: number): WaveParams => ({
    pick: (r) => (r < 0.55 ? 'czart' : 'bies'),
    count: (p, r) => 1 + Math.floor(r * (p === 'czart' ? 2 : 3)),
    spacing: () => 50,
    timing: (r) => 2.4 + r * (3.0 - intensity),
  });
  pushWaves(rand, schedule, viewportWidth, 3, 80, params(1.2)); // pre-miniboss
  pushWaves(rand, schedule, viewportWidth, 110, 185, params(1.4)); // post-miniboss → pre-boss
  return schedule;
}

/**
 * Build a deterministic Zone-3 wave schedule. Only Topielec + Strzyga spawn.
 * No miniboss in Zone 3; schedule fills the stretch before the boss at 220 s.
 */
export function buildZone3Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  pushWaves(rand, schedule, viewportWidth, 3, 200, {
    pick: (r) => (r < 0.5 ? 'topielec' : 'strzyga'),
    count: (p, r) => (p === 'topielec' ? 1 + Math.floor(r * 2) : 2 + Math.floor(r * 2)),
    spacing: (p) => (p === 'topielec' ? 80 : 56),
    timing: (r) => 2.6 + r * 1.8,
  });
  return schedule;
}

/**
 * Build a deterministic Zone-4 wave schedule. Only Mamuna + Licho spawn.
 * Pre-miniboss stretch 3..90 s (miniboss gate at 100 s), then a
 * post-miniboss stretch 120..215 s before the boss gate at 230 s.
 */
export function buildZone4Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  const params = (intensity: number): WaveParams => ({
    pick: (r) => (r < 0.55 ? 'mamuna' : 'licho'),
    count: (p, r) => (p === 'mamuna' ? 1 + Math.floor(r * 3) : 1 + Math.floor(r * 2)),
    spacing: (p) => (p === 'mamuna' ? 48 : 64),
    timing: (r) => 2.5 + r * (3.2 - intensity),
  });
  pushWaves(rand, schedule, viewportWidth, 3, 90, params(1.3)); // pre-miniboss
  pushWaves(rand, schedule, viewportWidth, 120, 215, params(1.5)); // post-miniboss → pre-boss
  return schedule;
}

/**
 * Build a deterministic Zone-5 wave schedule. Only Nocnica + Dziwożona spawn.
 * No miniboss in Zone 5; schedule fills the stretch before the boss at 260 s.
 */
export function buildZone5Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  pushWaves(rand, schedule, viewportWidth, 3, 245, {
    pick: (r) => (r < 0.6 ? 'nocnica' : 'dziwozona'),
    count: (p, r) => (p === 'nocnica' ? 2 + Math.floor(r * 3) : 1 + Math.floor(r * 2)),
    spacing: (p) => (p === 'nocnica' ? 40 : 70),
    timing: (r) => 2.3 + r * 1.6,
  });
  return schedule;
}

/**
 * Build a deterministic Zone-6 wave schedule. Only Wąpierz + Południca spawn.
 * Pre-miniboss stretch 3..90 s (miniboss gate at 100 s), then a post-miniboss
 * stretch 120..275 s before the boss gate at 290 s.
 */
export function buildZone6Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  const params = (intensity: number): WaveParams => ({
    pick: (r) => (r < 0.55 ? 'wapierz' : 'poludnica'),
    count: (p, r) =>
      // Wąpierz is slow + tanky — fewer but bigger waves.
      // Południca sweeps horizontally — pairs or triples.
      p === 'wapierz' ? 1 + Math.floor(r * 2) : 2 + Math.floor(r * 2),
    spacing: (p) => (p === 'wapierz' ? 64 : 56),
    timing: (r) => 2.8 + r * (3.4 - intensity),
  });
  pushWaves(rand, schedule, viewportWidth, 3, 90, params(1.4)); // pre-miniboss
  pushWaves(rand, schedule, viewportWidth, 120, 275, params(1.6)); // post-miniboss → pre-boss
  return schedule;
}

/**
 * Build a deterministic Zone-7 wave schedule. The Karczma "Rzym" is the final
 * gauntlet before the moon — any of the 12 prior enemies may appear. Pre-Madej
 * gate at 105 s, pre-Mefistofeles gate at 300 s.
 */
export function buildZone7Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  const POOL: readonly EnemyPattern[] = [
    'skrzat',
    'latawiec',
    'czart',
    'bies',
    'licho',
    'strzyga',
    'topielec',
    'mamuna',
    'nocnica',
    'poludnica',
    'wapierz',
    'dziwozona',
  ];
  const params = (intensity: number): WaveParams => ({
    pick: (r) => POOL[Math.floor(r * POOL.length)] ?? 'skrzat',
    count: (_p, r) => 1 + Math.floor(r * 3),
    spacing: () => 48,
    timing: (r) => 2.4 + r * (3.0 - intensity),
  });
  pushWaves(rand, schedule, viewportWidth, 3, 95, params(1.3)); // pre-miniboss
  pushWaves(rand, schedule, viewportWidth, 120, 285, params(1.7)); // post-miniboss → pre-boss
  return schedule;
}

/**
 * Build a deterministic Zone-8 wave schedule. Moon surface — the moon-wraith
 * is the only enemy (palette-swap §5), mixed with sparse Nocnica swarms.
 * No miniboss; boss gate at `ZONE8_BOSS_T` (340 s).
 */
export function buildZone8Schedule(seed: number, viewportWidth = 360): WaveEntry[] {
  const rand = new SeededRNG(seed);
  const schedule: WaveEntry[] = [];
  pushWaves(rand, schedule, viewportWidth, 3, 325, {
    pick: (r) => (r < 0.7 ? 'moon-wraith' : 'nocnica'),
    count: (p, r) => (p === 'moon-wraith' ? 2 + Math.floor(r * 3) : 1 + Math.floor(r * 2)),
    spacing: () => 46,
    timing: (r) => 2.2 + r * 1.8,
  });
  return schedule;
}
