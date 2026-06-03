import { describe, expect, test } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { AnySpriteEffect } from '@flare-engine/render';
import { createZoneBg } from '../src/bg/create-zone-bg';
import type { ZoneBgCamera, ZoneBgDeps } from '../src/bg/create-zone-bg';

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

function makeMockImage(w: number, h: number): SkImageLike {
  return {
    width: () => w,
    height: () => h,
    readPixels: () => null,
  };
}

function spawnBg(
  zoneId: string,
  camera: ZoneBgCamera = buildCamera(),
  extraDeps: Partial<ZoneBgDeps> = {},
) {
  const world = new World();
  const atlas = buildAtlas();
  const controller = createZoneBg(zoneId, {
    world,
    atlas,
    viewportWidth: VW,
    viewportHeight: VH,
    camera,
    ...extraDeps,
  });
  return { world, controller };
}

// ---------------------------------------------------------------------------
// Block 1 — entity shape: shader zones (z2-z8)
// ---------------------------------------------------------------------------

describe('createZoneBg — entity shape (shader zones)', () => {
  const shaderZones: [string, AnySpriteEffect['type']][] = [
    ['z2', 'forest-canopy'],
    ['z3', 'river-wave'],
    ['z4', 'forest-canopy'],
    ['z5', 'mountain-hills'],
    ['z6', 'cave-interior'],
    ['z7', 'roofs-city'],
    ['z8', 'moon-crater'],
  ];

  for (const [zoneId, expectedEffectType] of shaderZones) {
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
});

// ---------------------------------------------------------------------------
// Block 1b — dispatch routing
// ---------------------------------------------------------------------------

describe('createZoneBg — dispatch routing', () => {
  test('z1 (image kind) → 2 entities, effect === undefined', () => {
    const { world, controller } = spawnBg('z1');

    const ids = [...world.query(Position)];
    expect(ids.length).toBe(2);

    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      expect(sprite).toBeTruthy();
      expect(sprite.effect).toBeUndefined();
    }

    controller.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });

  test('z2 (shader kind) → 2 entities, effect type forest-canopy', () => {
    const { world } = spawnBg('z2');
    const ids = [...world.query(Position)];
    expect(ids.length).toBe(2);
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      expect(sprite.effect?.type).toBe('forest-canopy');
    }
  });
});

// ---------------------------------------------------------------------------
// Block 1c — z1 fullscreen-coverage pin (camera-sync resize)
// ---------------------------------------------------------------------------

