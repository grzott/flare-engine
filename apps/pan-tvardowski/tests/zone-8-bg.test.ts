import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createZone8Bg } from '../src/bg/zone8-bg';

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
  } as unknown as Parameters<typeof createZone8Bg>[0]['atlas'];
}

const VW = 360;
const VH = 640;

describe('zone-8 shader bg', () => {
  test('spawns exactly 2 entities (water + fog)', () => {
    const world = new World();
    createZone8Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
  });

  test('water entity z=-100 + effect kind=water; fog entity z=-90 + effect kind=fog', () => {
    const world = new World();
    createZone8Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const waterSprite = sprites.find((s) => s!.z === -100);
    const fogSprite = sprites.find((s) => s!.z === -90);
    expect(waterSprite).toBeDefined();
    expect(waterSprite!.effect?.type).toBe('water');
    expect(fogSprite).toBeDefined();
    expect(fogSprite!.effect?.type).toBe('fog');
  });
});
