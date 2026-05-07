import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';

const ZONE_NUMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const ALL_ENTITY_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(SHAPE_CATALOGUE.enemies),
  ...Object.keys(SHAPE_CATALOGUE.minibosses),
  ...Object.keys(SHAPE_CATALOGUE.bosses),
  ...Object.keys(SHAPE_CATALOGUE.ships),
  ...Object.keys(SHAPE_CATALOGUE.weaponPickups),
  ...Object.keys(SHAPE_CATALOGUE.upgradePickups),
]);

describe('zone entity-id resolution (session #99)', () => {
  test('all entityIds resolve in SHAPE_CATALOGUE', () => {
    for (const n of ZONE_NUMS) {
      const zone = ZONE_VISUAL_SPECS[n];
      for (const id of zone.entityIds) {
        expect(
          ALL_ENTITY_KEYS.has(id),
          `Z${n}: entityId '${id}' not found in SHAPE_CATALOGUE`,
        ).toBe(true);
      }
    }
  });

  test('zone entityIds include the zone boss and miniboss when present', () => {
    for (const n of ZONE_NUMS) {
      const zone = ZONE_VISUAL_SPECS[n];
      const ids = zone.entityIds as readonly string[];
      expect(ids, `Z${n}: boss id '${zone.boss.id}' missing from entityIds`).toContain(
        zone.boss.id,
      );
      if (zone.miniboss !== undefined) {
        expect(ids, `Z${n}: miniboss id '${zone.miniboss.id}' missing from entityIds`).toContain(
          zone.miniboss.id,
        );
      }
    }
  });

  test('no duplicate entityIds within a zone', () => {
    for (const n of ZONE_NUMS) {
      const zone = ZONE_VISUAL_SPECS[n];
      const ids = zone.entityIds;
      expect(new Set(ids).size, `Z${n}: entityIds contains duplicates`).toBe(ids.length);
    }
  });
});
