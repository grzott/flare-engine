import { THEME_SPEC } from './theme';
import type { ParticleDef, ParticleSpecId } from './types';

const c = THEME_SPEC.colors;

const id = (s: string) => s as ParticleSpecId;

export const PARTICLE_DEFS: readonly ParticleDef[] = [
  {
    id: id('particle-spark'),
    fill: c.gold,
    shape: 'circle',
    size: 2,
  },
  {
    id: id('particle-smoke'),
    // 60% alpha on theme smokeGrey
    fill: '#88888899',
    shape: 'circle',
    size: 3,
    lifetimeMs: 80,
  },
] as const;
