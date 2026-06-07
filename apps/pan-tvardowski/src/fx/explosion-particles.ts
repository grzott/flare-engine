import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import { ExplosionFire } from '../components';
import { Lifetime } from '../components';
import type { AtlasHandle } from '../spawn';
import { KENNEY_FX_ZONES } from '../visual-spec/kenney-frames';
import type { ExplosionTierDef } from '../visual-spec/types';

const PARTICLE_Z = 20;
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

// Scratch LCG state — zero-alloc; re-seeded per call.
export let _lcgS = 1;

export function _lcgNext(): number {
  _lcgS = (_lcgS * 16807) % 2147483647;
  return (_lcgS - 1) / 2147483646;
}

export function _spawnParticles(
  world: World,
  atlas: AtlasHandle,
  x: number,
  y: number,
  def: ExplosionTierDef,
  kenney?: KenneyAtlasHandle | null,
  zoneId?: string,
): void {
  const sparkFrame = getFrame(atlas.sheet, 'particle-spark');
  const smokeFrame = getFrame(atlas.sheet, 'particle-smoke');
  if (!sparkFrame) return;

  // KG7: use kenney particle-dot + fire flipbook when kenney is live and the
  // zone is in KENNEY_FX_ZONES. Parse numeric zone id from the 'z1'..'z8' string.
  const zoneNum = zoneId ? Number(zoneId.slice(1)) : 0;
  const kenneyLive =
    kenney !== null &&
    kenney !== undefined &&
    kenney.image !== null &&
    KENNEY_FX_ZONES.has(zoneNum);

  // Seed the LCG reproducibly from position so identical spawns are consistent.
  _lcgS = (x * 31 + y * 17) | 0 || 1;

  const count = def.particles;
  const smokeRatio = def.smokeRatio ?? 0;
  const lifeBase = def.lifeMs / 1000;

  if (!kenneyLive) {
    for (let i = 0; i < count; i++) {
      const r01 = _lcgNext();
      const r02 = _lcgNext();
      const a = r01 * Math.PI * 2;
      const sp = 60 + r02 * 160;

      const useSmokeFrame = smokeFrame !== null && smokeFrame !== undefined && r01 < smokeRatio;
      const frame = useSmokeFrame && smokeFrame ? smokeFrame : sparkFrame;

      const id = world.spawn();
      world.add(id, Position, { x, y });
      world.add(id, Velocity, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
      world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z, anchor: CENTER_ANCHOR });
      world.add(id, Lifetime, { remaining: lifeBase * (0.7 + r01 * 0.6) });
    }
  }

  // KG7 (Fix-2): spawn a central regularExplosion flipbook entity for kenney zones.
  // This entity stays at the explosion centre and animates through regularExplosion00..08
  // for the full explosion lifetime. Driven by updateExplosionFire in play.ts.
  if (kenneyLive) {
    const fireFrame = getFrame(kenney!.sheet, 'regularExplosion00');
    if (fireFrame) {
      const fireId = world.spawn();
      world.add(fireId, Position, { x, y });
      world.add(fireId, Sprite, {
        image: kenney!.image!,
        frame: fireFrame,
        z: PARTICLE_Z + 1,
        anchor: CENTER_ANCHOR,
      });
      world.add(fireId, ExplosionFire, { elapsed: 0 });
      world.add(fireId, Lifetime, { remaining: lifeBase });
    }
  }
}
