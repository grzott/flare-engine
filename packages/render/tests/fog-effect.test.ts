import { describe, expect, it } from 'bun:test';
import { fog, updateEffect } from '../src/sprite-effects.js';
import type { AnySpriteEffect, SpriteColor } from '../src/sprite-effects.js';

const gray: SpriteColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

describe('FogEffect', () => {
  it('fog() factory — defaults', () => {
    const e = fog(gray);
    expect(e.type).toBe('fog');
    expect(e.color).toBe(gray);
    expect(e.density).toBe(0.5);
    expect(e.speed).toBe(0.3);
    expect(e.scale).toBe(2.0);
  });

  it('fog() factory — explicit overrides', () => {
    const color: SpriteColor = { r: 0.1, g: 0.2, b: 0.3, a: 1 };
    const e = fog(color, 0.8, 1.2, 3.5);
    expect(e.type).toBe('fog');
    expect(e.color).toBe(color);
    expect(e.density).toBe(0.8);
    expect(e.speed).toBe(1.2);
    expect(e.scale).toBe(3.5);
  });

  it('updateEffect — fog is time-invariant', () => {
    const e = fog(gray, 0.6, 0.4, 1.5);
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 100)).toBe(e);
  });

  it('type discrimination — fog arm in switch over AnySpriteEffect', () => {
    const effects: AnySpriteEffect[] = [fog(gray, 0.8, 0.3, 2.0)];
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
          matched.push('water');
          break;
        case 'fog':
          matched.push(`fog:${e.density}`);
          break;
      }
    }
    expect(matched).toContain('fog:0.8');
  });
});
