/**
 * KG8 — kenney-controls/ standalone PNG asset presence and dimensions.
 *
 * Verifies:
 *   1. Each Large (2×) standalone PNG exists at the committed path.
 *   2. Each file has the expected PNG dimensions (parsed from the PNG header).
 *
 * These assets are placed in assets/kenney-controls/ (separate from
 * kenney-src/) so Metro can bundle them without feeding them to the atlas
 * packer. The copy source is Kenney Mobile Controls Large (2×).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_ROOT = join(import.meta.dir, '..');
const CONTROLS_DIR = join(APP_ROOT, 'assets', 'kenney-controls');

function pngDims(filePath: string): { w: number; h: number } {
  const buf = readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const EXPECTED: [string, number, number][] = [
  ['button_circle.png', 128, 128],
  ['joystick_circle_pad_a.png', 256, 256],
  ['joystick_circle_nub_a.png', 128, 128],
  ['icon_fire.png', 96, 96],
];

describe('KG8 — kenney-controls standalone PNGs', () => {
  for (const [name, w, h] of EXPECTED) {
    test(`${name} exists and is ${w}×${h}`, () => {
      const p = join(CONTROLS_DIR, name);
      const dims = pngDims(p);
      expect(dims.w).toBe(w);
      expect(dims.h).toBe(h);
    });
  }
});
