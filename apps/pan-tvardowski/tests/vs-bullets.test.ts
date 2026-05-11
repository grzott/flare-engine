import { describe, expect, test } from 'bun:test';
import { BULLET_DEFS } from '../src/visual-spec/bullets';

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

describe('vs-bullets', () => {
  test('BULLET_DEFS has 5 entries', () => {
    expect(BULLET_DEFS.length).toBe(5);
  });

  test('every bullet fill is a valid #RRGGBB hex', () => {
    const violations: string[] = [];
    for (const bullet of BULLET_DEFS) {
      if (!HEX_RE.test(bullet.fill)) violations.push(`${bullet.id}.fill = ${bullet.fill}`);
    }
    expect(violations).toEqual([]);
  });

  test('every id is unique', () => {
    const ids = BULLET_DEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(BULLET_DEFS.length);
  });
});
