import { describe, expect, test } from 'bun:test';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Hp, type LeszyForm, Miniboss } from '../src/components';
import { LESZY_FORM_SEC, LESZY_HP } from '../src/config/gameplay';
import type { SpawnCtx } from '../src/spawn';
import { clearMinibossFsms, computeMinibossStatus, updateMiniboss } from '../src/systems/miniboss';

function buildCtx(): {
  world: World;
  coll: CollisionWorld;
  spawnCtx: SpawnCtx;
  bounds: { width: number; height: number };
} {
  const world = new World();
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as SpawnCtx['atlas'];
  const spawnCtx: SpawnCtx = { world, coll, atlas };
  return { world, coll, spawnCtx, bounds: { width: 360, height: 640 } };
}

function spawnMockLeszy(world: World, hp: number): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: -40 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Miniboss, {
    pattern: 'leszy',
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 999,
    dyingExplosions: 0,
    targetY: 110,
    rootProgress: 0,
    form: 'deer',
    formT: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function keepCooldownHigh(world: World, id: number): void {
  const m = world.get(id, Miniboss);
  if (m) m.fireCooldown = 999;
}

describe('leszy FSM', () => {
  test('entering → active once miniboss reaches targetY', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockLeszy(world, LESZY_HP);
    const query = world.query(Miniboss);

    for (let i = 0; i < 200; i++) {
      updateMiniboss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
      });
      keepCooldownHigh(world, id);
      const pos = world.get(id, Position);
      const vel = world.get(id, Velocity);
      if (pos && vel) pos.y += vel.y * 0.05;
      const m = world.get(id, Miniboss);
      if (m && m.phase === 'active') break;
    }
    expect(world.get(id, Miniboss)?.phase).toBe('active');
  });

  test('form cycles deer → bear → owl → deer, onFormChange fires per cycle', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockLeszy(world, LESZY_HP);
    const query = world.query(Miniboss);

    const m = world.get(id, Miniboss);
    const pos = world.get(id, Position);
    if (m && pos) {
      m.phase = 'active';
      pos.y = m.targetY;
    }

    const observed: LeszyForm[] = [];
    const onFormChange = (form: LeszyForm): void => {
      observed.push(form);
    };

    // Run ~3.5 form intervals worth of time in small steps.
    const dt = 0.05;
    const steps = Math.ceil((LESZY_FORM_SEC * 3.5) / dt);
    for (let i = 0; i < steps; i++) {
      updateMiniboss(world, dt, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onFormChange,
      });
      keepCooldownHigh(world, id);
    }

    // Expect at least 4 emissions: initial 'deer' on entering active,
    // then deer→bear, bear→owl, owl→deer.
    expect(observed.length).toBeGreaterThanOrEqual(4);
    expect(observed[0]).toBe('deer');
    expect(observed[1]).toBe('bear');
    expect(observed[2]).toBe('owl');
    expect(observed[3]).toBe('deer');
  });

  test('HP ≤ 0 transitions through dying into defeated', () => {
    clearMinibossFsms();
    const { world, spawnCtx, bounds } = buildCtx();
    const id = spawnMockLeszy(world, LESZY_HP);
    const query = world.query(Miniboss);

    const m = world.get(id, Miniboss);
    const pos = world.get(id, Position);
    if (m && pos) {
      m.phase = 'active';
      pos.y = m.targetY;
    }
    const hp = world.get(id, Hp);
    if (hp) hp.current = 0;

    let defeated = false;
    for (let i = 0; i < 800; i++) {
      updateMiniboss(world, 0.05, {
        spawnCtx,
        query,
        playerX: 180,
        playerY: 540,
        bounds,
        onDefeated: () => {
          defeated = true;
        },
      });
      const status = computeMinibossStatus(world, query);
      if (!status.alive) break;
    }
    expect(defeated).toBe(true);
  });
});
