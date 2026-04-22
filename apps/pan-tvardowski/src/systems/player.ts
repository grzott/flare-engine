import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';
import { clamp } from '@flare-engine/math';
import { Ship } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { joystickState } from '../state';

const PLAYER_SPEED = 260;
const MARGIN = 20;

export interface PlayerDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  bounds: { width: number; height: number };
  onShoot?: () => void;
}

/**
 * Joystick drives player velocity; auto-fire Iskry L1 (2 parallel bullets).
 * Clamped inside the play-field margins.
 */
export function updatePlayer(world: World, dt: number, deps: PlayerDeps): void {
  const { bounds, spawnCtx, query } = deps;
  for (const id of query) {
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    const ship = world.get(id, Ship);
    if (!pos || !vel || !ship) continue;

    vel.x = joystickState.dx * PLAYER_SPEED;
    vel.y = joystickState.dy * PLAYER_SPEED;

    pos.x = clamp(pos.x, MARGIN, bounds.width - MARGIN);
    pos.y = clamp(pos.y, MARGIN, bounds.height - MARGIN);

    ship.cooldown -= dt;
    if (ship.cooldown <= 0) {
      const by = pos.y + BULLET_SPAWN_OFFSET.player;
      // Iskry L1 — 2 narrow parallel bullets.
      spawnBullet(spawnCtx, pos.x - 6, by, 0, -BULLET_SPEED.player, Layer.player);
      spawnBullet(spawnCtx, pos.x + 6, by, 0, -BULLET_SPEED.player, Layer.player);
      ship.cooldown = ship.fireRate;
      deps.onShoot?.();
    }
  }
}
