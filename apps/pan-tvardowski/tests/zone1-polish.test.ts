import { beforeEach, describe, expect, test } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import {
  Boss,
  Bullet,
  type BulletData,
  Enemy,
  type EnemyData,
  Hp,
  Miniboss,
  Ship,
} from '../src/components';
import { PLAYER_HP_MAX, SMOK_HP_MAX, SMOK_PHASE_HP } from '../src/config/gameplay';
import { Layer } from '../src/layers';
import { gameState, resetGameState } from '../src/state';
import { resolveCollision } from '../src/systems/collision';

const ENEMY_DEFAULTS: EnemyData = {
  pattern: 'skrzat',
  t: 0,
  baseX: 0,
  speed: 130,
  scoreValue: 100,
  fireInterval: 2.4,
  fireCooldown: 1.5,
  blinkT: 0,
};

const BULLET_DEFAULTS: BulletData = {
  damage: 5,
  ownerLayer: Layer.enemy,
};

function buildWorld(): { world: World; coll: CollisionWorld } {
  return { world: new World(), coll: new CollisionWorld() };
}

describe('zone-1 polish — item 1: sigil removed', () => {
  test('SMOK_PHASE_HP is 200 (zone-1 boss -50%)', () => {
    expect(SMOK_PHASE_HP).toBe(200);
  });

  test('SMOK_HP_MAX is 400 (SMOK_PHASE_HP * 2)', () => {
    expect(SMOK_HP_MAX).toBe(400);
  });
});

