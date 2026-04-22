import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { createZone3TilemapBg, zone3TilemapJson } from '../src/bg/tilemap-bg';

function buildAtlas() {
  const waterFrame = { name: 'tile-water', x: 0, y: 0, w: 32, h: 32 };
  const fogFrame = { name: 'tile-fog', x: 32, y: 0, w: 32, h: 32 };
  const frameMap = new Map<string, number>([
    ['tile-water', 0],
    ['tile-fog', 1],
  ]);
  return {
    image: {} as never,
    sheet: {
      frames: [waterFrame, fogFrame],
      frameMap,
      animations: new Map(),
    },
  } as unknown as Parameters<typeof createZone3TilemapBg>[0]['atlas'];
}

describe('zone-3 tilemap bg', () => {
  test('parses a 12×20 map with two tile layers', () => {
    const raw = zone3TilemapJson() as {
      width: number;
      height: number;
      layers: unknown[];
    };
    expect(raw.width).toBe(12);
    expect(raw.height).toBe(20);
    expect(raw.layers.length).toBe(2);
  });

  test('spawns sprite entities for every water tile (240 min)', () => {
    const world = new World();
    const bg = createZone3TilemapBg({
      world,
      atlas: buildAtlas(),
      viewportWidth: 360,
      viewportHeight: 640,
    });
    const count = [...world.query(Position)].length;
    // Water is solid → 12×20 = 240; fog adds a small number on top.
    expect(count).toBeGreaterThanOrEqual(240);
    expect(bg.data.width).toBe(12);
    expect(bg.data.height).toBe(20);
  });

  test('update scrolls tiles downward and wraps at map height', () => {
    const world = new World();
    const bg = createZone3TilemapBg({
      world,
      atlas: buildAtlas(),
      viewportWidth: 360,
      viewportHeight: 640,
    });
    const ids = [...world.query(Position)];
    const id0 = ids[0]!;
    const y0 = world.get(id0, Position)!.y;
    bg.update(0.5, 640);
    const y1 = world.get(id0, Position)!.y;
    expect(y1).not.toBe(y0);
    // After a full map height worth of scroll, y returns near original.
    const mapHeightPx = bg.data.height * bg.data.tileHeight;
    const totalSec = mapHeightPx / 35; // SCROLL_SPEED
    bg.update(totalSec - 0.5, 640); // already advanced 0.5 above
    const y2 = world.get(id0, Position)!.y;
    expect(Math.abs(y2 - y0)).toBeLessThan(1);
  });

  test('destroy removes every spawned tile entity', () => {
    const world = new World();
    const bg = createZone3TilemapBg({
      world,
      atlas: buildAtlas(),
      viewportWidth: 360,
      viewportHeight: 640,
    });
    expect([...world.query(Position)].length).toBeGreaterThan(0);
    bg.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });
});
