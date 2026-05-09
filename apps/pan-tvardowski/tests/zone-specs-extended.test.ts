import { describe, expect, test } from 'bun:test';
import { ZONES } from '../src/config/zones';
import type { ZoneId as ZoneConfigId } from '../src/events';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import type { ZoneId as ZoneNumId } from '../src/visual-spec/zones-palette';

const ZONE_NUMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type ZonePair = [ZoneNumId, ZoneConfigId];

const ALL_PAIRS: readonly ZonePair[] = [
  [1, 'z1'],
  [2, 'z2'],
  [3, 'z3'],
  [4, 'z4'],
  [5, 'z5'],
  [6, 'z6'],
  [7, 'z7'],
  [8, 'z8'],
];

const MINIBOSS_PAIRS: readonly ZonePair[] = [
  [2, 'z2'],
  [4, 'z4'],
  [6, 'z6'],
  [7, 'z7'],
];

describe('zone visual specs — extended (session #99)', () => {
  test('entityIds is non-empty in all 8 zones', () => {
    for (const n of ZONE_NUMS) {
      const zone = ZONE_VISUAL_SPECS[n];
      expect(zone.entityIds.length, `Z${n} entityIds must be non-empty`).toBeGreaterThan(0);
    }
  });

  test('zones with a gameplay miniboss have a miniboss BossVisualSpec (bidirectional)', () => {
    for (const [n, zk] of ALL_PAIRS) {
      const hasGameplayMiniboss = ZONES[zk].minibossPattern !== null;
      const hasVisualMiniboss = ZONE_VISUAL_SPECS[n].miniboss !== undefined;
      expect(
        hasVisualMiniboss,
        `Z${n}: visual miniboss (${hasVisualMiniboss}) must match gameplay (${hasGameplayMiniboss})`,
      ).toBe(hasGameplayMiniboss);
    }
  });

  test('miniboss.hpTotal matches gameplay minibossHp for Z2, Z4, Z6, Z7', () => {
    for (const [n, zk] of MINIBOSS_PAIRS) {
      const visualSpec = ZONE_VISUAL_SPECS[n];
      expect(visualSpec.miniboss, `Z${n} must have a miniboss spec`).toBeDefined();
      expect(visualSpec.miniboss?.hpTotal, `Z${n} miniboss hpTotal must match gameplay`).toBe(
        ZONES[zk].minibossHp,
      );
    }
  });
});
