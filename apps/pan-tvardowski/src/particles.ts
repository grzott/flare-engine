import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { Lifetime } from './components';
import type { AtlasHandle } from './spawn';

const PARTICLE_Z = 20;

/**
 * Emit a burst of short-lived sprite "particles" — shape-atlas frames with
 * random radial velocity and capped lifetime. Rendering piggybacks the ECS
 * sprite system, so no custom draw path is needed.
 */
export function burstExplosion(
  world: World,
  atlas: AtlasHandle,
  x: number,
  y: number,
  count = 10,
  seed = 1,
): void {
  const frame = getFrame(atlas.sheet, 'particle-spark');
  if (!frame) return;
  let s = seed | 0 || 1;
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const r01 = (s - 1) / 2147483646;
    s = (s * 16807) % 2147483647;
    const r02 = (s - 1) / 2147483646;
    const a = r01 * Math.PI * 2;
    const sp = 60 + r02 * 160;
    const id = world.spawn();
    world.add(id, Position, { x, y });
    world.add(id, Velocity, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
    world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z });
    world.add(id, Lifetime, { remaining: 0.35 + r01 * 0.3 });
  }
}

export function burstMuzzleFlash(world: World, atlas: AtlasHandle, x: number, y: number): void {
  const frame = getFrame(atlas.sheet, 'particle-smoke');
  if (!frame) return;
  const id = world.spawn();
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: -40 });
  world.add(id, Sprite, { image: atlas.image, frame, z: PARTICLE_Z });
  world.add(id, Lifetime, { remaining: 0.08 });
}
