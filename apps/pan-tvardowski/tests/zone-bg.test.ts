import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { AnySpriteEffect } from '@flare-engine/render';
import { createZoneBg } from '../src/bg/create-zone-bg';
import type { ZoneBgCamera } from '../src/bg/create-zone-bg';

const VW = 360;
const VH = 640;

function buildAtlas() {
  const fireFrame = { name: 'tile-fire', x: 0, y: 0, w: 32, h: 32 };
  const frameMap = new Map<string, number>([['tile-fire', 0]]);
  return {
    image: {} as never,
    sheet: {
      frames: [fireFrame],
      frameMap,
      animations: new Map(),
    },
  } as unknown as Parameters<typeof createZoneBg>[1]['atlas'];
}

function buildCamera(w = VW, h = VH): ZoneBgCamera {
  return { viewportWidth: w, viewportHeight: h };
}

function spawnBg(zoneId: string, camera: ZoneBgCamera = buildCamera()) {
  const world = new World();
  const atlas = buildAtlas();
  const controller = createZoneBg(zoneId, {
    world,
    atlas,
    viewportWidth: VW,
    viewportHeight: VH,
    camera,
  });
  return { world, controller };
}

// ---------------------------------------------------------------------------
// Block 1 — entity shape (all 8 zones)
// ---------------------------------------------------------------------------

