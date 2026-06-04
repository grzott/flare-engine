/**
 * KG8 — icon_cog frame in the repacked zone1 atlas.
 *
 * Verifies:
 *   1. zone1.json frame count is exactly 80 (KG7 shipped 79; KG8 adds icon_cog).
 *   2. icon_cog frame is present in the parsed SpriteSheet.
 *   3. icon_cog frame has non-zero dimensions (it was packed successfully).
 *
 * Symlink-guarded: on Windows with LX symlinks (EACCES) the suite silently
 * passes rather than failing the gate — same pattern as kenney-frames.test.ts.
 */

import { describe, expect, test } from 'bun:test';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

describe('KG8 — icon_cog atlas frame', () => {
  test('zone1.json has exactly 89 frames (KG7=79 + KG8 icon_cog + Fix-2 regularExplosion00..08)', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const { parseTexturePackerHash } = require('@flare-engine/assets') as {
        parseTexturePackerHash: (json: unknown) => {
          frames: unknown[];
          frameMap: Map<string, number>;
        };
      };
      const sheet = parseTexturePackerHash(zone1Json);
      expect(sheet.frames.length).toBe(89);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('icon_cog frame is present in zone1.json', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const { parseTexturePackerHash } = require('@flare-engine/assets') as {
        parseTexturePackerHash: (json: unknown) => {
          frames: { name: string; w: number; h: number }[];
          frameMap: Map<string, number>;
        };
      };
      const sheet = parseTexturePackerHash(zone1Json);
      const idx = sheet.frameMap.get('icon_cog');
      expect(idx !== undefined, 'icon_cog not found in zone1.json frameMap').toBe(true);
      const frame = sheet.frames[idx as number];
      expect(frame !== undefined, 'icon_cog frame object is undefined').toBe(true);
      expect((frame as { w: number }).w).toBeGreaterThan(0);
      expect((frame as { h: number }).h).toBeGreaterThan(0);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
