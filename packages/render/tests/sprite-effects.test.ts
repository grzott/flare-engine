import { describe, expect, it } from 'bun:test';
import {
  custom,
  dropShadow,
  flash,
  flashIntensity,
  grayscale,
  outline,
  tint,
  updateEffect,
} from '../src/sprite-effects.js';
import type { AnySpriteEffect, FlashEffect, SpriteColor } from '../src/sprite-effects.js';

const white: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };
const red: SpriteColor = { r: 1, g: 0, b: 0, a: 1 };

describe('SpriteEffects', () => {
  describe('tint', () => {
    it('creates a tint effect', () => {
      const e = tint(red, 0.5);
      expect(e.type).toBe('tint');
      expect(e.color).toEqual(red);
      expect(e.amount).toBe(0.5);
    });

    it('updateEffect returns the same reference (time-invariant)', () => {
      const e = tint(red, 0.5);
      expect(updateEffect(e, 1)).toBe(e);
    });
  });

  describe('flash', () => {
    it('creates a flash effect with elapsed=0', () => {
      const e = flash(white, 0.3);
      expect(e.type).toBe('flash');
      expect(e.duration).toBe(0.3);
      expect(e.elapsed).toBe(0);
    });

    it('updateEffect returns a new FlashEffect with advanced elapsed', () => {
      const e = flash(white, 0.3);
      const e1 = updateEffect(e, 0.1);
      expect(e1).not.toBe(e);
      expect(e1?.type).toBe('flash');
      expect((e1 as FlashEffect).elapsed).toBeCloseTo(0.1);
      // Original is untouched
      expect(e.elapsed).toBe(0);
    });

    it('updateEffect does not mutate the input effect', () => {
      const e = flash(white, 0.3);
      updateEffect(e, 0.25);
      expect(e.elapsed).toBe(0);
    });

    it('updateEffect returns null when the effect expires', () => {
      const e = flash(white, 0.3);
      const e1 = updateEffect(e, 0.1) as FlashEffect;
      const e2 = updateEffect(e1, 0.1) as FlashEffect;
      const e3 = updateEffect(e2, 0.2); // 0.4 >= 0.3 → expired
      expect(e3).toBeNull();
    });

    it('flashIntensity decays from 1 to 0 via successive updates', () => {
      let e: FlashEffect | null = flash(white, 1.0);
      expect(flashIntensity(e)).toBeCloseTo(1);
      e = updateEffect(e, 0.5) as FlashEffect;
      expect(flashIntensity(e)).toBeCloseTo(0.5);
      const expired = updateEffect(e, 0.5);
      expect(expired).toBeNull();
    });

    it('flashIntensity handles zero duration', () => {
      const e = flash(white, 0);
      expect(flashIntensity(e)).toBe(0);
    });
  });

  describe('grayscale', () => {
    it('creates a grayscale effect', () => {
      const e = grayscale(0.75);
      expect(e.type).toBe('grayscale');
      expect(e.amount).toBe(0.75);
    });

    it('updateEffect returns the same reference', () => {
      const e = grayscale(0.5);
      expect(updateEffect(e, 1)).toBe(e);
    });
  });

  describe('outline', () => {
    it('creates an outline effect', () => {
      const e = outline(red, 2);
      expect(e.type).toBe('outline');
      expect(e.color).toEqual(red);
      expect(e.width).toBe(2);
    });

    it('updateEffect returns the same reference', () => {
      const e = outline(red, 2);
      expect(updateEffect(e, 1)).toBe(e);
    });
  });

  describe('custom', () => {
    it('creates a custom shader effect', () => {
      const shader = {};
      const uniforms = { u_time: 0.5, u_res: [390, 844] as const };
      const e = custom(shader, uniforms);
      expect(e.type).toBe('custom');
    });

    it('preserves shader and uniforms by reference (batching identity)', () => {
      const shader = {};
      const uniforms = { u_time: 0 };
      const e = custom(shader, uniforms);
      expect(e.shader).toBe(shader);
      expect(e.uniforms).toBe(uniforms);
    });

    it('updateEffect returns the same reference (time-invariant)', () => {
      const e = custom({}, { u_intensity: 1 });
      expect(updateEffect(e, 0.016)).toBe(e);
      expect(updateEffect(e, 100)).toBe(e);
    });

    it('type discriminates in a switch over AnySpriteEffect', () => {
      const effects: AnySpriteEffect[] = [
        tint(red, 0.5),
        flash(white, 0.3),
        grayscale(0.5),
        outline(red, 2),
        custom({}, { u_scale: 2 }),
      ];
      const matched: string[] = [];
      for (const e of effects) {
        switch (e.type) {
          case 'tint':
            matched.push(`tint:${e.amount}`);
            break;
          case 'flash':
            matched.push(`flash:${e.duration}`);
            break;
          case 'grayscale':
            matched.push(`grayscale:${e.amount}`);
            break;
          case 'outline':
            matched.push(`outline:${e.width}`);
            break;
          case 'custom':
            matched.push(`custom:${e.uniforms.u_scale}`);
            break;
        }
      }
      expect(matched).toEqual(['tint:0.5', 'flash:0.3', 'grayscale:0.5', 'outline:2', 'custom:2']);
    });
  });

  describe('dropShadow', () => {
    const shadow: SpriteColor = { r: 0, g: 0, b: 0, a: 0.5 };

    it('creates a drop-shadow effect with explicit offset, blur, and color', () => {
      const e = dropShadow({ color: shadow, offsetX: 2, offsetY: 8, blur: 5 });
      expect(e.type).toBe('drop-shadow');
      expect(e.offsetX).toBe(2);
      expect(e.offsetY).toBe(8);
      expect(e.blur).toBe(5);
      expect(e.color).toEqual(shadow);
    });

    it('defaults to a downward-offset soft shadow for grounding', () => {
      const e = dropShadow({ color: shadow });
      expect(e.offsetX).toBe(0);
      expect(e.offsetY).toBe(6);
      expect(e.blur).toBe(4);
    });

    it('updateEffect returns the same reference (time-invariant)', () => {
      const e = dropShadow({ color: shadow });
      expect(updateEffect(e, 1)).toBe(e);
    });

    it('discriminates as drop-shadow in a switch over AnySpriteEffect', () => {
      const effects: AnySpriteEffect[] = [
        tint(red, 0.5),
        dropShadow({ color: shadow, offsetY: 8 }),
      ];
      let groundedAt = -1;
      for (const e of effects) {
        if (e.type === 'drop-shadow') groundedAt = e.offsetY;
      }
      expect(groundedAt).toBe(8);
    });
  });
});
