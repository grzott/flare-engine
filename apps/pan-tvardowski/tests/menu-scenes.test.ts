import { beforeEach, describe, expect, test } from 'bun:test';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import { createCreditsScene } from '../src/scenes/credits';
import { createMenuScene } from '../src/scenes/menu';
import { createSaveSelectScene } from '../src/scenes/save-select';
import { createSettingsScene } from '../src/scenes/settings';
import { gameState, resetGameState } from '../src/state';

const fakeCtx = {} as GameContextValue;

function runOnEnter(scene: Scene): void {
  scene.onEnter?.({} as never);
}

describe('menu scenes set gameState.currentScene', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('menu scene', () => {
    const factory = createMenuScene(fakeCtx);
    runOnEnter(factory());
    expect(gameState.currentScene).toBe('menu');
  });

  test('save-select scene', () => {
    const factory = createSaveSelectScene(fakeCtx);
    runOnEnter(factory());
    expect(gameState.currentScene).toBe('save-select');
  });

  test('settings scene', () => {
    const factory = createSettingsScene(fakeCtx);
    runOnEnter(factory());
    expect(gameState.currentScene).toBe('settings');
  });

  test('credits scene', () => {
    const factory = createCreditsScene(fakeCtx);
    runOnEnter(factory());
    expect(gameState.currentScene).toBe('credits');
  });

  test('scene factories produce stable names', () => {
    expect(createMenuScene(fakeCtx)().name).toBe('menu');
    expect(createSaveSelectScene(fakeCtx)().name).toBe('save-select');
    expect(createSettingsScene(fakeCtx)().name).toBe('settings');
    expect(createCreditsScene(fakeCtx)().name).toBe('credits');
  });
});
