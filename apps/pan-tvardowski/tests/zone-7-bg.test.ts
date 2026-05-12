import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createZone7Bg } from '../src/bg/zone7-bg';

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
  } as unknown as Parameters<typeof createZone7Bg>[0]['atlas'];
}

const VW = 360;
const VH = 640;

describe('zone-7 shader bg', () => {
  test('spawns exactly 2 entities', () => {
    const world = new World();
    createZone7Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
  });

  test('fire entity: z=-100, fullscreen size, effect kind=fire', () => {
    const world = new World();
    createZone7Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const fireSprite = sprites.find((s) => s!.z === -100);
    expect(fireSprite).toBeDefined();
    expect(fireSprite!.width).toBe(VW);
    expect(fireSprite!.height).toBe(VH);
    expect(fireSprite!.effect?.type).toBe('fire');
  });

  test('smoke-haze entity: z=-90, fullscreen size, effect kind=fog; destroy removes both', () => {
    const world = new World();
    const ctrl = createZone7Bg({
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
    });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const smokeSprite = sprites.find((s) => s!.z === -90);
    expect(smokeSprite).toBeDefined();
    expect(smokeSprite!.width).toBe(VW);
    expect(smokeSprite!.height).toBe(VH);
    expect(smokeSprite!.effect?.type).toBe('fog');

    ctrl.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });
});
