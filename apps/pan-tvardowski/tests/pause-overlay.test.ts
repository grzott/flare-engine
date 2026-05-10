/**
 * PauseOverlay state + locale tests — session #153 PT-PauseOverlay.
 *
 * Follows the established convention: no React / engine-package imports;
 * tests cover state mutations, signal emission, and locale parity.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import enJson from '../locales/en.json';
import plJson from '../locales/pl.json';
import { gameState, notifyStateChanged, resetGameState, stateChanged } from '../src/state';

describe('pause state — PT-PauseOverlay', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('paused defaults to false after resetGameState', () => {
    expect(gameState.paused).toBe(false);
  });

  test('setting paused=true then resetGameState clears it back to false', () => {
    gameState.paused = true;
    expect(gameState.paused).toBe(true);
    resetGameState();
    expect(gameState.paused).toBe(false);
  });

  test('stateChanged signal fires when notifyStateChanged is called while paused', () => {
    gameState.paused = true;
    let fired = false;
    const off = stateChanged.add(() => {
      fired = true;
    });
    notifyStateChanged();
    off();
    expect(fired).toBe(true);
  });

  test('pause locale keys are non-empty strings in both en.json and pl.json', () => {
    const keys = [
      'menu.pause.title',
      'menu.pause.resume',
      'menu.pause.settings',
      'menu.pause.quit',
    ] as const;
    const en = enJson as Record<string, string>;
    const pl = plJson as Record<string, string>;
    for (const key of keys) {
      expect(en[key], `en.json missing "${key}"`).toBeTruthy();
      expect(pl[key], `pl.json missing "${key}"`).toBeTruthy();
      expect(typeof en[key], `en["${key}"] not a string`).toBe('string');
      expect(typeof pl[key], `pl["${key}"] not a string`).toBe('string');
    }
  });

  test('onSettings is optional: PauseOverlayActions allows omitting it', () => {
    let resumed = false;
    let quitted = false;
    const actions = {
      onResume: () => {
        resumed = true;
      },
      onQuit: () => {
        quitted = true;
      },
    };
    actions.onResume();
    actions.onQuit();
    expect(resumed).toBe(true);
    expect(quitted).toBe(true);
    expect('onSettings' in actions).toBe(false);
  });
});
