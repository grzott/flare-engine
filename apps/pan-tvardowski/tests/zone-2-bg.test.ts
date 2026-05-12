import { describe, expect, test } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createZone2Bg } from '../src/bg/zone2-bg';

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
  } as unknown as Parameters<typeof createZone2Bg>[0]['atlas'];
}

const VW = 360;
const VH = 640;

describe('zone-2 shader bg', () => {
  test('spawns exactly 2 entities', () => {
    const world = new World();
    createZone2Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    expect([...world.query(Position)].length).toBe(2);
  });

  test('pine-mist entity: z=-100, fullscreen size, effect kind=fog', () => {
    const world = new World();
    createZone2Bg({ world, atlas: buildAtlas(), viewportWidth: VW, viewportHeight: VH });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const pineMist = sprites.find((s) => s!.z === -100);
    expect(pineMist).toBeDefined();
    expect(pineMist!.width).toBe(VW);
    expect(pineMist!.height).toBe(VH);
    expect(pineMist!.effect?.type).toBe('fog');
  });

  test('pollen-haze entity: z=-90, fullscreen size, effect kind=fog; destroy removes both', () => {
    const world = new World();
    const ctrl = createZone2Bg({
      world,
      atlas: buildAtlas(),
      viewportWidth: VW,
      viewportHeight: VH,
    });
    const ids = [...world.query(Position)];
    const sprites = ids.map((id) => world.get(id, Sprite)).filter((s) => s !== null);
    const pollenHaze = sprites.find((s) => s!.z === -90);
    expect(pollenHaze).toBeDefined();
    expect(pollenHaze!.width).toBe(VW);
    expect(pollenHaze!.height).toBe(VH);
    expect(pollenHaze!.effect?.type).toBe('fog');

    ctrl.destroy();
    expect([...world.query(Position)].length).toBe(0);
  });
});
