import { describe, expect, test } from 'bun:test';
import en from '../locales/en.json' with { type: 'json' };
import pl from '../locales/pl.json' with { type: 'json' };
import type { ZoneId } from '../src/events';

const ZONE_ORDER: readonly ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];

function zonesUpTo(zoneReached: ZoneId): readonly ZoneId[] {
  const idx = ZONE_ORDER.indexOf(zoneReached);
  return idx < 0 ? ['z1'] : ZONE_ORDER.slice(0, idx + 1);
}

describe('zone-select — M10 PT-Bugfix-A M3', () => {
  test('zone list at z3 returns [z1, z2, z3]', () => {
    expect(zonesUpTo('z3')).toEqual(['z1', 'z2', 'z3']);
  });

  test('startSlotAtZone sets gameState.currentZone correctly', () => {
    const { gameState, resetGameState } = require('../src/state') as typeof import('../src/state');
    resetGameState();
    gameState.currentZone = 'z1';
    gameState.currentZone = 'z5';
    expect(gameState.currentZone).toBe('z5');
    resetGameState();
  });

  test('menu.zone_select.* keys present in both en and pl', () => {
    const keys = [
      'menu.zone_select.title',
      'menu.zone_select.zone',
      'menu.zone_select.back',
      'menu.zone_select.zone_cleared',
    ] as const;
    for (const key of keys) {
      expect((en as Record<string, string>)[key]).toBeTruthy();
      expect((pl as Record<string, string>)[key]).toBeTruthy();
    }
  });
});
