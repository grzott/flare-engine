import { describe, expect, it } from 'bun:test';
import { updateEffect, water } from '../src/sprite-effects.js';
import type { AnySpriteEffect, SpriteColor } from '../src/sprite-effects.js';

const blue: SpriteColor = { r: 0.1, g: 0.3, b: 0.8, a: 1 };
const white: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };

describe('WaterEffect', () => {
  it('water() factory returns correct shape', () => {
    const e = water(blue, white, 1.5, 0.02);
    expect(e.type).toBe('water');
    expect(e.color).toBe(blue);
    expect(e.foamColor).toBe(white);
    expect(e.waveSpeed).toBe(1.5);
    expect(e.waveAmplitude).toBe(0.02);
  });

  it('updateEffect returns same reference for water (time-invariant)', () => {
    const e = water(blue, white, 1.5, 0.02);
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 100)).toBe(e);
  });

  it('type discriminates in a switch over AnySpriteEffect including water arm', () => {
    const effects: AnySpriteEffect[] = [water(blue, white, 2.0, 0.05)];
    const matched: string[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'tint':
          matched.push('tint');
          break;
        case 'flash':
          matched.push('flash');
          break;
        case 'grayscale':
          matched.push('grayscale');
          break;
        case 'outline':
          matched.push('outline');
          break;
        case 'custom':
          matched.push('custom');
          break;
        case 'water':
          matched.push(`water:${e.waveSpeed}`);
          break;
      }
    }
    expect(matched).toEqual(['water:2']);
  });
});
