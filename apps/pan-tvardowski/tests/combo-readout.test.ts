import { beforeEach, describe, expect, test } from 'bun:test';
import { rawStyles } from '../src/hud/Hud.styles';
import { gameState, resetGameState } from '../src/state';

describe('combo readout — state', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('comboCount initialises to 0', () => {
    expect(gameState.comboCount).toBe(0);
  });

  test('comboHit initialises to false', () => {
    expect(gameState.comboHit).toBe(false);
  });

  test('resetGameState clears comboCount and comboHit', () => {
    gameState.comboCount = 7;
    gameState.comboHit = true;
    resetGameState();
    expect(gameState.comboCount).toBe(0);
    expect(gameState.comboHit).toBe(false);
  });
});

describe('combo readout — styles', () => {
  test('combo style is defined', () => {
    expect(rawStyles.combo).toBeDefined();
  });

  test('comboPulse has scale transform', () => {
    const pulse = rawStyles.comboPulse;
    expect(pulse).toBeDefined();
    expect(pulse.transform).toBeDefined();
    const scaleEntry = (pulse.transform as Record<string, number>[]).find((t) => 'scale' in t);
    expect(scaleEntry?.scale).toBe(1.18);
  });

  test('comboPulseReduced has opacity 0.6 and no transform', () => {
    const reduced = rawStyles.comboPulseReduced;
    expect(reduced).toBeDefined();
    expect(reduced.opacity).toBe(0.6);
    expect((reduced as Record<string, unknown>).transform).toBeUndefined();
  });

  test('comboPulse and combo share same color', () => {
    expect(rawStyles.comboPulse.color).toBe(rawStyles.combo.color);
  });

  test('comboPulseReduced and combo share same color', () => {
    expect(rawStyles.comboPulseReduced.color).toBe(rawStyles.combo.color);
  });
});
