import { describe, expect, it } from 'bun:test';
import {
  type AnySpriteEffect,
  type FireEffect,
  fire,
  updateEffect,
} from '../src/sprite-effects.js';

describe('fire effect', () => {
  it('fire() with required args applies defaults for speed and intensity', () => {
    const color = { r: 1, g: 0.4, b: 0, a: 1 };
    const tipColor = { r: 1, g: 1, b: 0, a: 1 };
    const effect = fire({ color, tipColor });
    expect(effect.type).toBe('fire');
    expect(effect.color).toBe(color);
    expect(effect.tipColor).toBe(tipColor);
    expect(effect.speed).toBe(1.0);
    expect(effect.intensity).toBe(0.8);
  });

  it('fire() with explicit overrides passes speed and intensity through', () => {
    const effect = fire({
      color: { r: 1, g: 0, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
      speed: 2.5,
      intensity: 0.5,
    });
    expect(effect.speed).toBe(2.5);
    expect(effect.intensity).toBe(0.5);
  });

  it('updateEffect for fire is time-invariant — returns the same reference', () => {
    const effect: FireEffect = fire({
      color: { r: 1, g: 0, b: 0, a: 1 },
      tipColor: { r: 1, g: 1, b: 0, a: 1 },
    });
    const result1 = updateEffect(effect, 0.016);
    const result2 = updateEffect(effect, 99);
    expect(result1).toBe(effect);
    expect(result2).toBe(effect);
  });

  it('AnySpriteEffect fire arm — switch over array including fire executes the arm', () => {
    const effects: AnySpriteEffect[] = [
      fire({ color: { r: 1, g: 0, b: 0, a: 1 }, tipColor: { r: 1, g: 1, b: 0, a: 1 } }),
    ];
    let fireHit = false;
    for (const e of effects) {
      switch (e.type) {
        case 'fire':
          fireHit = true;
          break;
        default:
          break;
      }
    }
    expect(fireHit).toBe(true);
  });
});