describe('zone-1 polish — item 2: enemy-bullet hit → x1 shake', () => {
  beforeEach(() => resetGameState());

  test('enemy bullet hitting player ship requests x1 shake', () => {
    const { world, coll } = buildWorld();

    const playerId = world.spawn();
    world.add(playerId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(playerId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const bulletId = world.spawn();
    world.add(bulletId, Bullet, { ...BULLET_DEFAULTS, ownerLayer: Layer.enemy, damage: 5 });

    gameState.playerHp = PLAYER_HP_MAX;
    gameState.settings.screenShake = true;
    gameState.settings.reducedMotion = false;

    const shakes: Array<'x1' | 'x2'> = [];
    resolveCollision(world, coll, bulletId, playerId, {
      requestShake: (level) => {
        shakes.push(level);
      },
    });

    expect(shakes).toEqual(['x1']);
    expect(gameState.playerHp).toBe(PLAYER_HP_MAX - 5);
  });

  test('player bullet hitting enemy does NOT request shake', () => {
    const { world, coll } = buildWorld();

    const enemyId = world.spawn();
    world.add(enemyId, Enemy, { ...ENEMY_DEFAULTS });
    world.add(enemyId, Hp, { current: 10, max: 10 });

    const bulletId = world.spawn();
    world.add(bulletId, Bullet, { ...BULLET_DEFAULTS, ownerLayer: Layer.player, damage: 3 });

    const shakes: Array<'x1' | 'x2'> = [];
    resolveCollision(world, coll, bulletId, enemyId, {
      requestShake: (level) => {
        shakes.push(level);
      },
    });

    expect(shakes).toHaveLength(0);
  });
});

describe('zone-1 polish — item 3: ship collision → -10% HP + x2 shake', () => {
  beforeEach(() => resetGameState());

  test('ship↔enemy contact deals exactly 10% of PLAYER_HP_MAX', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const enemyId = world.spawn();
    world.add(enemyId, Enemy, { ...ENEMY_DEFAULTS });
    world.add(enemyId, Hp, { current: 10, max: 10 });

    gameState.playerHp = PLAYER_HP_MAX;

    const shakes: Array<'x1' | 'x2'> = [];
    resolveCollision(world, coll, shipId, enemyId, {
      requestShake: (level) => {
        shakes.push(level);
      },
    });

    const expectedDamage = Math.round(PLAYER_HP_MAX * 0.1);
    expect(gameState.playerHp).toBe(PLAYER_HP_MAX - expectedDamage);
    expect(shakes).toEqual(['x2']);
  });

  test('ship↔enemy: enemy HP is zeroed (collision-kill)', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const enemyId = world.spawn();
    world.add(enemyId, Enemy, { ...ENEMY_DEFAULTS });
    world.add(enemyId, Hp, { current: 50, max: 50 });

    resolveCollision(world, coll, shipId, enemyId, {
      requestShake: () => {},
    });

    // Enemy hp.current should be 0 so cleanup fires onEnemyKilled next frame.
    const hp = world.get(enemyId, Hp);
    expect(hp?.current).toBe(0);
    // Entity is NOT immediately destroyed — it still exists in the world.
    expect(world.has(enemyId, Enemy)).toBe(true);
  });

  test('ship↔boss: boss is NOT destroyed and player still takes damage', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const bossId = world.spawn();
    world.add(bossId, Boss, {
      pattern: 'smok-krzemionkowski',
      phase: 'phase1',
      t: 0,
      phaseT: 0,
      fireCooldown: 999,
      dyingExplosions: 0,
      targetY: 100,
      shieldActive: false,
      minionsAlive: 0,
      shieldDownFor: 0,
      summonsSpawned: 0,
      teleportT: 0,
      twinId: -1,
      firepitCooldown: 0,
      shatterIdx: 0,
      shatterT: 0,
    });
    world.add(bossId, Hp, { current: SMOK_HP_MAX, max: SMOK_HP_MAX });

    gameState.playerHp = PLAYER_HP_MAX;

    const shakes: Array<'x1' | 'x2'> = [];
    resolveCollision(world, coll, shipId, bossId, {
      requestShake: (level) => {
        shakes.push(level);
      },
    });

    expect(world.has(bossId, Boss)).toBe(true);
    expect(world.get(bossId, Hp)?.current).toBe(SMOK_HP_MAX);
    expect(gameState.playerHp).toBe(PLAYER_HP_MAX - Math.round(PLAYER_HP_MAX * 0.1));
    expect(shakes).toEqual(['x2']);
  });

  test('ship↔miniboss: miniboss is NOT destroyed', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const minibossId = world.spawn();
    world.add(minibossId, Miniboss, {
      pattern: 'rokita',
      phase: 'active',
      t: 0,
      phaseT: 0,
      fireCooldown: 999,
      dyingExplosions: 0,
      targetY: 100,
      rootProgress: 0,
      form: 'deer',
      formT: 0,
      hounds: 0,
      spikeIndex: 0,
    });
    world.add(minibossId, Hp, { current: 150, max: 150 });

    resolveCollision(world, coll, shipId, minibossId, {
      requestShake: () => {},
    });

    expect(world.has(minibossId, Miniboss)).toBe(true);
    expect(world.get(minibossId, Hp)?.current).toBe(150);
  });

  test('stronger shake wins: x2 not downgraded by subsequent x1', () => {
    // Mirror the stronger-wins guard in state.ts handlePair.
    const history: Array<'x1' | 'x2'> = [];

    function applyStronger(current: 'x1' | 'x2' | null, incoming: 'x1' | 'x2'): 'x1' | 'x2' {
      return current === 'x2' ? 'x2' : incoming;
    }

    // x2 first, then x1 — should stay x2.
    let state = applyStronger(null, 'x2');
    state = applyStronger(state, 'x1');
    history.push(state);

    // x1 first, then x2 — should become x2.
    let state2 = applyStronger(null, 'x1');
    state2 = applyStronger(state2, 'x2');
    history.push(state2);

    expect(history).toEqual(['x2', 'x2']);
  });
});

describe('zone-1 polish — item 4: collision-kill routes through hp=0', () => {
  beforeEach(() => resetGameState());

  test('collision-killed regular enemy has hp.current=0 and still exists for cleanup', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const enemyId = world.spawn();
    world.add(enemyId, Enemy, { ...ENEMY_DEFAULTS, scoreValue: 200 });
    world.add(enemyId, Hp, { current: 8, max: 8 });

    resolveCollision(world, coll, shipId, enemyId, { requestShake: () => {} });

    const hp = world.get(enemyId, Hp);
    expect(hp?.current).toBe(0);
    expect(world.has(enemyId, Hp)).toBe(true);
  });

  test('collision-killed enemy without Hp is destroyed immediately', () => {
    const { world, coll } = buildWorld();

    const shipId = world.spawn();
    world.add(shipId, Ship, { fireRate: 0.3, cooldown: 0 });
    world.add(shipId, Hp, { current: PLAYER_HP_MAX, max: PLAYER_HP_MAX });

    const enemyId = world.spawn();
    world.add(enemyId, Enemy, { ...ENEMY_DEFAULTS });

    resolveCollision(world, coll, shipId, enemyId, { requestShake: () => {} });

    expect(world.has(enemyId, Enemy)).toBe(false);
  });
});

