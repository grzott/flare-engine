import { describe, expect, test } from 'bun:test';
import { World } from '@flare-engine/ecs';
import { Boss, Bullet, Enemy } from '../src/components';
import { createGameSnapshot } from '../src/devtools/snapshot';
import { gameState } from '../src/state';

describe('devtools / game snapshot', () => {
  test('captures live gameState + counts from queries', () => {
    const world = new World();
    const enemyQuery = world.query(Enemy);
    const bulletQuery = world.query(Bullet);
    const bossQuery = world.query(Boss);

    // Baseline snapshot — empty world.
    let elapsed = 0;
    gameState.score = 100;
    gameState.playerHp = 80;
    gameState.bombCharges = 2;
    gameState.currentZone = 'z4';

    const s1 = createGameSnapshot({
      world,
      enemyQuery,
      bulletQuery,
      bossQuery,
      elapsed: () => elapsed,
    });
    expect(s1.score).toBe(100);
    expect(s1.playerHp).toBe(80);
    expect(s1.bombCharges).toBe(2);
    expect(s1.enemyCount).toBe(0);
    expect(s1.bulletCount).toBe(0);
    expect(s1.bossPhase).toBe('none');
    expect(s1.currentZone).toBe('z4');

    // Mutate gameState + add entities — next snapshot must reflect changes.
    elapsed = 12.5;
    gameState.score = 500;
    gameState.playerHp = 40;

    const e = world.spawn();
    world.add(e, Enemy, {
      pattern: 'mamuna',
      t: 0,
      baseX: 0,
      speed: 0,
      scoreValue: 0,
      fireInterval: 0,
      fireCooldown: 0,
      blinkT: 0,
    });
    const b = world.spawn();
    world.add(b, Bullet, { ownerLayer: 0, damage: 0 });
    const boss = world.spawn();
    world.add(boss, Boss, {
      pattern: 'boruta',
      phase: 'phase2',
      t: 0,
      phaseT: 0,
      fireCooldown: 0,
      dyingExplosions: 0,
      targetY: 0,
      shieldActive: false,
      minionsAlive: 0,
      shieldDownFor: 0,
      summonsSpawned: 3,
      teleportT: 0,
      twinId: -1,
      firepitCooldown: 0,
    });

    const s2 = createGameSnapshot({
      world,
      enemyQuery,
      bulletQuery,
      bossQuery,
      elapsed: () => elapsed,
    });
    expect(s2.elapsed).toBe(12.5);
    expect(s2.score).toBe(500);
    expect(s2.playerHp).toBe(40);
    expect(s2.enemyCount).toBe(1);
    expect(s2.bulletCount).toBe(1);
    expect(s2.bossPhase).toBe('phase2');
  });
});
