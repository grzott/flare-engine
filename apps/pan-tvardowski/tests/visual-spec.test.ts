/**
 * Invariant suite for `src/visual-spec/`.
 *
 * **Purpose:** these tests fail loudly when a spec file violates the locked
 * Session-1 schema. They are not coverage padding — every assertion catches a
 * real failure mode (typo'd EntityId, malformed Hex, drifted boss-zone
 * mapping, accidental schema reshape).
 *
 * The schema canary at the bottom is the schema-stability guard: any rename
 * or type change in `types.ts` flips the hash and forces the developer to
 * either run the deprecation cycle or consciously bump the snapshot.
 */

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZONES } from '../src/config/zones';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import { SHAPE_CATALOGUE } from '../src/visual-spec/shapes-catalogue';
import type { ZoneId } from '../src/visual-spec/zones-palette';

const HEX_REGEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

interface HexCheck {
  readonly path: string;
  readonly value: string;
}

/** Collect every Hex field reachable from a `ZoneVisualSpec`. */
function collectHexes(zoneId: ZoneId): readonly HexCheck[] {
  const zone = ZONE_VISUAL_SPECS[zoneId];
  const checks: HexCheck[] = [
    { path: `Z${zoneId}.bg.sky`, value: zone.bg.sky },
    { path: `Z${zoneId}.bg.ground`, value: zone.bg.ground },
    { path: `Z${zoneId}.bg.accent`, value: zone.bg.accent },
    { path: `Z${zoneId}.bg.hazard`, value: zone.bg.hazard },
  ];
  for (const phase of zone.boss.phases) {
    checks.push({ path: `Z${zoneId}.boss.phase${phase.phase}.accent`, value: phase.accent });
    checks.push({ path: `Z${zoneId}.boss.phase${phase.phase}.bullet`, value: phase.bullet });
  }
  if (zone.miniboss) {
    for (const phase of zone.miniboss.phases) {
      checks.push({ path: `Z${zoneId}.miniboss.phase${phase.phase}.accent`, value: phase.accent });
      checks.push({ path: `Z${zoneId}.miniboss.phase${phase.phase}.bullet`, value: phase.bullet });
    }
  }
  return checks;
}

