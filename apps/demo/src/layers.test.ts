import { describe, expect, it } from 'bun:test';
import { Layer, Mask } from './layers';

function pairCollides(layerA: number, maskA: number, layerB: number, maskB: number): boolean {
  return (layerA & maskB) !== 0 || (layerB & maskA) !== 0;
}

describe('collision layers', () => {
  it('player bullet hits enemy', () => {
    expect(pairCollides(Layer.playerBullet, Mask.playerBullet, Layer.enemy, Mask.enemy)).toBe(true);
  });

  it('enemy bullet hits player', () => {
    expect(pairCollides(Layer.enemyBullet, Mask.enemyBullet, Layer.player, Mask.player)).toBe(true);
  });

  it('player bullet does not hit player', () => {
    expect(pairCollides(Layer.playerBullet, Mask.playerBullet, Layer.player, Mask.player)).toBe(
      false,
    );
  });

  it('enemy bullet does not hit enemy', () => {
    expect(pairCollides(Layer.enemyBullet, Mask.enemyBullet, Layer.enemy, Mask.enemy)).toBe(false);
  });

  it('player touches enemy directly', () => {
    expect(pairCollides(Layer.player, Mask.player, Layer.enemy, Mask.enemy)).toBe(true);
  });

  it('player bullet does not hit enemy bullet', () => {
    expect(
      pairCollides(Layer.playerBullet, Mask.playerBullet, Layer.enemyBullet, Mask.enemyBullet),
    ).toBe(false);
  });

  it('layers are mutually exclusive bits', () => {
    const all = Layer.player | Layer.enemy | Layer.playerBullet | Layer.enemyBullet;
    const sum = Layer.player + Layer.enemy + Layer.playerBullet + Layer.enemyBullet;
    expect(all).toBe(sum);
  });
});
