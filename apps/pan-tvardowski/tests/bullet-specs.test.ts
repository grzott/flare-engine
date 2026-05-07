import { describe, expect, test } from 'bun:test';
import { BULLET_DEFS } from '../src/visual-spec';

const HEX_REGEX = /^#[0-9a-fA-F]{6,8}$/;

describe('bullet-specs', () => {
  test('BULLET_DEFS has unique ids and matches expected count', () => {
    expect(BULLET_DEFS.length).toBe(5);
    const ids = BULLET_DEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(BULLET_DEFS.length);
  });

  test('every BulletDef fill is a valid hex', () => {
    const violations = BULLET_DEFS.filter((b) => !HEX_REGEX.test(b.fill)).map(
      (b) => `${b.id}: ${b.fill}`,
    );
    expect(violations).toEqual([]);
  });
});
