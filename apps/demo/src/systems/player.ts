import type { Query, World } from '@flare/engine';
import { Position, Velocity } from '@flare/engine';
import { Ship } from '../components';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBullet } from '../spawn';
import { joystickState } from '../state';

const PLAYER_SPEED = 260;
const BULLET_SPEED = -520;

export interface PlayerDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  bounds: { width: number; height: number };
  onShoot: () => void;
}

export function updatePlayer(world: World, dt: number, deps: PlayerDeps): void {
  const { bounds, spawnCtx, query } = deps;
  for (const id of query) {
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    const ship = world.get(id, Ship);
    if (!pos || !vel || !ship) continue;

    vel.x = joystickState.dx * PLAYER_SPEED;
    vel.y = joystickState.dy * PLAYER_SPEED;

    const margin = 20;
    if (pos.x < margin) pos.x = margin;
    else if (pos.x > bounds.width - margin) pos.x = bounds.width - margin;
    if (pos.y < margin) pos.y = margin;
    else if (pos.y > bounds.height - margin) pos.y = bounds.height - margin;

    ship.cooldown -= dt;
    if (ship.cooldown <= 0) {
      spawnBullet(spawnCtx, pos.x, pos.y - 20, 0, BULLET_SPEED, Layer.player);
      ship.cooldown = ship.fireRate;
      deps.onShoot();
    }
  }
}
