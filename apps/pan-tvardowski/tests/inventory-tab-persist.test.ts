import { describe, expect, test } from 'bun:test';
import { gameState, resetGameState } from '../src/state';

/**
 * InventoryOverlay activeTab persistence — PT-UX-A M3.
 *
 * Verifies that inventoryActiveTab is part of GameState and resets correctly.
 */

describe('inventory-tab-persist — session #48 M3', () => {
  test('inventoryActiveTab defaults to codex after resetGameState', () => {
    resetGameState();
    expect(gameState.inventoryActiveTab).toBe('codex');
  });

  test('resetGameState resets inventoryActiveTab to codex regardless of prior mutation', () => {
    gameState.inventoryActiveTab = 'achievements';
    resetGameState();
    const tab: string = gameState.inventoryActiveTab;
    expect(tab).toBe('codex');
  });
});
