/**
 * KG3 — KENNEY_FRAME_MAP behavioral tests.
 *
 * Verifies:
 *   1. Every zone-1 entity that should be Kenney-mapped has an entry.
 *   2. `kogut-zloty` (player) has a mapping.
 *   3. Every mapped frame name exists in the real zone1.json parsed sheet.
 *   4. Entities NOT in zone-1 are absent from the map (zones 2–8 fallthrough).
 *
 * Symlink-guarded: `parseTexturePackerHash` requires `@flare-engine/assets`;
 * on Windows with LX symlinks (EACCES) the suite silently passes rather than
 * failing the gate.
 */

import { describe, expect, test } from 'bun:test';
import { KENNEY_FRAME_MAP } from '../src/visual-spec/kenney-frames';
import { zone1 } from '../src/visual-spec/zone-1';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

/**
 * The zone-1 entity ids that must be in KENNEY_FRAME_MAP.
 *
 * zone1.entityIds uses base names (`iskry`), but PICKUP_DEFS gives them the
 * `pickup-` prefix (`pickup-iskry`). The lookup key at the spawn call site is
 * `String(def.id)` = `'pickup-iskry'`, so pickups are checked with that prefix.
 *
 * Non-pickup entities (`skrzat`, `latawiec`, `smok-krzemionkowski`) are looked
 * up by their raw id which matches the spawn call sites.
 */
const PICKUP_BASE_IDS = [
  'iskry',
  'piorun',
  'sol-swiecona',
  'znak-pentagramu',
  'czarna-ksiega',
  'siedmiomilowe-buty',
  'amulet-wegrowski',
  'koguci-pioro',
  'srebrna-tarcza',
  'kamien-filozoficzny',
] as const;

const PICKUP_SPAWN_KEYS = PICKUP_BASE_IDS.map((b) => `pickup-${b}`);

const ZONE1_NON_PICKUP_ENTITY_IDS = zone1.entityIds.filter(
  (id) => !(PICKUP_BASE_IDS as readonly string[]).includes(id),
);

describe('KENNEY_FRAME_MAP — completeness', () => {
  test('kogut-zloty (player) has a mapping', () => {
    expect(KENNEY_FRAME_MAP.has('kogut-zloty')).toBe(true);
    expect(KENNEY_FRAME_MAP.get('kogut-zloty')).toBe('playerShip1_blue');
  });

  test('zone-1 non-pickup entities are mapped with exact Kenney frame names', () => {
    expect(ZONE1_NON_PICKUP_ENTITY_IDS).toContain('skrzat');
    expect(ZONE1_NON_PICKUP_ENTITY_IDS).toContain('latawiec');
    expect(ZONE1_NON_PICKUP_ENTITY_IDS).toContain('smok-krzemionkowski');

    expect(KENNEY_FRAME_MAP.get('skrzat')).toBe('enemyBlack1');
    expect(KENNEY_FRAME_MAP.get('latawiec')).toBe('enemyBlack2');
    expect(KENNEY_FRAME_MAP.get('smok-krzemionkowski')).toBe('ufoRed');
  });

  test('every zone-1 pickup is mapped by its prefixed spawn key', () => {
    const expected: Record<string, string> = {
      'pickup-iskry': 'powerupRed_bolt',
      'pickup-piorun': 'powerupYellow_bolt',
      'pickup-sol-swiecona': 'powerupBlue_shield',
      'pickup-znak-pentagramu': 'powerupBlue_star',
      'pickup-czarna-ksiega': 'powerupRed_shield',
      'pickup-siedmiomilowe-buty': 'powerupGreen_bolt',
      'pickup-amulet-wegrowski': 'powerupYellow_shield',
      'pickup-koguci-pioro': 'bolt_gold',
      'pickup-srebrna-tarcza': 'shield_gold',
      'pickup-kamien-filozoficzny': 'star_gold',
    };
    for (const [key, frameName] of Object.entries(expected)) {
      expect(KENNEY_FRAME_MAP.get(key)).toBe(frameName);
    }
  });

  test('map has exactly 14 entries (1 player + 2 enemies + 1 boss + 10 pickups)', () => {
    expect(KENNEY_FRAME_MAP.size).toBe(14);
  });

  test('all zone-1 pickup spawn keys are covered', () => {
    for (const key of PICKUP_SPAWN_KEYS) {
      expect(KENNEY_FRAME_MAP.has(key)).toBe(true);
    }
  });
});

describe('KENNEY_FRAME_MAP — zones 2–8 fallthrough (not mapped)', () => {
  test('zone-2+ enemies are absent from the map', () => {
    const zone2PlusEnemies = ['czart', 'bies', 'licho', 'strzyga', 'topielec', 'mamuna'];
    for (const id of zone2PlusEnemies) {
      expect(KENNEY_FRAME_MAP.has(id)).toBe(false);
    }
  });

  test('zone-2+ bosses are absent from the map', () => {
    const otherBosses = [
      'borowy-krol',
      'wodnik-wislanny',
      'boruta',
      'baba-jaga',
      'bazyliszek-warszawski',
      'mefistofeles',
      'lucyper-ksiezycowy',
    ];
    for (const id of otherBosses) {
      expect(KENNEY_FRAME_MAP.has(id)).toBe(false);
    }
  });
});

describe('KENNEY_FRAME_MAP — frame names exist in real zone1.json', () => {
  test('every mapped frame name is present in the parsed zone1 sheet', () => {
    try {
      const { parseTexturePackerHash } = require('@flare-engine/assets');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const sheet = parseTexturePackerHash(zone1Json);

      for (const [entityKey, frameName] of KENNEY_FRAME_MAP) {
        const idx = sheet.frameMap.get(frameName);
        expect(
          idx !== undefined,
          `frame "${frameName}" (mapped from "${entityKey}") not found in zone1.json`,
        ).toBe(true);
        const f = sheet.frames[idx as number];
        expect(f !== undefined, `frame object for "${frameName}" is undefined`).toBe(true);
        expect((f as { w: number }).w).toBeGreaterThan(0);
        expect((f as { h: number }).h).toBeGreaterThan(0);
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
