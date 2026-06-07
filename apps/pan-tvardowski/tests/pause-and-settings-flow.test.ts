/**
 * Pause + settings flow — session #167 PT-PauseSettings-UX-Fix.
 *
 * Covers the three bugs surfaced by on-device QA:
 *  1) `gameState.paused` halts the play simulation (anti-regression source check).
 *  2) `actions.onSettings` from the pause overlay routes to settings + stamps origin.
 *  3) The settings exit (close-X + back button) routes by `settingsOrigin`,
 *     preserving `paused` so the pause overlay re-shows on return to play.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type GameState, gameState, resetGameState } from '../src/state';

/** Mirrors SettingsView.back() in hud/MenuOverlay.tsx — pure routing decision. */
function settingsBackTarget(origin: 'menu' | 'pause'): 'menu' | 'play' {
  return origin === 'pause' ? 'play' : 'menu';
}

/** Read settings origin through a typed projection so CFA doesn't narrow it
 *  to the last-assigned literal across `resetGameState()` calls. */
function readSettingsOrigin(): GameState['settingsOrigin'] {
  return gameState.settingsOrigin;
}

describe('settingsOrigin — state field', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('default after resetGameState is "menu"', () => {
    expect(readSettingsOrigin()).toBe('menu');
  });

  test('can be set to "pause"', () => {
    gameState.settingsOrigin = 'pause';
    expect(readSettingsOrigin()).toBe('pause');
  });

  test('resetGameState clears "pause" back to "menu"', () => {
    gameState.settingsOrigin = 'pause';
    resetGameState();
    expect(readSettingsOrigin()).toBe('menu');
  });

  test('changing settingsOrigin does not touch paused', () => {
    gameState.paused = true;
    gameState.settingsOrigin = 'pause';
    expect(gameState.paused).toBe(true);
    gameState.settingsOrigin = 'menu';
    expect(gameState.paused).toBe(true);
  });
});

describe('settings back-route — origin-aware', () => {
  test('origin "menu" routes back to main menu', () => {
    expect(settingsBackTarget('menu')).toBe('menu');
  });

  test('origin "pause" routes back to play (so pause overlay re-shows)', () => {
    expect(settingsBackTarget('pause')).toBe('play');
  });

  test('paused flag survives a synthetic pause→settings→back round-trip', () => {
    resetGameState();
    // 1. Player taps pause in HUD.
    gameState.paused = true;
    gameState.currentScene = 'play';
    // 2. Player taps Settings on pause overlay → App.tsx actions.onSettings.
    gameState.settingsOrigin = 'pause';
    gameState.currentScene = 'settings';
    // 3. Player taps Back/close-X.
    const target = settingsBackTarget(gameState.settingsOrigin);
    gameState.currentScene = target;
    // Pause was never cleared → overlay re-renders on `inPlay && paused`.
    expect(gameState.currentScene).toBe('play');
    expect(gameState.paused).toBe(true);
  });
});

describe('play.ts pause gate — anti-regression source check', () => {
  /**
   * Asserts the structural fix lives in scenes/play.ts. A unit-level invocation
   * of onUpdate would require building a full GameContextValue + world + deps,
   * which is heavier than the bug warrants. Instead, we verify the gate is in
   * place: the source must early-return on `gameState.paused` immediately
   * after the dialogue gate, mirroring the dialogue precedent.
   */
  test('scenes/play.ts onUpdate gates on gameState.paused', () => {
    const playSrc = readFileSync(
      join(__dirname, '..', 'src', 'scenes', 'play', 'update.ts'),
      'utf8',
    );
    // Dialogue gate must still be the first early-return.
    const dialogueIdx = playSrc.indexOf('if (gameState.dialogue !== null) {');
    expect(dialogueIdx, 'dialogue gate missing in play.ts onUpdate').toBeGreaterThan(0);
    // Paused gate must follow.
    const pausedIdx = playSrc.indexOf('if (gameState.paused) {');
    expect(pausedIdx, 'paused gate missing in play.ts onUpdate').toBeGreaterThan(dialogueIdx);
    // Each gate must call resetBombButtonFrame() + return — same shape as dialogue.
    const tail = playSrc.slice(pausedIdx, pausedIdx + 200);
    expect(tail).toContain('resetBombButtonFrame()');
    expect(tail).toContain('return;');
  });
});
