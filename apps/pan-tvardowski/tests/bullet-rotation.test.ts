/**
 * Pure unit tests for bulletSpriteRotation.
 * No engine dependencies — no symlink guard needed.
 */

import { describe, expect, test } from 'bun:test';
import { bulletSpriteRotation } from '../src/fx/bullet-rotation';

describe('bulletSpriteRotation', () => {
  test('up (0, -v) → 0 (player fires upward, sprite unchanged)', () => {
    expect(bulletSpriteRotation(0, -520)).toBeCloseTo(0, 10);
  });

  test('down (0, v) → π (enemy fires downward)', () => {
    expect(bulletSpriteRotation(0, 520)).toBeCloseTo(Math.PI, 10);
  });

  test('right (v, 0) → π/2', () => {
    expect(bulletSpriteRotation(100, 0)).toBeCloseTo(Math.PI / 2, 10);
  });

  test('left (-v, 0) → 3π/2 (same heading as −π/2, atan2 branch)', () => {
    expect(bulletSpriteRotation(-100, 0)).toBeCloseTo((3 * Math.PI) / 2, 10);
  });

  test('diagonal (v, v) → 3π/4', () => {
    expect(bulletSpriteRotation(100, 100)).toBeCloseTo((3 * Math.PI) / 4, 10);
  });

  test('zero velocity (0, 0) → π/2 (atan2(0,0)=0, acceptable edge)', () => {
    expect(bulletSpriteRotation(0, 0)).toBeCloseTo(Math.PI / 2, 10);
  });
});
