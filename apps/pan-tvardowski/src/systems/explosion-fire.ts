/**
 * KG7: ExplosionFire flipbook system.
 *
 * Drives the fire00..19 animation on explosion-fire entities spawned by
 * _spawnParticles when the kenney atlas is live and the zone is in
 * KENNEY_FX_ZONES. Same frame-index pattern as exhaust.ts.
 */
import type { Query, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import { ExplosionFire } from '../components';

/** Fire flipbook frequency in Hz — matches exhaust EXHAUST_HZ so the two animations align. */
export const EXPLOSION_FIRE_HZ = 12;

const FIRE_FRAME_COUNT = 20;

/** Pre-built frame-name array — no per-frame string allocation. */
const FIRE_FRAME_NAMES: readonly string[] = [
  'fire00',
  'fire01',
  'fire02',
  'fire03',
  'fire04',
  'fire05',
  'fire06',
  'fire07',
  'fire08',
  'fire09',
  'fire10',
  'fire11',
  'fire12',
  'fire13',
  'fire14',
  'fire15',
  'fire16',
  'fire17',
  'fire18',
  'fire19',
] as const;

export interface ExplosionFireDeps {
  explosionFireQuery: Query;
  kenney: KenneyAtlasHandle | null | undefined;
  dt: number;
}

export function updateExplosionFire(world: World, deps: ExplosionFireDeps): void {
  const { explosionFireQuery, kenney, dt } = deps;
  if (!kenney || kenney.image === null) return;

  for (const id of explosionFireQuery) {
    const ef = world.get(id, ExplosionFire);
    if (!ef) continue;
    ef.elapsed += dt;
    const frameIdx = Math.floor(ef.elapsed * EXPLOSION_FIRE_HZ) % FIRE_FRAME_COUNT;
    const frameName = FIRE_FRAME_NAMES[frameIdx] as string;
    const frameMapIdx = kenney.sheet.frameMap.get(frameName);
    if (frameMapIdx === undefined) continue;
    const f = kenney.sheet.frames[frameMapIdx];
    if (!f) continue;
    const sprite = world.get(id, Sprite);
    if (!sprite) continue;
    sprite.image = kenney.image;
    sprite.frame = f;
  }
}