describe('createZoneBg — z1 fullscreen-coverage pin', () => {
  test('after tick(0) both sprites sized to camera viewport, x centred', () => {
    const CANVAS_W = 393;
    const CANVAS_H = 852;
    const PLAY_W = 393;
    const PLAY_H = 818;

    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: PLAY_W,
      viewportHeight: PLAY_H,
      camera: buildCamera(CANVAS_W, CANVAS_H),
    });

    controller.tick(0);

    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const pos = world.get(id, Position)!;
      expect(sprite.width).toBe(CANVAS_W);
      expect(sprite.height).toBe(CANVAS_H);
      expect(pos.x).toBe(CANVAS_W / 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 2 — kind-specific density param routing (shader zones)
// ---------------------------------------------------------------------------

describe('kind-specific density param routing', () => {
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
// Block 3 — scrollSpeed tick integration (shader zones)
// ---------------------------------------------------------------------------

describe('scrollSpeed tick integration (shader zones)', () => {
  test('z2: tick(1.0) → effect.scrollOffsetY === 12', () => {
    const { world, controller } = spawnBg('z2');
    controller.tick(1.0);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { scrollOffsetY: number };
      expect(effect.scrollOffsetY).toBe(12);
    }
  });

  test('z2: second tick(1.0) → scrollOffsetY doubles (accumulates)', () => {
    const { world, controller } = spawnBg('z2');
    controller.tick(1.0);
    controller.tick(1.0);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { scrollOffsetY: number };
      expect(effect.scrollOffsetY).toBe(24);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 4 — resolution wired into effect (shader UV correctness)
// ---------------------------------------------------------------------------

describe('resolution wired into effect', () => {
  test('at spawn: z2 effect.resolutionW/H match camera viewport', () => {
    const CANVAS_W = 393;
    const CANVAS_H = 852;
    const { world } = spawnBg('z2', buildCamera(CANVAS_W, CANVAS_H));
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { resolutionW: number; resolutionH: number };
      expect(effect.resolutionW).toBe(CANVAS_W);
      expect(effect.resolutionH).toBe(CANVAS_H);
    }
  });

  test('after tick(): z2 effect.resolutionW/H track updated viewport', () => {
    const CANVAS_W = 412;
    const CANVAS_H = 900;
    const { world, controller } = spawnBg('z2', buildCamera(CANVAS_W, CANVAS_H));
    controller.tick(0.016);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      const effect = sprite.effect as { resolutionW: number; resolutionH: number };
      expect(effect.resolutionW).toBe(CANVAS_W);
      expect(effect.resolutionH).toBe(CANVAS_H);
    }
  });

  test('distinct shader zones produce distinct colors: z2 (moss skyColor) vs z6 (katakumbyDark caveColor)', () => {
    const { world: w2 } = spawnBg('z2');
    const { world: w6 } = spawnBg('z6');

    const ids2 = [...w2.query(Position)];
    const ids6 = [...w6.query(Position)];

    const eff2 = w2.get(ids2[0]!, Sprite)!.effect as {
      type: string;
      skyColor: { r: number; g: number; b: number };
    };
    const eff6 = w6.get(ids6[0]!, Sprite)!.effect as {
      type: string;
      caveColor: { r: number; g: number; b: number };
    };

    expect(eff2.type).toBe('forest-canopy');
    expect(eff6.type).toBe('cave-interior');
    expect(eff2.skyColor.r).not.toBeCloseTo(eff6.caveColor.r, 2);
  });
});

// ---------------------------------------------------------------------------
// Block 5 — z1 image BG: 2-entity spawn + destroy
// ---------------------------------------------------------------------------

describe('z1 image BG — spawn and destroy', () => {
  test('spawn with no bg → 2 entities, both alpha 0', () => {
    const { world, controller } = spawnBg('z1', buildCamera(), { bg: null });

    const ids = [...world.query(Position)];
    expect(ids.length).toBe(2);

    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      expect(sprite).toBeTruthy();
      expect(sprite.alpha).toBe(0);
      expect(sprite.effect).toBeUndefined();
    }

    controller.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });

  test('cover dims — both sprites width === vw, height === vh at spawn', () => {
    const { world } = spawnBg('z1', buildCamera(VW, VH), { bg: null });
    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      // Width/height set during tick; at spawn they are initW/initH = VW/VH.
      expect(sprite.width).toBe(VW);
      expect(sprite.height).toBe(VH);
    }
  });

  test('cover dims — resize on larger camera after tick', () => {
    const LARGE_W = 800;
    const LARGE_H = 1200;
    const world = new World();
    const cam = { viewportWidth: LARGE_W, viewportHeight: LARGE_H };
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
      camera: cam,
      bg: null,
    });

    controller.tick(0.016);

    const ids = [...world.query(Position)];
    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      expect(sprite.width).toBe(LARGE_W);
      expect(sprite.height).toBe(LARGE_H);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 6 — z1 image BG: null→live transition
// ---------------------------------------------------------------------------

describe('z1 image BG — null→live transition', () => {
  test('tick with bg.image null → both alpha still 0', () => {
    const { world, controller } = spawnBg('z1', buildCamera(), {
      bg: { image: null, frame: { name: 'bg', x: 0, y: 0, w: 0, h: 0 } },
    });
    controller.tick(0.016);

    const ids = [...world.query(Position)];
    for (const id of ids) {
      expect(world.get(id, Sprite)!.alpha).toBe(0);
    }
  });

  test('tick after bg.image becomes non-null → both alpha 1, image === mock, frame.w === mock.width()', () => {
    const mockImage = makeMockImage(1080, 1920);
    let currentImage: SkImageLike | null = null;

    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
      camera: buildCamera(),
      bg: {
        get image() {
          return currentImage;
        },
        frame: { name: 'bg', x: 0, y: 0, w: 0, h: 0 },
      },
    });

    // First tick — image still null.
    controller.tick(0.016);
    const ids = [...world.query(Position)];
    for (const id of ids) {
      expect(world.get(id, Sprite)!.alpha).toBe(0);
    }

    // Image arrives.
    currentImage = mockImage;
    controller.tick(0.016);

    for (const id of ids) {
      const sprite = world.get(id, Sprite)!;
      expect(sprite.alpha).toBe(1);
      expect(sprite.image).toBe(mockImage);
      expect(sprite.frame.w).toBe(1080);
      expect(sprite.frame.h).toBe(1920);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 7 — z1 image BG: scroll advances
// ---------------------------------------------------------------------------

describe('z1 image BG — scroll advances', () => {
  test('tick(1.0) with scrollSpeed 18 → both posY advanced by +18 relative to initial', () => {
    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
      camera: buildCamera(VW, VH),
      bg: null,
    });

    // Capture initial Y positions before tick.
    const ids = [...world.query(Position)];
    const initY = ids.map((id) => world.get(id, Position)!.y);

    controller.tick(1.0);

    for (let i = 0; i < ids.length; i++) {
      const posY = world.get(ids[i]!, Position)!.y;
      // After 1s at scrollSpeed 18, y should advance by 18 unless wrap fired.
      // Initial posBot.y = cy = VH/2 = 320; after +18 = 338; cy+vh = 320+640 = 960; no wrap.
      // Initial posTop.y = cy - VH = 320 - 640 = -320; after +18 = -302; no wrap.
      expect(posY).toBeCloseTo(initY[i]! + 18, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 8 — z1 image BG: wrap-no-drift
// ---------------------------------------------------------------------------

describe('z1 image BG — wrap-no-drift', () => {
  test('sprite wraps when posY exceeds cy+vh: resets to exactly prior - 2*vh, other sprite stays vh apart', () => {
    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
      camera: buildCamera(VW, VH),
      bg: null,
    });

    const ids = [...world.query(Position)];
    // cy = VH/2 = 320; cy+vh = 320+640 = 960.
    // posBot starts at cy=320; posTop starts at cy-VH = -320.
    // We need posBot.y > 960. With scrollSpeed=18, it would take (960-320)/18 = ~35.6 ticks of dt=1.
    // Drive it there directly via many ticks.
    // After 40 ticks(dt=1): posBot = 320 + 40*18 = 1040, posTop = -320 + 40*18 = 400.
    // On the tick where posBot first exceeds 960, it should wrap by -2*VH.
    // Let's tick until we see a wrap by checking that posY is not monotonically increasing.

    let prevPositions = ids.map((id) => world.get(id, Position)!.y);
    let wrapDetected = false;

    for (let i = 0; i < 60; i++) {
      controller.tick(1.0);
      const nextPositions = ids.map((id) => world.get(id, Position)!.y);

      for (let j = 0; j < ids.length; j++) {
        // A wrap means the sprite jumped backward by close to 2*VH.
        const delta = nextPositions[j]! - prevPositions[j]!;
        if (delta < -VH) {
          // Should have moved scrollSpeed - 2*VH = 18 - 1280 = -1262 (approx).
          expect(delta).toBeCloseTo(18 - 2 * VH, 5);
          wrapDetected = true;
        }
      }
      prevPositions = nextPositions;
    }

    expect(wrapDetected).toBe(true);

    // After all ticks the two sprites must still be exactly VH apart.
    const finalY = ids.map((id) => world.get(id, Position)!.y);
    const gap = Math.abs(finalY[1]! - finalY[0]!);
    // They should be exactly VH = 640 apart (modulo possible both having wrapped).
    // The gap is either VH or 0 (if both wrapped same tick), but the design keeps them vh apart.
    // The wrap logic ensures that: when one wraps, it repositions to prior - 2*vh,
    // so gap remains vh. Check gap is multiple of VH and > 0.
    expect(gap % VH).toBeCloseTo(0, 5);
    expect(gap).toBeGreaterThan(0);
  });

  test('wrap exact reset: sprite that crosses cy+vh snaps to exactly (preWrapY + scrollSpeed*dt) - 2*vh', () => {
    const world = new World();
    const controller = createZoneBg('z1', {
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
      camera: buildCamera(VW, VH),
      bg: null,
    });

    // cy = 320, cy+vh = 960.
    // posBot starts at 320. Push it to just-below the threshold.
    // With dt=1, scrollSpeed=18: after 35 ticks → 320 + 35*18 = 950 (still < 960).
    for (let i = 0; i < 35; i++) controller.tick(1.0);

    const ids = [...world.query(Position)];
    const preWrapY = ids.map((id) => world.get(id, Position)!.y);

    // One more tick: 950+18=968 > 960 for posBot → wrap fires → 968 - 2*640 = -312.
    controller.tick(1.0);

    const postWrapY = ids.map((id) => world.get(id, Position)!.y);

    let foundWrap = false;
    for (let j = 0; j < ids.length; j++) {
      const expected = preWrapY[j]! + 18;
      if (expected > 960) {
        expect(postWrapY[j]!).toBeCloseTo(expected - 2 * VH, 5);
        foundWrap = true;
      } else {
        expect(postWrapY[j]!).toBeCloseTo(expected, 5);
      }
    }
    expect(foundWrap).toBe(true);
  });
});
