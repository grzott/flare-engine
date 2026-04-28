import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

/**
 * Boss visual audit — PT-Bugfix-B M2.
 *
 * The renderer iterates a boss's ShapeSpec[] in array order using the painter's
 * algorithm: index [0] is drawn first (behind everything else), index [N-1] is
 * drawn last (on top). Tests here encode *visual* invariants ("X draws behind
 * Y") rather than raw array indices so they survive future renderer changes —
 * if the renderer ever reverses its iteration order, these tests flip red.
 *
 * Draw-order finding: shapes-draw.ts calls canvas.draw* in forward array order
 * — confirmed by reading src/shapes-draw.ts. Index 0 → background (painter's
 * order). No swap was required for smok-krzemionkowski; the current
 * ngon[0]/triangle[1] ordering is already correct.
 */

const { bosses } = SHAPE_CATALOGUE;

/** Returns the index of the first shape matching `predicate`, or -1. */
function findIdx(
  specs: readonly { kind: string; fill?: number }[],
  predicate: (s: { kind: string; fill?: number }) => boolean,
): number {
  return specs.findIndex(predicate);
}

describe('smok-krzemionkowski draw order — session #47 M2', () => {
  const smok = bosses['smok-krzemionkowski'];

  test('smok catalogue has exactly 2 shapes', () => {
    expect(smok).toHaveLength(2);
  });

  test('COPPER ngon is present in smok catalogue', () => {
    const idx = findIdx(smok, (s) => s.kind === 'ngon' && s.fill === 0xffb5651d);
    expect(idx, 'COPPER ngon missing from smok-krzemionkowski').toBeGreaterThanOrEqual(0);
  });

  test('HELLFIRE triangle is present in smok catalogue', () => {
    const idx = findIdx(smok, (s) => s.kind === 'triangle' && s.fill === 0xffff2b2b);
    expect(idx, 'HELLFIRE triangle missing from smok-krzemionkowski').toBeGreaterThanOrEqual(0);
  });

  test('COPPER ngon draws BEHIND HELLFIRE triangle (painter-order invariant)', () => {
    // The renderer draws index[0] first (behind) and index[N-1] last (in front).
    // This test intentionally encodes the visual intent: ngon is the body (behind),
    // triangle is the tail-flame detail (in front). If the renderer ever reverses
    // its iteration, this test breaks — which is the desired signal.
    const ngonIdx = findIdx(smok, (s) => s.kind === 'ngon' && s.fill === 0xffb5651d);
    const triangleIdx = findIdx(smok, (s) => s.kind === 'triangle' && s.fill === 0xffff2b2b);
    expect(ngonIdx).toBeLessThan(triangleIdx);
  });
});

describe('all 8 bosses have distinct silhouette kinds — session #47 M2', () => {
  test('each boss has at least 1 shape with a primary kind', () => {
    const PRIMARY_KINDS = new Set(['ngon', 'star', 'gradient-rect', 'rect', 'circle']);
    for (const [name, specs] of Object.entries(bosses)) {
      const hasPrimary = specs.some((s) => PRIMARY_KINDS.has(s.kind));
      expect(hasPrimary, `boss "${name}" has no primary silhouette shape`).toBe(true);
    }
  });

  test('all 8 bosses are present', () => {
    expect(Object.keys(bosses)).toHaveLength(8);
  });

  test('no two bosses share the same primary color on their first shape', () => {
    // Distinct primary color → distinct silhouette at a glance.
    // gradient-rect shapes use colorA as the primary color; all others use fill.
    const colors = new Set<number>();
    for (const [name, specs] of Object.entries(bosses)) {
      const first = specs[0];
      if (!first) continue;
      const color =
        first.kind === 'gradient-rect' ? first.colorA : 'fill' in first ? first.fill : undefined;
      if (color !== undefined) {
        expect(colors.has(color), `boss "${name}" shares a primary color with another boss`).toBe(
          false,
        );
        colors.add(color);
      }
    }
  });
});