describe('createZoneBg — entity shape (all 8 zones)', () => {
  const zones: [string, AnySpriteEffect['type']][] = [
    ['z1', 'roofs-city'],
    ['z2', 'forest-canopy'],
    ['z3', 'river-wave'],
    ['z4', 'forest-canopy'],
    ['z5', 'mountain-hills'],
    ['z6', 'cave-interior'],
    ['z7', 'roofs-city'],
    ['z8', 'moon-crater'],
  ];

  for (const [zoneId, expectedEffectType] of zones) {
    test(`${zoneId}: spawns 2 entities, fullscreen size, correct effect type, destroy removes both`, () => {
      const { world, controller } = spawnBg(zoneId);

      const ids = [...world.query(Position)];
      expect(ids.length).toBe(2);

      const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
      expect(sprites.length).toBe(2);

      for (const sprite of sprites) {
        expect(sprite!.width).toBe(VW);
        expect(sprite!.height).toBe(VH);
        expect(sprite!.anchor).toEqual({ x: 0.5, y: 0.5 });
        expect(sprite!.effect?.type).toBe(expectedEffectType);
      }

      controller.destroy();
      expect([...world.query(Position)].length).toBe(0);
    });
  }

  test('z1 fullscreen-coverage pin: sprite dimensions cover viewport exactly (regression guard for 2/3-block bug)', () => {
    // Camera provides true canvas dims. tick() must update width/height to match
    // camera.viewportWidth × camera.viewportHeight, not just the initial play-area size.
    const CANVAS_W = 393;
    const CANVAS_H = 852;
    const PLAY_W = 393;
    const PLAY_H = 818; // play-area after bottom-inset subtraction

    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: PLAY_W,
      viewportHeight: PLAY_H,
      camera: buildCamera(CANVAS_W, CANVAS_H),
    });

    // After one tick, BG must match canvas dimensions, not play-area dims.
    controller.tick(0);

    const ids = [...world.query(Position)];
    for (const id of ids) {
      const pos = world.get(id, Position)!;
      const sprite = world.get(id, Sprite)!;
      expect(sprite.width).toBe(CANVAS_W);
      expect(sprite.height).toBe(CANVAS_H);
      expect(pos.x).toBe(CANVAS_W / 2);
      expect(pos.y).toBe(CANVAS_H / 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 2 — kind-specific density param routing
// ---------------------------------------------------------------------------

describe('kind-specific density param routing', () => {
  test('z1 (roofs-city): effect.density === 7', () => {
    const { world } = spawnBg('z1');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; density: number };
    expect(effect.type).toBe('roofs-city');
    expect(effect.density).toBe(7);
  });

  test('z2 (forest-canopy): effect.density === 6', () => {
    const { world } = spawnBg('z2');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; density: number };
    expect(effect.type).toBe('forest-canopy');
    expect(effect.density).toBe(6);
  });

  test('z3 (river-wave): effect.waveScale === 2.5', () => {
    const { world } = spawnBg('z3');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; waveScale: number };
    expect(effect.type).toBe('river-wave');
    expect(effect.waveScale).toBe(2.5);
  });

  test('z5 (mountain-hills): effect.ridgeScale === 1.8', () => {
    const { world } = spawnBg('z5');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; ridgeScale: number };
    expect(effect.type).toBe('mountain-hills');
    expect(effect.ridgeScale).toBe(1.8);
  });

  test('z6 (cave-interior): effect.stalactiteCount === 10', () => {
    const { world } = spawnBg('z6');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; stalactiteCount: number };
    expect(effect.type).toBe('cave-interior');
    expect(effect.stalactiteCount).toBe(10);
  });

  test('z8 (moon-crater): effect.craterCount === 5', () => {
    const { world } = spawnBg('z8');
    const ids = [...world.query(Position)];
    const sprite = world.get(ids[0]!, Sprite)!;
    const effect = sprite.effect as { type: string; craterCount: number };
    expect(effect.type).toBe('moon-crater');
    expect(effect.craterCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Block 3 — scrollSpeed tick integration
// ---------------------------------------------------------------------------

describe('scrollSpeed tick integration', () => {
  test('tick(1.0) → effect.scrollOffsetY equals zone scrollSpeed', () => {
    // z1 scrollSpeed = 18
    const { world, controller } = spawnBg('z1');
    controller.tick(1.0);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { scrollOffsetY: number };
      expect(effect.scrollOffsetY).toBe(18);
    }
  });

  test('second tick(1.0) → scrollOffsetY doubles (accumulates)', () => {
    const { world, controller } = spawnBg('z1');
    controller.tick(1.0);
    controller.tick(1.0);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { scrollOffsetY: number };
      expect(effect.scrollOffsetY).toBe(36);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 4 — resolution wired into effect (shader UV correctness)
// ---------------------------------------------------------------------------

describe('resolution wired into effect', () => {
  test('at spawn: effect.resolutionW/H match camera viewport', () => {
    // Camera provides the real canvas size. The effect must carry those
    // dimensions so the shader can compute correct UV (coord/resolution).
    // If resolution is 0 the shader divides by max(resolution,1) = 1, so
    // scrollOffsetY of 18 shifts UV by 18 pixels — 18× too fast and
    // pattern repeats at 1-pixel intervals (the "snowflake noise" symptom).
    const CANVAS_W = 393;
    const CANVAS_H = 852;
    const { world } = spawnBg('z1', buildCamera(CANVAS_W, CANVAS_H));
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { resolutionW: number; resolutionH: number };
      expect(effect.resolutionW).toBe(CANVAS_W);
      expect(effect.resolutionH).toBe(CANVAS_H);
    }
  });

  test('after tick(): effect.resolutionW/H track updated viewport', () => {
    // If camera dims change (layout fires after spawn), tick() must
    // propagate the new resolution into the rebuilt effect.
    const CANVAS_W = 412;
    const CANVAS_H = 900;
    const { world, controller } = spawnBg('z1', buildCamera(CANVAS_W, CANVAS_H));
    controller.tick(0.016);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { resolutionW: number; resolutionH: number };
      expect(effect.resolutionW).toBe(CANVAS_W);
      expect(effect.resolutionH).toBe(CANVAS_H);
    }
  });

  test('distinct zones produce distinct colors: z1 (terracotta skyColor) vs z6 (katakumbyDark caveColor)', () => {
    // Regression guard for H1b: Color.fromHex must parse #RRGGBB strings and
    // produce zone-specific values. If all zones collapsed to the same color,
    // this assertion would fail.
    const { world: w1 } = spawnBg('z1');
    const { world: w6 } = spawnBg('z6');

    const ids1 = [...w1.query(Position)];
    const ids6 = [...w6.query(Position)];

    const eff1 = w1.get(ids1[0]!, Sprite)!.effect as {
      type: string;
      skyColor: { r: number; g: number; b: number };
    };
    const eff6 = w6.get(ids6[0]!, Sprite)!.effect as {
      type: string;
      caveColor: { r: number; g: number; b: number };
    };

    expect(eff1.type).toBe('roofs-city');
    expect(eff6.type).toBe('cave-interior');

    // terracotta = #B05A3C → r≈0.69, g≈0.35, b≈0.24
    expect(eff1.skyColor.r).toBeCloseTo(0.69, 1);
    // katakumbyDark = #1A1410 → r≈0.10, g≈0.08, b≈0.063
    expect(eff6.caveColor.r).toBeCloseTo(0.1, 1);

    // The two primary colors must be different.
    expect(eff1.skyColor.r).not.toBeCloseTo(eff6.caveColor.r, 2);
  });
});
