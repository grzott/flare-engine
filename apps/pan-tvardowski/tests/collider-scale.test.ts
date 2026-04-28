import { describe, expect, test } from 'bun:test';
import {
  COLLIDER_SCALE_BOSS,
  COLLIDER_SCALE_ENEMY,
  COLLIDER_SCALE_MINIBOSS,
} from '../src/config/gameplay';

/**
 * Collider scale audit — PT-Bugfix-B M1.
 *
 * These tests assert the geometry constants that control AABB sizing for
 * each entity class. Values are intentionally NOT balance-frozen (they are
 * geometry, not damage/HP) — they can be tuned post-launch without bumping
 * BALANCE_FROZEN_AT. The test suite guards the *minimum acceptable* values
 * so a typo can't silently shrink hitboxes.
 */

describe('collider-scale constants — session #47 M1', () => {
  test('enemy scale is 0.7 (fair hitbox for fast movers)', () => {
    expect(COLLIDER_SCALE_ENEMY).toBe(0.7);
  });

  test('miniboss scale is 0.85 (tighter than boss, wider than enemy)', () => {
    expect(COLLIDER_SCALE_MINIBOSS).toBe(0.85);
  });

  test('boss scale is 0.9 (large, slow — generous hitbox)', () => {
    expect(COLLIDER_SCALE_BOSS).toBe(0.9);
  });

  test('scale ordering: enemy < miniboss < boss', () => {
    expect(COLLIDER_SCALE_ENEMY).toBeLessThan(COLLIDER_SCALE_MINIBOSS);
    expect(COLLIDER_SCALE_MINIBOSS).toBeLessThan(COLLIDER_SCALE_BOSS);
  });

  test('all scales are in range (0, 1]', () => {
    for (const s of [COLLIDER_SCALE_ENEMY, COLLIDER_SCALE_MINIBOSS, COLLIDER_SCALE_BOSS]) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
