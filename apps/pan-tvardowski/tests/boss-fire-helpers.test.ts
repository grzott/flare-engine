import { describe, expect, test } from 'bun:test';
import type { SpriteSheet } from '@flare-engine/assets';
import { Position, Velocity, World } from '@flare-engine/ecs';
import { AABB, CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet } from '../src/components';
import { Layer } from '../src/layers';
import type { SpawnCtx } from '../src/spawn';
import type { BossCtx } from '../src/systems/boss/types';
import { clearEnemyBullets, fireAimedFan, fireRadial } from '../src/systems/fire-helpers';

const STUB_FRAME = { name: 'enemy-bullet', x: 0, y: 0, w: 8, h: 8 };
const STUB_SHEET: SpriteSheet = {
  frames: [STUB_FRAME],
  frameMap: new Map([['enemy-bullet', 0]]),
  animations: new Map(),
};

function buildFireCtx(): { ctx: BossCtx; world: World; coll: CollisionWorld } {
  const world = new World();
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: STUB_SHEET,
  } as unknown as SpawnCtx['atlas'];
  const spawnCtx: SpawnCtx = { world, coll, atlas };

  const id = world.spawn();
  world.add(id, Position, { x: 180, y: 100 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern: 'baba-jaga',
    phase: 'phase1',
    t: 1.0,
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

  const ctx: BossCtx = {
    world,
    id,
    deps: {
      spawnCtx,
      query: world.query(Boss),
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
    },
  };
  return { ctx, world, coll };
}

function collectBullets(world: World): Array<{ x: number; y: number; vx: number; vy: number }> {
  const out: Array<{ x: number; y: number; vx: number; vy: number }> = [];
  const q = world.query(Bullet);
  for (const bid of q) {
    const pos = world.get(bid, Position);
    const vel = world.get(bid, Velocity);
    if (pos && vel) out.push({ x: pos.x, y: pos.y, vx: vel.x, vy: vel.y });
  }
  return out;
}

describe('fire-helpers — fireRadial golden constants', () => {
  test('fireRadial(c, 12, 1.6, 0.95) spawns 12 bullets in exact order', () => {
    const { ctx, world } = buildFireCtx();
    fireRadial(ctx, 12, 1.6, 0.95);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(12);

    // Golden constants: pos=(180,100), Boss.t=1.0, spin=1.6, speed=240*0.95=228
    const expected = [
      { x: 180, y: 100, vx: -6.6574910846938495, vy: 227.90278149346315 },
      { x: 180, y: 100, vx: -119.71694715154484, vy: 194.0408528241262 },
      { x: 180, y: 100, vx: -200.69834390882008, vy: 108.18583434191827 },
      { x: 180, y: 100, vx: -227.90278149346315, vy: -6.657491084693835 },
      { x: 180, y: 100, vx: -194.04085282412623, vy: -119.71694715154482 },
      { x: 180, y: 100, vx: -108.18583434191828, vy: -200.69834390882005 },
      { x: 180, y: 100, vx: 6.657491084693721, vy: -227.90278149346318 },
      { x: 180, y: 100, vx: 119.716947151545, vy: -194.04085282412615 },
      { x: 180, y: 100, vx: 200.69834390882005, vy: -108.1858343419183 },
      { x: 180, y: 100, vx: 227.90278149346318, vy: 6.6574910846937065 },
      { x: 180, y: 100, vx: 194.04085282412615, vy: 119.71694715154497 },
      { x: 180, y: 100, vx: 108.18583434191831, vy: 200.69834390882005 },
    ];

    for (let i = 0; i < 12; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireRadial(c, 10, 1.35, 0.9) spawns 10 bullets in exact order', () => {
    const { ctx, world } = buildFireCtx();
    fireRadial(ctx, 10, 1.35, 0.9);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(10);

    // Golden constants: spin=1.35, speed=240*0.9=216
    const expected = [
      { x: 180, y: 100, vx: 47.30544441209697, vy: 210.75624529055835 },
      { x: 180, y: 100, vx: -85.60850435447935, vy: 198.31082668928866 },
      { x: 180, y: 100, vx: -185.82291418368794, vy: 110.1174126298005 },
      { x: 180, y: 100, vx: -215.05928668328266, vy: -20.13711030107452 },
      { x: 180, y: 100, vx: -162.15032126617106, vy: -142.6999415321447 },
      { x: 180, y: 100, vx: -47.30544441209708, vy: -210.75624529055833 },
      { x: 180, y: 100, vx: 85.60850435447925, vy: -198.31082668928872 },
      { x: 180, y: 100, vx: 185.82291418368789, vy: -110.1174126298006 },
      { x: 180, y: 100, vx: 215.05928668328266, vy: 20.1371103010744 },
      { x: 180, y: 100, vx: 162.15032126617115, vy: 142.6999415321446 },
    ];

    for (let i = 0; i < 10; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireRadial(c, 10, 1.1) spawns 10 bullets in exact order', () => {
    const { ctx, world } = buildFireCtx();
    fireRadial(ctx, 10, 1.1);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(10);

    // Golden constants: spin=1.1, speed=240
    const expected = [
      { x: 180, y: 100, vx: 108.86306914213856, vy: 213.88976641474449 },
      { x: 180, y: 100, vx: -37.64917731906371, vy: 237.02856251346103 },
      { x: 180, y: 100, vx: -169.7807176928553, vy: 169.63050403656464 },
      { x: 180, y: 100, vx: -237.06179454232677, vy: 37.439358546476825 },
      { x: 180, y: 100, vx: -213.79332331067377, vy: -109.05234939137128 },
      { x: 180, y: 100, vx: -108.86306914213867, vy: -213.88976641474443 },
      { x: 180, y: 100, vx: 37.649177319063575, vy: -237.02856251346105 },
      { x: 180, y: 100, vx: 169.78071769285518, vy: -169.63050403656476 },
      { x: 180, y: 100, vx: 237.06179454232674, vy: -37.43935854647696 },
      { x: 180, y: 100, vx: 213.79332331067383, vy: 109.05234939137117 },
    ];

    for (let i = 0; i < 10; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireRadial(c, 6, 1.1) at Boss.t=2.3 locks the b.t factor', () => {
    const { ctx, world } = buildFireCtx();
    const b = world.get(ctx.id, Boss);
    if (!b) throw new Error('Boss component missing');
    b.t = 2.3;
    fireRadial(ctx, 6, 1.1);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(6);

    // Golden constants: spin=2.3*1.1=2.53, speed=240
    const expected = [
      { x: 180, y: 100, vx: -196.4963038265716, vy: 137.80131560509744 },
      { x: 180, y: 100, vx: -217.58759190221716, vy: -101.2701330610077 },
      { x: 180, y: 100, vx: -21.091288075645632, vy: -239.0714486661051 },
      { x: 180, y: 100, vx: 196.4963038265715, vy: -137.80131560509753 },
      { x: 180, y: 100, vx: 217.58759190221718, vy: 101.27013306100767 },
      { x: 180, y: 100, vx: 21.09128807564545, vy: 239.0714486661051 },
    ];

    for (let i = 0; i < 6; i++) {
      const bullet = bullets[i];
      const e = expected[i];
      if (!bullet || !e) throw new Error(`missing bullet at index ${i}`);
      expect(bullet.x).toBeCloseTo(e.x, 5);
      expect(bullet.y).toBeCloseTo(e.y, 5);
      expect(bullet.vx).toBeCloseTo(e.vx, 5);
      expect(bullet.vy).toBeCloseTo(e.vy, 5);
    }
  });
});

describe('fire-helpers — fireAimedFan golden constants', () => {
  test('fireAimedFan(c, 3, 0.22, 0.85) spawns 3 bullets at y=136', () => {
    const { ctx, world } = buildFireCtx();
    fireAimedFan(ctx, 3, 0.22, 0.85);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(3);

    // Golden constants: posX=180, posY+36=136, playerDir=(0,440)->base=pi/2, speed=240*0.85=204
    const expected = [
      { x: 180, y: 136, vx: 44.51884310849735, vy: 199.08307966344353 },
      { x: 180, y: 136, vx: 1.2491397351303002e-14, vy: 204 },
      { x: 180, y: 136, vx: -44.51884310849732, vy: 199.08307966344353 },
    ];

    for (let i = 0; i < 3; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireAimedFan(c, 5, 0.18) spawns 5 bullets at y=136', () => {
    const { ctx, world } = buildFireCtx();
    fireAimedFan(ctx, 5, 0.18);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(5);

    // Golden constants: base=pi/2, speed=240
    const expected = [
      { x: 180, y: 136, vx: 84.54581598602158, vy: 224.6152376827044 },
      { x: 180, y: 136, vx: 42.967097622197805, vy: 236.12248626914914 },
      { x: 180, y: 136, vx: 1.469576158976824e-14, vy: 240 },
      { x: 180, y: 136, vx: -42.96709762219778, vy: 236.12248626914914 },
      { x: 180, y: 136, vx: -84.54581598602155, vy: 224.6152376827044 },
    ];

    for (let i = 0; i < 5; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireAimedFan(c, 3, 0.12) spawns 3 bullets at y=136', () => {
    const { ctx, world } = buildFireCtx();
    fireAimedFan(ctx, 3, 0.12);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(3);

    // Golden constants: base=pi/2, spread=0.12, speed=240
    const expected = [
      { x: 180, y: 136, vx: 28.730929749340685, vy: 238.2740726049279 },
      { x: 180, y: 136, vx: 1.469576158976824e-14, vy: 240 },
      { x: 180, y: 136, vx: -28.730929749340657, vy: 238.2740726049279 },
    ];

    for (let i = 0; i < 3; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });

  test('fireAimedFan(c, 3, 0.22, 0.85) diagonal aim — locks normalize-to-204', () => {
    const { ctx, world } = buildFireCtx();
    // Override player position to produce a non-axis-aligned aim vector:
    // boss=(180,100), player=(480,540) → dx=300, dy=440.
    ctx.deps.playerX = 480;
    ctx.deps.playerY = 540;
    fireAimedFan(ctx, 3, 0.22, 0.85);
    const bullets = collectBullets(world);
    expect(bullets).toHaveLength(3);

    // Derived from baba-jaga fire1 formula:
    //   len = sqrt(300²+440²) ≈ 532.5410782
    //   normalizeOut(300,440, 240*0.85=204, aim)
    //   base = atan2(aim.y, aim.x) = atan2(440,300) ≈ 0.97237743
    //   spawn at (180, 100+36=136); speed = 240*0.85 = 204
    const expected = [
      { x: 180, y: 136, vx: 148.93351538385687, vy: 139.40878019481585 },
      { x: 180, y: 136, vx: 114.92071222686799, vy: 168.5503779327397 },
      { x: 180, y: 136, vx: 75.36814449105712, vy: 189.56698762172473 },
    ];

    for (let i = 0; i < 3; i++) {
      const b = bullets[i];
      const e = expected[i];
      if (!b || !e) throw new Error(`missing bullet at index ${i}`);
      expect(b.x).toBeCloseTo(e.x, 5);
      expect(b.y).toBeCloseTo(e.y, 5);
      expect(b.vx).toBeCloseTo(e.vx, 5);
      expect(b.vy).toBeCloseTo(e.vy, 5);
    }
  });
});

describe('fire-helpers — clearEnemyBullets', () => {
  test('removes exactly enemy bullets, leaves player bullet intact', () => {
    const { ctx, world, coll } = buildFireCtx();

    // Manually seed 3 enemy bullets.
    for (let i = 0; i < 3; i++) {
      const bid = world.spawn();
      world.add(bid, Position, { x: 100 + i * 10, y: 200 });
      world.add(bid, Velocity, { x: 0, y: 100 });
      world.add(bid, Bullet, { damage: 1, ownerLayer: Layer.enemy });
      coll.add(bid, AABB(8, 8), 100 + i * 10, 200, true, Layer.enemyBullet, 0);
    }

    // Seed 1 player bullet.
    const playerBid = world.spawn();
    world.add(playerBid, Position, { x: 180, y: 300 });
    world.add(playerBid, Velocity, { x: 0, y: -200 });
    world.add(playerBid, Bullet, { damage: 1, ownerLayer: Layer.player });
    coll.add(playerBid, AABB(8, 8), 180, 300, true, Layer.playerBullet, 0);

    const bulletsBefore = [...world.query(Bullet)];
    expect(bulletsBefore).toHaveLength(4);

    clearEnemyBullets(ctx);

    const bulletsAfter = [...world.query(Bullet)];
    expect(bulletsAfter).toHaveLength(1);
    expect(bulletsAfter[0]).toBe(playerBid);

    const surviving = world.get(playerBid, Bullet);
    expect(surviving?.ownerLayer).toBe(Layer.player);
  });
});
