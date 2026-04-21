import type { WaveEntry } from '../systems/spawner';

/**
 * Default enemy wave schedule. Data-driven — edit here to retune the demo;
 * `systems/spawner.ts` is the consumer.
 */
export const DEFAULT_WAVE_SCHEDULE: readonly WaveEntry[] = [
  { t: 1.5, count: 5, pattern: 'straight', spacing: 48, startX: 60 },
  { t: 4.5, count: 4, pattern: 'sine', spacing: 56, startX: 80 },
  { t: 7.5, count: 3, pattern: 'diagonal', spacing: 64, startX: 70 },
  { t: 10.5, count: 6, pattern: 'straight', spacing: 40, startX: 40 },
  { t: 14, count: 4, pattern: 'sine', spacing: 60, startX: 50 },
  { t: 18, count: 5, pattern: 'diagonal', spacing: 52, startX: 60 },
];
