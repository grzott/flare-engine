import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createZone1Bg } from '../src/bg/zone1-bg';

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
  } as unknown as Parameters<typeof createZone1Bg>[0]['atlas'];
}

const VW = 360;
const VH = 640;

describe('zone-1 shader bg', () => {
  test('spawns exactly 2 entities', () => {
    const world = new World();
    createZone1Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
  });

  test('fire entity: z=-100, fullscreen size, effect kind=fire', () => {
    const world = new World();
    createZone1Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const fireSprite = sprites.find((s) => s!.z === -100);
    expect(fireSprite).toBeDefined();
    expect(fireSprite!.width).toBe(VW);
    expect(fireSprite!.height).toBe(VH);
    expect(fireSprite!.effect?.type).toBe('fire');
  });

  test('fog entity: z=-90, fullscreen size, effect kind=fog', () => {
    const world = new World();
    createZone1Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const fogSprite = sprites.find((s) => s!.z === -90);
    expect(fogSprite).toBeDefined();
    expect(fogSprite!.width).toBe(VW);
    expect(fogSprite!.height).toBe(VH);
    expect(fogSprite!.effect?.type).toBe('fog');
  });
});
