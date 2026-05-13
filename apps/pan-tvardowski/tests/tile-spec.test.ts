import { describe, expect, test } from 'bun:test';
import { hexToArgb } from '../src/util/hex';
import { TILE_DEFS } from '../src/visual-spec';

const HEX_REGEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

describe('tile-spec — Hex validation', () => {
  test('every baseFill matches HEX_REGEX', () => {
    const violations = TILE_DEFS.filter((d) => !HEX_REGEX.test(d.baseFill)).map(
      (d) => `${d.id}: baseFill=${d.baseFill}`,
    );
    expect(violations).toEqual([]);
  });

  test('every accent.fill (when present) matches HEX_REGEX', () => {
    const violations = TILE_DEFS.filter(
      (d) => d.accent !== undefined && !HEX_REGEX.test(d.accent.fill),
    ).map((d) => `${d.id}: accent.fill=${d.accent!.fill}`);
    expect(violations).toEqual([]);
  });
});

describe('tile-spec — positive size', () => {
  test('every tile has a positive size', () => {
    for (const def of TILE_DEFS) {
      expect(def.size, `${def.id} size`).toBeGreaterThan(0);
    }
  });
});

describe('tile-spec — ARGB parity with original hardcodes', () => {
  test('tile-fire baseFill == 0xffb05a3c', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-fire')!;
    expect(hexToArgb(def.baseFill)).toBe(0xffb05a3c);
  });

  test('tile-water baseFill == 0xff2f5f7a', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-water')!;
    expect(hexToArgb(def.baseFill)).toBe(0xff2f5f7a);
  });

  test('tile-water accent.fill == 0x66d9e4e7', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-water')!;
    expect(def.accent).toBeDefined();
    expect(hexToArgb(def.accent!.fill)).toBe(0x66d9e4e7);
  });

  test('tile-fog baseFill == 0x44e4f0ff', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-fog')!;
    expect(hexToArgb(def.baseFill)).toBe(0x44e4f0ff);
  });
});

describe('tile-spec — accent presence', () => {
  test('tile-fire has no accent', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-fire')!;
    expect(def.accent).toBeUndefined();
  });

  test('tile-fog has no accent', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-fog')!;
    expect(def.accent).toBeUndefined();
  });

  test('tile-water has ripple-2line accent', () => {
    const def = TILE_DEFS.find((d) => String(d.id) === 'tile-water')!;
    expect(def.accent?.pattern).toBe('ripple-2line');
  });
});
