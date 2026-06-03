import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from './assets/sprites-loader';
import { Lifetime } from './components';
import { triggerExplosion } from './fx/explosions';
import type { AtlasHandle } from './spawn';
import { PARTICLE_DEFS } from './visual-spec/particles';
import type { ParticleSpecId } from './visual-spec/types';

const PARTICLE_Z = 20;
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

const SMOKE_LIFETIME_S =
  (PARTICLE_DEFS.find((d) => d.id === ('particle-smoke' as ParticleSpecId))?.lifetimeMs ?? 80) /
  1000;

/**
 * Backward-compatible wrapper: fires a Tier-II "pop" explosion.
 * The `count` and `seed` parameters are ignored — tier drives count.
 * Prefer calling `triggerExplosion` directly for explicit tier control.
 *
 * KG7: optional kenney + zoneId thread kenney particle-dot + ExplosionFire
 * through to _spawnParticles when the zone is in KENNEY_FX_ZONES.
 */
export function burstExplosion(
  world: World,
  atlas: AtlasHandle,
  x: number,
  y: number,
  _count = 10,
  _seed = 1,
  kenney?: KenneyAtlasHandle | null,
  zoneId?: string,
): void {
  triggerExplosion(world, atlas, null, null, false, x, y, 'pop', zoneId ?? '', undefined, kenney);
}

export function burstMuzzleFlash(world: World, atlas: AtlasHandle, x: number, y: number): void {
  const frame = getFrame(atlas.sheet, 'particle-smoke');
  if (!frame) return;
  const id = world.spawn();
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: -40 });
  world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z, anchor: CENTER_ANCHOR });
  world.add(id, Lifetime, { remaining: SMOKE_LIFETIME_S });
}
