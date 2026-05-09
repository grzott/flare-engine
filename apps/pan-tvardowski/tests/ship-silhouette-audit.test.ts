import { describe, expect, test } from 'bun:test';
import type { ShipSpec } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/visual-spec/shapes-catalogue';

const { enemies, minibosses, bosses, ships } = SHAPE_CATALOGUE;

const ENEMY_ENTRIES = Object.entries(enemies) as [string, ShipSpec][];
const MINIBOSS_ENTRIES = Object.entries(minibosses) as [string, ShipSpec][];
const BOSS_ENTRIES = Object.entries(bosses) as [string, ShipSpec][];
const PLAYER_ENTRIES = Object.entries(ships) as [string, ShipSpec][];
const ALL_ENTRIES = [...ENEMY_ENTRIES, ...MINIBOSS_ENTRIES, ...BOSS_ENTRIES, ...PLAYER_ENTRIES];

/**
 * Hull silhouette key per the plan spec:
 *   <hull.kind>:<shapeParams>:<hull.fill ?? 'none'>
 *
 * shapeParams encoding:
 *   circle/ring  → r
 *   ngon         → n<n>r<r>
 *   triangle     → size
 *   star         → <points>o<rOuter>i<rInner>
 *   rect / gradient-rect → <w>x<h>
 */
function hullKey(spec: ShipSpec): string {
  const h = spec.hull;
  let shapeParams: string;
  if (h.kind === 'circle' || h.kind === 'ring') {
    shapeParams = String(h.r);
  } else if (h.kind === 'ngon') {
    shapeParams = `n${h.n}r${h.r}`;
  } else if (h.kind === 'triangle') {
    shapeParams = String(h.size);
  } else if (h.kind === 'star') {
    shapeParams = `${h.points}o${h.rOuter}i${h.rInner}`;
  } else if (h.kind === 'rect' || h.kind === 'gradient-rect') {
    shapeParams = `${h.w}x${h.h}`;
  } else {
    shapeParams = 'unknown';
  }
  return `${h.kind}:${shapeParams}:${String(h.fill ?? 'none')}`;
}

describe('ship silhouette uniqueness audit — session #78 M2', () => {
  test('T1: exactly 29 ShipSpec entries (14 enemies + 4 minibosses + 8 bosses + 3 players)', () => {
    expect(ENEMY_ENTRIES).toHaveLength(14);
    expect(MINIBOSS_ENTRIES).toHaveLength(4);
    expect(BOSS_ENTRIES).toHaveLength(8);
    expect(PLAYER_ENTRIES).toHaveLength(3);
    expect(ALL_ENTRIES).toHaveLength(29);
  });

  test('T2: no two ships share the same hull silhouette key', () => {
    const seen = new Map<string, string>();
    for (const [name, spec] of ALL_ENTRIES) {
      const key = hullKey(spec);
      const prev = seen.get(key);
      expect(prev, `${name} and ${prev ?? '?'} share hull key: ${key}`).toBeUndefined();
      seen.set(key, name);
    }
  });

  test('T3: every ship engine is kind=square and size=20', () => {
    for (const [name, spec] of ALL_ENTRIES) {
      expect(spec.engine.kind, `${name} engine.kind`).toBe('square');
      expect(spec.engine.size, `${name} engine.size`).toBe(20);
    }
  });

  test('T4: weapon counts per tier — enemies 1–2, minibosses 2–3, bosses 2–4, players exactly 2', () => {
    for (const [name, spec] of ENEMY_ENTRIES) {
      expect(spec.weapons.length, `enemy ${name} weapons`).toBeGreaterThanOrEqual(1);
      expect(spec.weapons.length, `enemy ${name} weapons`).toBeLessThanOrEqual(2);
    }
    for (const [name, spec] of MINIBOSS_ENTRIES) {
      expect(spec.weapons.length, `miniboss ${name} weapons`).toBeGreaterThanOrEqual(2);
      expect(spec.weapons.length, `miniboss ${name} weapons`).toBeLessThanOrEqual(3);
    }
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.weapons.length, `boss ${name} weapons`).toBeGreaterThanOrEqual(2);
      expect(spec.weapons.length, `boss ${name} weapons`).toBeLessThanOrEqual(4);
    }
    for (const [name, spec] of PLAYER_ENTRIES) {
      expect(spec.weapons.length, `player ${name} weapons`).toBe(2);
    }
  });

  test('T5: every weapon in every ship has kind=rect', () => {
    for (const [name, spec] of ALL_ENTRIES) {
      for (let i = 0; i < spec.weapons.length; i++) {
        expect(spec.weapons[i]?.kind, `${name} weapon[${i}].kind`).toBe('rect');
      }
    }
  });
});
