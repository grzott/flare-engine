import { describe, expect, test } from 'bun:test';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import { createBootScene } from '../src/scenes/boot';
import { gameState, resetGameState } from '../src/state';

describe('boot scene transitions to menu, not play', () => {
  test('boot.onEnter calls scenes.go("menu") after loadSave resolves', async () => {
    resetGameState();
    const calls: string[] = [];
    const fakeCtx = {
      scenes: {
        go: (name: string) => {
          calls.push(name);
          return Promise.resolve();
        },
      },
    } as unknown as GameContextValue;

    let loaded = false;
    const loadSave = async (): Promise<void> => {
      await Promise.resolve();
      loaded = true;
    };

    const scene: Scene = createBootScene(fakeCtx, loadSave)();
    scene.onEnter?.({} as never);

    // Flush microtasks spawned by the async IIFE in onEnter.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(loaded).toBe(true);
    expect(calls).toEqual(['menu']);
    expect(calls.includes('play')).toBe(false);
  });

  test('boot sets currentScene to "boot" synchronously', () => {
    resetGameState();
    const fakeCtx = {
      scenes: { go: () => Promise.resolve() },
    } as unknown as GameContextValue;
    const scene = createBootScene(fakeCtx, async () => {})();
    scene.onEnter?.({} as never);
    expect(gameState.currentScene).toBe('boot');
  });

  test('skips go("menu") when a deep-link has changed currentScene to "play"', async () => {
    // Race scenario: a bench/zone deep-link arrives during boot's async chain
    // and calls scenes.go('play') (which sets currentScene='play' via play
    // scene's onEnter). When boot's IIFE finishes, it MUST NOT call go('menu')
    // and tear down the play scene the deep-link just activated.
    resetGameState();
    const calls: string[] = [];
    const fakeCtx = {
      scenes: {
        go: (name: string) => {
          calls.push(name);
          return Promise.resolve();
        },
      },
    } as unknown as GameContextValue;

    const loadSave = async (): Promise<void> => {
      await Promise.resolve();
      // Simulate the deep-link handler running mid-boot: activateBenchMode +
      // scenes.go('play') → play.onEnter → currentScene = 'play'.
      gameState.currentScene = 'play';
    };

    const scene: Scene = createBootScene(fakeCtx, loadSave)();
    scene.onEnter?.({} as never);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toEqual([]);
    expect(gameState.currentScene).toBe('play');
  });
});
