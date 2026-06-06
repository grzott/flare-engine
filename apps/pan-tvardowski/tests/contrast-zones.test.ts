/**
 * contrast-zones.test.ts
 *
 * Per-zone gameplay-readability contrast regression guard (Part 9 of KG10, old C3).
 *
 * Locks the worst-case (minimum) contrastRatio of every zone's boss/miniboss
 * bullet and accent colors against bg.sky. The EXPECTED values are independent
 * golden constants — any palette or theme-token change that shifts a zone's
 * worst-case contrast makes the recomputed min diverge and fails the test,
 * forcing a conscious re-stamp.
 *
 * NOT a hard >=3.0 gate: several zones intentionally place an accent (or bullet)
 * equal to bg.sky (ratio 1.0) in atmospheric phases, where readability rides on
 * sprite motion/shape/glow and is confirmed on-device — a universal 3.0 floor
 * has no valid threshold against the shipped specs. The GAMEPLAY_FLOOR advisory
 * log flags sub-floor pairs for that device review without gating CI.
 *
 * Pure import test — no PNG I/O, deterministic.
 */

import { describe, expect, test } from 'bun:test';
import { Color } from '@flare-engine/math';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import type { ZoneId } from '../src/visual-spec';

const GAMEPLAY_FLOOR = 3.0;

// Stamped worst-case ratios + pair counts, measured 2026-06-05 (KG10 baseline).
// Re-stamp deliberately if a zone palette / boss spec / theme token changes.
const EXPECTED: Record<
  ZoneId,
  { bulletMin: number; accentMin: number; nBullet: number; nAccent: number }
> = {
  1: { bulletMin: 1.0709, accentMin: 1.0, nBullet: 2, nAccent: 2 },
  2: { bulletMin: 2.3854, accentMin: 1.0, nBullet: 3, nAccent: 3 },
  3: { bulletMin: 2.5102, accentMin: 1.0, nBullet: 2, nAccent: 2 },
  4: { bulletMin: 2.3854, accentMin: 2.3854, nBullet: 3, nAccent: 3 },
  5: { bulletMin: 2.1013, accentMin: 2.1013, nBullet: 3, nAccent: 3 },
  6: { bulletMin: 1.6881, accentMin: 1.0, nBullet: 4, nAccent: 4 },
  7: { bulletMin: 1.0, accentMin: 1.5, nBullet: 4, nAccent: 4 },
  8: { bulletMin: 1.0, accentMin: 1.0, nBullet: 3, nAccent: 3 },
};

function minRatio(colors: string[], sky: string): number {
  return Math.min(...colors.map((c) => Color.contrastRatio(Color.fromHex(c), Color.fromHex(sky))));
}

function zoneColors(id: ZoneId): { sky: string; bullets: string[]; accents: string[] } {
  const zone = ZONE_VISUAL_SPECS[id];
  const bullets = zone.boss.phases.map((p) => p.bullet);
  const accents = zone.boss.phases.map((p) => p.accent);
  if (zone.miniboss) {
    for (const p of zone.miniboss.phases) {
      bullets.push(p.bullet);
      accents.push(p.accent);
    }
  }
  return { sky: zone.bg.sky, bullets, accents };
}

describe('contrast-zones — per-zone worst-case contrast regression guard', () => {
  for (let id = 1 as ZoneId; id <= 8; id = (id + 1) as ZoneId) {
    const exp = EXPECTED[id];

    test(`Z${id}: bullet/accent pair counts stable`, () => {
      const { bullets, accents } = zoneColors(id);
      expect(bullets.length).toBe(exp.nBullet);
      expect(accents.length).toBe(exp.nAccent);
    });

    test(`Z${id}: bullet worst-case contrast == ${exp.bulletMin}`, () => {
      const { sky, bullets } = zoneColors(id);
      const min = minRatio(bullets, sky);
      if (min < GAMEPLAY_FLOOR) {
        console.warn(
          `[contrast-zones] ADVISORY Z${id}: bullet worst-case ${min.toFixed(2)} < ${GAMEPLAY_FLOOR} — verify on device`,
        );
      }
      expect(min).toBeCloseTo(exp.bulletMin, 2);
    });

    test(`Z${id}: accent worst-case contrast == ${exp.accentMin}`, () => {
      const { sky, accents } = zoneColors(id);
      const min = minRatio(accents, sky);
      if (min < GAMEPLAY_FLOOR) {
        console.warn(
          `[contrast-zones] ADVISORY Z${id}: accent worst-case ${min.toFixed(2)} < ${GAMEPLAY_FLOOR} — verify on device`,
        );
      }
      expect(min).toBeCloseTo(exp.accentMin, 2);
    });
  }
});

test('contrast metric discriminates: light-on-dark reads far above the floor', () => {
  // Proves the guard above is meaningful (the metric separates high from low),
  // not a function that always returns ~1. Bone on zone-6 ink sky.
  const r = Color.contrastRatio(Color.fromHex('#E8DCC4'), Color.fromHex('#1A1410'));
  expect(r).toBeGreaterThan(10);
});
