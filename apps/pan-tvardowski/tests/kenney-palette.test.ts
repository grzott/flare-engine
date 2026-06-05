/**
 * kenney-palette.test.ts
 *
 * Deterministic regression tests for the committed kenney-palette.ts module.
 * Does NOT run sharp or perform any PNG I/O — imports the committed module only.
 */

import { describe, expect, test } from 'bun:test';
import { KENNEY_PALETTE, KENNEY_ROLES, THEME_REMAP } from '../src/visual-spec/kenney-palette';
import type { KenneyRole } from '../src/visual-spec/kenney-palette';

const ROLE_KEYS: readonly KenneyRole[] = [
  'player',
  'enemy',
  'enemy-ufo',
  'bullet-player',
  'bullet-enemy',
  'fire',
  'explosion',
  'pickup',
  'bg',
];

const EXPECTED_FAMILY_COUNT = 19;

describe('KENNEY_PALETTE — structural invariants', () => {
  test(`has exactly ${EXPECTED_FAMILY_COUNT} families`, () => {
    expect(KENNEY_PALETTE.size).toBe(EXPECTED_FAMILY_COUNT);
  });

  test('every family ramp has exactly 5 hex entries', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      if (entry.ramp.length !== 5) violations.push(id);
    }
    expect(violations).toEqual([]);
  });

  test('every ramp hex matches #rrggbb format', () => {
    const violations: string[] = [];
    const hexRe = /^#[0-9a-f]{6}$/i;
    for (const [id, entry] of KENNEY_PALETTE) {
      for (const hex of entry.ramp) {
        if (!hexRe.test(hex)) violations.push(`${id}: ${hex}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('every family oklch tuple has exactly 5 entries', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      if (entry.oklch.length !== 5) violations.push(id);
    }
    expect(violations).toEqual([]);
  });

  test('ramp is sorted dark→light: oklch[i].L < oklch[i+1].L', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      for (let i = 0; i < 4; i++) {
        const Li = entry.oklch[i]!.L;
        const Li1 = entry.oklch[i + 1]!.L;
        if (Li >= Li1) violations.push(`${id}[${i}].L=${Li} >= [${i + 1}].L=${Li1}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('all oklch entries: L in [0,1]', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      for (let i = 0; i < 5; i++) {
        const L = entry.oklch[i]!.L;
        if (L < 0 || L > 1) violations.push(`${id}[${i}].L=${L}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('all oklch entries: C in [0,0.4]', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      for (let i = 0; i < 5; i++) {
        const C = entry.oklch[i]!.C;
        if (C < 0 || C > 0.4) violations.push(`${id}[${i}].C=${C}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('all oklch entries: h in [0,360)', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      for (let i = 0; i < 5; i++) {
        const h = entry.oklch[i]!.h;
        if (h < 0 || h >= 360) violations.push(`${id}[${i}].h=${h}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('entry.family matches map key', () => {
    const violations: string[] = [];
    for (const [id, entry] of KENNEY_PALETTE) {
      if (entry.family !== id) violations.push(`${id}: entry.family=${entry.family}`);
    }
    expect(violations).toEqual([]);
  });
});

describe('KENNEY_ROLES — coverage', () => {
  test('all expected role keys are present', () => {
    const missing: KenneyRole[] = [];
    for (const role of ROLE_KEYS) {
      if (!(role in KENNEY_ROLES)) missing.push(role);
    }
    expect(missing).toEqual([]);
  });

  test('every role value is a family id present in KENNEY_PALETTE', () => {
    const missing: string[] = [];
    for (const role of ROLE_KEYS) {
      const familyId = KENNEY_ROLES[role];
      if (!KENNEY_PALETTE.has(familyId)) missing.push(`${role} → ${familyId}`);
    }
    expect(missing).toEqual([]);
  });

  test('KENNEY_ROLES has exactly 9 entries', () => {
    expect(Object.keys(KENNEY_ROLES).length).toBe(9);
  });
});

describe('THEME_REMAP — full coverage', () => {
  test('THEME_REMAP has an entry for every family in KENNEY_PALETTE', () => {
    const missing: string[] = [];
    for (const [id] of KENNEY_PALETTE) {
      if (!(id in THEME_REMAP)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  test('THEME_REMAP has no extra entries beyond KENNEY_PALETTE families', () => {
    const extra: string[] = [];
    for (const key of Object.keys(THEME_REMAP)) {
      if (!KENNEY_PALETTE.has(key)) extra.push(key);
    }
    expect(extra).toEqual([]);
  });

  test('all THEME_REMAP targetHue values are in [0, 360)', () => {
    const violations: string[] = [];
    for (const [id, entry] of Object.entries(THEME_REMAP)) {
      if (entry.targetHue < 0 || entry.targetHue >= 360) {
        violations.push(`${id}.targetHue=${entry.targetHue}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('all THEME_REMAP chromaScale values are positive', () => {
    const violations: string[] = [];
    for (const [id, entry] of Object.entries(THEME_REMAP)) {
      if (entry.chromaScale <= 0) violations.push(`${id}.chromaScale=${entry.chromaScale}`);
    }
    expect(violations).toEqual([]);
  });
});

describe('KENNEY_PALETTE — determinism regression (stamped hex values)', () => {
  test('player ramp[0] is #aa453b (darkest centroid)', () => {
    expect(KENNEY_PALETTE.get('player')?.ramp[0]).toBe('#aa453b');
  });

  test('laser-blue ramp[0] is #1884b4 (darkest centroid)', () => {
    expect(KENNEY_PALETTE.get('laser-blue')?.ramp[0]).toBe('#1884b4');
  });

  test('explosion ramp[0] is #272727 (darkest centroid)', () => {
    expect(KENNEY_PALETTE.get('explosion')?.ramp[0]).toBe('#272727');
  });

  test('bg ramp[0] is #3a2e3f (darkest centroid)', () => {
    expect(KENNEY_PALETTE.get('bg')?.ramp[0]).toBe('#3a2e3f');
  });

  test('powerup-yellow ramp[4] is #ffcc00 (lightest centroid)', () => {
    expect(KENNEY_PALETTE.get('powerup-yellow')?.ramp[4]).toBe('#ffcc00');
  });

  test('laser-red ramp[4] is #fffefe (lightest centroid)', () => {
    expect(KENNEY_PALETTE.get('laser-red')?.ramp[4]).toBe('#fffefe');
  });

  test('enemy-black ramp has expected 5-step dark purple progression', () => {
    const ramp = KENNEY_PALETTE.get('enemy-black')?.ramp;
    expect(ramp).toEqual(['#4e4359', '#5a5164', '#665c70', '#cacaca', '#ededed']);
  });
});
