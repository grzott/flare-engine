import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createZone3Bg } from '../src/bg/zone3-bg';

function buildAtlas() {
  const waterFrame = { name: 'tile-water', x: 0, y: 0, w: 32, h: 32 };
  const frameMap = new Map<string, number>([['tile-water', 0]]);
  return {
    image: {} as never,
    sheet: {
      frames: [waterFrame],
      frameMap,
      animations: new Map(),
    },
  } as unknown as Parameters<typeof createZone3Bg>[0]['atlas'];
}

const VW = 360;
const VH = 640;

describe('zone-3 shader bg', () => {
  test('spawns exactly 2 entities', () => {
    const world = new World();
    createZone3Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
  });

  test('water entity: z=-100, fullscreen size, effect kind=water', () => {
    const world = new World();
    createZone3Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const waterSprite = sprites.find((s) => s!.z === -100);
    expect(waterSprite).toBeDefined();
    expect(waterSprite!.width).toBe(VW);
    expect(waterSprite!.height).toBe(VH);
    expect(waterSprite!.effect?.type).toBe('water');
  });

  test('fog entity: z=-90, fullscreen size, effect kind=fog', () => {
    const world = new World();
    createZone3Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const fogSprite = sprites.find((s) => s!.z === -90);
    expect(fogSprite).toBeDefined();
    expect(fogSprite!.width).toBe(VW);
    expect(fogSprite!.height).toBe(VH);
    expect(fogSprite!.effect?.type).toBe('fog');
  });

  test('both entities centered at viewport midpoint', () => {
    const world = new World();
    createZone3Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const positions = [...world.query(Position)].map((id) => world.get(id, Position)!);
    for (const pos of positions) {
      expect(pos.x).toBe(VW / 2);
      expect(pos.y).toBe(VH / 2);
    }
  });

  test('destroy removes both entities', () => {
    const world = new World();
    const bg = createZone3Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
    bg.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });
});