describe('visual-spec — Hex field validation', () => {
  test('every Hex value across all 8 zones matches /^#[0-9A-F]{6}([0-9A-F]{2})?$/i', () => {
    const violations: string[] = [];
    for (let id = 1 as ZoneId; id <= 8; id = (id + 1) as ZoneId) {
      for (const c of collectHexes(id)) {
        if (!HEX_REGEX.test(c.value)) violations.push(`${c.path} = ${c.value}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('visual-spec — zone registry integrity', () => {
  test('all 8 ZoneIds (1..8) are present and unique in ZONE_VISUAL_SPECS', () => {
    const ids: number[] = [];
    for (let id = 1; id <= 8; id++) {
      const spec = ZONE_VISUAL_SPECS[id as ZoneId];
      expect(spec.id, `Z${id}`).toBe(id as ZoneId);
      ids.push(spec.id);
    }
    expect(new Set(ids).size).toBe(8);
  });

  test('zone.id matches its registry key (Z1.id === 1, Z8.id === 8, …)', () => {
    for (let id = 1; id <= 8; id++) {
      expect(ZONE_VISUAL_SPECS[id as ZoneId].id).toBe(id as ZoneId);
    }
  });

  test('zone.nameKey follows the `zones.N.name` convention', () => {
    for (let id = 1; id <= 8; id++) {
      expect(ZONE_VISUAL_SPECS[id as ZoneId].nameKey).toBe(`zones.${id}.name`);
    }
  });
});

describe('visual-spec — boss EntityId resolution', () => {
  const bossKeys = new Set(Object.keys(SHAPE_CATALOGUE.bosses));
  const minibossKeys = new Set(Object.keys(SHAPE_CATALOGUE.minibosses));

  test('every BossVisualSpec.id resolves in SHAPE_CATALOGUE.bosses', () => {
    for (let id = 1; id <= 8; id++) {
      const bossId = ZONE_VISUAL_SPECS[id as ZoneId].boss.id;
      expect(bossKeys, `Z${id}.boss.id=${bossId}`).toContain(bossId);
    }
  });

  test('every miniboss BossVisualSpec.id resolves in SHAPE_CATALOGUE.minibosses', () => {
    for (let id = 1; id <= 8; id++) {
      const m = ZONE_VISUAL_SPECS[id as ZoneId].miniboss;
      if (m) expect(minibossKeys, `Z${id}.miniboss.id=${m.id}`).toContain(m.id);
    }
  });
});

describe('visual-spec — boss/zone alignment vs config/zones.ts', () => {
  // Cross-check: visual-spec and gameplay config must agree on which boss/miniboss
  // belongs to which zone. After session #7 these merge into one source; until
  // then this test catches drift.

  test('boss pattern matches between ZONE_VISUAL_SPECS and ZONES', () => {
    for (let id = 1; id <= 8; id++) {
      const visualBoss = ZONE_VISUAL_SPECS[id as ZoneId].boss.id;
      const gameplayBoss = ZONES[`z${id}` as keyof typeof ZONES].bossPattern;
      expect(visualBoss, `Z${id} boss`).toBe(gameplayBoss);
    }
  });

  test('miniboss pattern matches between ZONE_VISUAL_SPECS and ZONES (when present)', () => {
    // Session 1: visual-spec doesn't yet carry miniboss recipes (filled in
    // Session 5). This test only asserts: if a visual miniboss IS defined, its
    // id matches the gameplay miniboss pattern, AND it is never defined for a
    // zone that has no gameplay miniboss. Session 5 tightens this to a strict
    // bidirectional check.
    for (let id = 1; id <= 8; id++) {
      const visualSpec = ZONE_VISUAL_SPECS[id as ZoneId];
      const gameplay = ZONES[`z${id}` as keyof typeof ZONES];
      if (visualSpec.miniboss === undefined) continue;
      if (gameplay.minibossPattern === null) {
        throw new Error(
          `Z${id} has visual miniboss '${visualSpec.miniboss.id}' but gameplay has none`,
        );
      }
      expect(visualSpec.miniboss.id, `Z${id} miniboss`).toBe(gameplay.minibossPattern);
    }
  });

  test('boss HP total matches between ZONE_VISUAL_SPECS and ZONES', () => {
    for (let id = 1; id <= 8; id++) {
      const visualHp = ZONE_VISUAL_SPECS[id as ZoneId].boss.hpTotal;
      const gameplayHp = ZONES[`z${id}` as keyof typeof ZONES].bossHp;
      expect(visualHp, `Z${id} boss HP`).toBe(gameplayHp);
    }
  });
});

describe('visual-spec — ambience alignment vs palette.ts', () => {
  test('zone.bg.ambience.kind matches ZONE_PALETTES[id].ambienceName', async () => {
    const { ZONE_PALETTES } = await import('../src/visual-spec/zones-palette');
    for (let id = 1; id <= 8; id++) {
      const visualKind = ZONE_VISUAL_SPECS[id as ZoneId].bg.ambience.kind;
      const paletteKind = ZONE_PALETTES[id as ZoneId].ambienceName;
      expect(visualKind, `Z${id} ambience kind`).toBe(paletteKind);
    }
  });

  test('zone.bg.ambience.count matches ZONE_PALETTES[id].ambienceParticles', async () => {
    const { ZONE_PALETTES } = await import('../src/visual-spec/zones-palette');
    for (let id = 1; id <= 8; id++) {
      const visualCount = ZONE_VISUAL_SPECS[id as ZoneId].bg.ambience.count;
      const paletteCount = ZONE_PALETTES[id as ZoneId].ambienceParticles;
      expect(visualCount, `Z${id} ambience count`).toBe(paletteCount);
    }
  });
});

describe('visual-spec — phase structure', () => {
  test('boss.phases is non-empty and phase numbers are 1..N contiguous', () => {
    for (let id = 1; id <= 8; id++) {
      const phases = ZONE_VISUAL_SPECS[id as ZoneId].boss.phases;
      expect(phases.length, `Z${id} phase count`).toBeGreaterThan(0);
      for (let i = 0; i < phases.length; i++) {
        expect(phases[i]?.phase, `Z${id}.phases[${i}].phase`).toBe((i + 1) as 1 | 2 | 3);
      }
    }
  });

  test('only the final phase uses cataclysm breakTier; earlier phases use detonation', () => {
    // Folio VIb policy: Tier IV (detonation) on phase break, Tier V (cataclysm)
    // on boss final. This test enforces the policy across all 8 bosses.
    for (let id = 1; id <= 8; id++) {
      const phases = ZONE_VISUAL_SPECS[id as ZoneId].boss.phases;
      for (let i = 0; i < phases.length; i++) {
        const isFinal = i === phases.length - 1;
        const expected = isFinal ? 'cataclysm' : 'detonation';
        expect(phases[i]?.breakTier, `Z${id}.phases[${i}].breakTier`).toBe(expected);
      }
    }
  });
});

describe('visual-spec — schema canary', () => {
  /**
   * Frozen hash of the normalized contents of `src/visual-spec/types.ts`.
   * Updated only when a schema change is *intentional and reviewed*.
   *
   * If this test fails:
   *   1. Run the test, copy the actual hash from the failure message.
   *   2. Confirm the schema change is intended and follows the deprecation
   *      cycle (see plan file `i-looked-at-visual-spec-mighty-anchor.md`).
   *   3. Update SCHEMA_CANARY below to the actual hash.
   *   4. Note in the commit message what schema element changed and why.
   */
  // Bumped at Session 2 (engine package promotion + Biome reformat): types.ts
  // imports ShapeSpec from '@flare-engine/shapes' (was '../shapes'); Biome
  // also reformatted whitespace. Same type, new location — refactor only,
  // no public-surface schema change.
  // Bumped at Session 121 (Z3-Refactor): added 'water-shader' | 'fog-shader' variants
  // to ParallaxLayer.content union — additive per schema stability protocol.
  // Bumped at Session 112 (VS-S8d palette absorption): reordered imports in types.ts
  // (EntityId before AmbienceKind/ZoneId) to satisfy Biome organizeImports — refactor
  // only, no public-surface schema change.
  // Bumped at Session 113 (VS-S8e shape-catalogue absorption): EntityId inlined as a
  // concrete string-literal union in types.ts (moved from shape-catalogue.ts); import
  // of EntityId from '../shape-catalogue' removed. Same type semantics — relocation only.
  // Bumped at Session 152 (PT-SpiralCollapse): SpiralCollapseDef gained 5 optional
  // fields (inwardEasing, scaleFrom, scaleTo, alphaFrom, alphaTo) — additive per
  // schema stability protocol ("adding optional fields" is permitted).
  // Bumped at Session 164 (PT-HUD-DataDriven): Inset.dx/dy widened from `number`
  // to `number | \`${number}%\`` (InsetValue) — additive union variant per protocol.
  // Bumped at Session 172 (PT-SigilPulse): SigilPulseDef added; 'sigil-pulse' added to
  // AnimationPresetId and AnimationDef union — additive per schema stability protocol.
  // Bumped at Session 174 (PT-Z1-ShaderBg): 'fire-shader' added to ParallaxLayer.content
  // union — additive variant per schema stability protocol.
  // Bumped at Session 175 (PT-Z5-Z8-ShaderBg): 4 new ColorTokenId entries added
  // (vistulaBlue, foamBlue, mistBlue, lunarInk) — additive per schema stability protocol.
  // Bumped at Session 178 (PT-ColorUnify-B): 'katakumbyDark' added to ColorTokenId
  // union — additive per schema stability protocol.
  // Bumped at Session 179 (PT-ColorUnify-C): 'riverDepth' + 'marshOlive' added to
  // ColorTokenId union — additive per schema stability protocol.
  // canary bumped #180 PT-ColorUnify-D
  const SCHEMA_CANARY = '76db8bcf491cd747b7e7135d16874bda3b3ce47fded1c4e2711d3bf93501e894';

  test('types.ts public surface unchanged (or canary updated deliberately)', () => {
    const path = join(import.meta.dir, '..', 'src', 'visual-spec', 'types.ts');
    const src = readFileSync(path, 'utf-8');
    const normalized = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const actual = createHash('sha256').update(normalized).digest('hex');
    if (actual !== SCHEMA_CANARY) {
      throw new Error(
        `Schema canary mismatch — types.ts changed.\n  expected: ${SCHEMA_CANARY}\n  actual:   ${actual}\nIf intentional, follow the deprecation cycle in the plan and update SCHEMA_CANARY.`,
      );
    }
    expect(actual).toBe(SCHEMA_CANARY);
  });
});
