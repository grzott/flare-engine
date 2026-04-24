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
});
