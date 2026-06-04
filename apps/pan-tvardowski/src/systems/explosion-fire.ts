/**
 * KG7 (updated Fix-2): ExplosionFire flipbook system.
 *
 * Drives the regularExplosion00..08 animation (9-frame Kenney Explosion Pack
 * fireball) on explosion-fire entities spawned by _spawnParticles when the
 * kenney atlas is live and the zone is in KENNEY_FX_ZONES.
 *
 * fire00..19 frames are intentionally left in the atlas for exhaust.ts — this
 * system no longer references them.
 */
import type { Query, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import { ExplosionFire } from '../components';
import { KENNEY_SPRITE_SCALE } from '../visual-spec/kenney-frames';

/** Frames per second for the regularExplosion flipbook.
 *  9 frames at 18 Hz = 0.5 s total — matches a typical burst explosion lifetime. */
export const EXPLOSION_FIRE_HZ = 18;

/** Rendered size of the regularExplosion fireball (192×192 native × scale).
 *  Scaled down so it reads as a clear blast without overwhelming the scaled hulls. */
export const EXPLOSION_FIREBALL_SCALE = KENNEY_SPRITE_SCALE * 1.4;

const EXPLOSION_FRAME_COUNT = 9;

/** Pre-built frame-name array — no per-frame string allocation. */
const EXPLOSION_FRAME_NAMES: readonly string[] = [
  'regularExplosion00',
  'regularExplosion01',
  'regularExplosion02',
  'regularExplosion03',
  'regularExplosion04',
  'regularExplosion05',
  'regularExplosion06',
  'regularExplosion07',
  'regularExplosion08',
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
    const frameIdx = Math.min(
      Math.floor(ef.elapsed * EXPLOSION_FIRE_HZ),
      EXPLOSION_FRAME_COUNT - 1,
    );
    const frameName = EXPLOSION_FRAME_NAMES[frameIdx] as string;
    const frameMapIdx = kenney.sheet.frameMap.get(frameName);
    if (frameMapIdx === undefined) continue;
    const f = kenney.sheet.frames[frameMapIdx];
    if (!f) continue;
    const sprite = world.get(id, Sprite);
    if (!sprite) continue;
    sprite.image = kenney.image;
    sprite.frame = f;
    sprite.width = f.w * EXPLOSION_FIREBALL_SCALE;
    sprite.height = f.h * EXPLOSION_FIREBALL_SCALE;
  }
}