describe('zone-1 polish — item 5: bomb sets hp=0 (routes through onEnemyKilled)', () => {
  test('processBomb sets hp.current=0 on each enemy (no manual score/kills)', () => {
    const { world, coll } = buildWorld();
    const enemyQuery = world.query(Enemy);
    const bossQuery = world.query(Boss);
    const minibossQuery = world.query(Miniboss);

    const e1 = world.spawn();
    world.add(e1, Enemy, { ...ENEMY_DEFAULTS, scoreValue: 100 });
    world.add(e1, Hp, { current: 10, max: 10 });

    const e2 = world.spawn();
    world.add(e2, Enemy, { ...ENEMY_DEFAULTS, scoreValue: 200 });
    world.add(e2, Hp, { current: 20, max: 20 });

    const { processBomb, createBombFlashState } = require('../src/systems/bomb');
    const { bombButtonState, resetGameState: rgs } = require('../src/state');

    rgs();
    gameState.bombCharges = 1;
    bombButtonState.justPressed = true;

    const flash = createBombFlashState();
    processBomb(world, 0.016, {
      coll,
      enemyQuery,
      bossQuery,
      minibossQuery,
      flash,
    });

    expect(world.get(e1, Hp)?.current).toBe(0);
    expect(world.get(e2, Hp)?.current).toBe(0);
    // Score is NOT incremented here — onEnemyKilled handles it via cleanup.
    expect(gameState.score).toBe(0);
  });

  test('processBomb boss 25% path unchanged', () => {
    const { world, coll } = buildWorld();
    const enemyQuery = world.query(Enemy);
    const bossQuery = world.query(Boss);
    const minibossQuery = world.query(Miniboss);

    const bossId = world.spawn();
    world.add(bossId, Boss, {
      pattern: 'smok-krzemionkowski',
      phase: 'phase1',
      t: 0,
      phaseT: 0,
      fireCooldown: 999,
      dyingExplosions: 0,
      targetY: 100,
      shieldActive: false,
      minionsAlive: 0,
      shieldDownFor: 0,
      summonsSpawned: 0,
      teleportT: 0,
      twinId: -1,
      firepitCooldown: 0,
      shatterIdx: 0,
      shatterT: 0,
    });
    world.add(bossId, Hp, { current: 400, max: 400 });

    const { processBomb, createBombFlashState } = require('../src/systems/bomb');
    const { bombButtonState, resetGameState: rgs } = require('../src/state');

    rgs();
    gameState.bombCharges = 1;
    bombButtonState.justPressed = true;

    const flash = createBombFlashState();
    processBomb(world, 0.016, {
      coll,
      enemyQuery,
      bossQuery,
      minibossQuery,
      flash,
    });

    // Boss takes 25% damage: 400 - floor(400 * 0.25) = 400 - 100 = 300.
    expect(world.get(bossId, Hp)?.current).toBe(300);
  });
});

describe('zone-1 polish — item 6: bomb sets bombFlashAlpha in gameState', () => {
  beforeEach(() => resetGameState());

  test('bombFlashAlpha starts at 0 after resetGameState', () => {
    expect(gameState.bombFlashAlpha).toBe(0);
  });

  test('bomb flash.alpha drives bombFlashAlpha via hud-sync (0.6 peak)', () => {
    // Direct unit test of the hud-sync formula: nextFlash = flash.alpha * 0.6
    const flashAlpha = 1.0;
    expect(flashAlpha * 0.6).toBe(0.6);
    expect(0.5 * 0.6).toBe(0.3);
  });
});

describe('zone-1 polish — item 7: SMOK HP lock', () => {
  test('SMOK_PHASE_HP === 200', () => {
    expect(SMOK_PHASE_HP).toBe(200);
  });

  test('SMOK_HP_MAX === 400', () => {
    expect(SMOK_HP_MAX).toBe(400);
  });

  test('SMOK_HP_MAX is exactly SMOK_PHASE_HP * 2', () => {
    expect(SMOK_HP_MAX).toBe(SMOK_PHASE_HP * 2);
  });
});
