import { describe, expect, test } from 'bun:test';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const ZONE_NUMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Zone entityIds use old-style pickup names ('iskry', 'czarna-ksiega') which
// match PICKUP_DEFS ids with the 'pickup-' prefix stripped.
function pickupEntityKey(id: string): string {
  return id.startsWith('pickup-') ? id.slice('pickup-'.length) : id;
}

const ALL_ENTITY_KEYS: ReadonlySet<string> = new Set([
  ...SHIP_DEFS.map((d) => d.id as string),
  ...PICKUP_DEFS.map((d) => pickupEntityKey(String(d.id))),
]);

describe('zone entity-id resolution (session #99)', () => {
  test('all entityIds resolve in SHIP_DEFS + PICKUP_DEFS', () => {
    for (const n of ZONE_NUMS) {
      const zone = ZONE_VISUAL_SPECS[n];
      for (const id of zone.entityIds) {
        expect(
          ALL_ENTITY_KEYS.has(id),
          `Z${n}: entityId '${id}' not found in SHIP_DEFS or PICKUP_DEFS`,
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
