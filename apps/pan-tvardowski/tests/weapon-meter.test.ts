import { beforeEach, describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';
import { gameState, resetGameState } from '../src/state';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('weapon meter — state', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('weaponLevel initialises to 0', () => {
    expect(gameState.weaponLevel).toBe(0);
  });

  test('weaponCooldownPct initialises to 1.0', () => {
    expect(gameState.weaponCooldownPct).toBe(1.0);
  });

  test('resetGameState resets weaponLevel to 0', () => {
    gameState.weaponLevel = 3;
    resetGameState();
    expect(gameState.weaponLevel).toBe(0);
  });

  test('resetGameState resets weaponCooldownPct to 1.0', () => {
    gameState.weaponCooldownPct = 0.4;
    resetGameState();
    expect(gameState.weaponCooldownPct).toBe(1.0);
  });
});

describe('weapon meter — styles', () => {
  test('weaponSegmentFilled uses crimson color', () => {
    expect(rawStyles.weaponSegmentFilled.backgroundColor).toBe(UI_COLORS.crimson);
  });

  test('weaponSegment (dim) uses tint55 color', () => {
    expect(rawStyles.weaponSegment.backgroundColor).toBe(UI_COLORS.tint55);
  });

  test('weaponSegmentCooldown exists and has overflow hidden', () => {
    expect(rawStyles.weaponSegmentCooldown).toBeDefined();
    expect(rawStyles.weaponSegmentCooldown.overflow).toBe('hidden');
  });

  test('weaponSegmentCooldownFill uses crimson color', () => {
    expect(rawStyles.weaponSegmentCooldownFill).toBeDefined();
    expect(rawStyles.weaponSegmentCooldownFill.backgroundColor).toBe(UI_COLORS.crimson);
  });

  test('weaponSegmentCooldown and weaponSegment have same dimensions', () => {
    expect(rawStyles.weaponSegmentCooldown.width).toBe(rawStyles.weaponSegment.width);
    expect(rawStyles.weaponSegmentCooldown.height).toBe(rawStyles.weaponSegment.height);
  });
});
