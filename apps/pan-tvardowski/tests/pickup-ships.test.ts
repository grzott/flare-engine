import { describe, expect, test } from 'bun:test';
import type { ShapeSpec } from '@flare-engine/shapes';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';

const WEAPON_PICKUP_DEFS = PICKUP_DEFS.filter((d) => d.effect.kind === 'weapon-swap');
const UPGRADE_PICKUP_DEFS = PICKUP_DEFS.filter((d) => d.effect.kind !== 'weapon-swap');

const WEAPON_PICKUP_ENTRIES = WEAPON_PICKUP_DEFS.map((d) => [String(d.id), d.shapes] as const);
const UPGRADE_PICKUP_ENTRIES = UPGRADE_PICKUP_DEFS.map((d) => [String(d.id), d.shapes] as const);

/**
 * Signature = kind + first discriminating param + fill.
 */
function pickupSignature(spec: ShapeSpec): string {
  if (spec.kind === 'circle') return `circle:r${spec.r}:${String(spec.fill ?? 'none')}`;
  if (spec.kind === 'ring') return `ring:r${spec.r}:stroke${String(spec.stroke ?? 'none')}`;
  if (spec.kind === 'rect') return `rect:${spec.w}x${spec.h}:${String(spec.fill ?? 'none')}`;
  if (spec.kind === 'ngon') return `ngon:n${spec.n}r${spec.r}:${String(spec.fill ?? 'none')}`;
  if (spec.kind === 'star')
    return `star:${spec.points}o${spec.rOuter}i${spec.rInner}:${String(spec.fill ?? 'none')}`;
  if (spec.kind === 'polyline')
    return `polyline:${spec.points.join(',')}:stroke${String(spec.stroke ?? 'none')}`;
  if (spec.kind === 'triangle') return `triangle:${spec.size}:${String(spec.fill ?? 'none')}`;
  if (spec.kind === 'gradient-rect')
    return `gradient-rect:${spec.w}x${spec.h}:${String(spec.colorA)}`;
  return `unknown:${String((spec as { fill?: unknown }).fill ?? 'none')}`;
}

describe('pickup folio-conformance (folio XIIIc) — session #78 M1', () => {
  test('T1: 4 weapon-pickup entries, each non-empty shapes[]', () => {
    expect(WEAPON_PICKUP_ENTRIES).toHaveLength(4);
    for (const [name, shapes] of WEAPON_PICKUP_ENTRIES) {
      expect(shapes.length, `${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  test('T2: 6 upgrade-pickup entries, each non-empty shapes[]', () => {
    expect(UPGRADE_PICKUP_ENTRIES).toHaveLength(6);
    for (const [name, shapes] of UPGRADE_PICKUP_ENTRIES) {
      expect(shapes.length, `${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  test('T3: every pickup first spec has glow=friendly', () => {
    for (const [name, shapes] of WEAPON_PICKUP_ENTRIES) {
      expect(shapes[0]?.glow, `weapon pickup ${name} first spec glow`).toBe('friendly');
    }
    for (const [name, shapes] of UPGRADE_PICKUP_ENTRIES) {
      expect(shapes[0]?.glow, `upgrade pickup ${name} first spec glow`).toBe('friendly');
    }
  });

  test('T4: no two weapon-pickups share same shape-signature', () => {
    const seen = new Set<string>();
    for (const [name, shapes] of WEAPON_PICKUP_ENTRIES) {
      const first = shapes[0];
      if (first === undefined) continue;
      const sig = pickupSignature(first as ShapeSpec);
      expect(seen.has(sig), `${name} duplicate signature: ${sig}`).toBe(false);
      seen.add(sig);
    }
  });

  test('T5: no two upgrade-pickups share same shape-signature', () => {
    const seen = new Set<string>();
    for (const [name, shapes] of UPGRADE_PICKUP_ENTRIES) {
      const first = shapes[0];
      if (first === undefined) continue;
      const sig = pickupSignature(first as ShapeSpec);
      expect(seen.has(sig), `${name} duplicate signature: ${sig}`).toBe(false);
      seen.add(sig);
    }
  });

  test('T6: total pickup count is 10', () => {
    const total = WEAPON_PICKUP_ENTRIES.length + UPGRADE_PICKUP_ENTRIES.length;
    expect(total).toBe(10);
  });
});
