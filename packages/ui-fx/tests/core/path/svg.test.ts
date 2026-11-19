import { describe, expect, test } from 'bun:test';
import { parseSvgPath } from '../../../src/core/path/svg';

const expectClose = (actual: readonly number[], expected: readonly number[]): void => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) expect(actual[i]!).toBeCloseTo(expected[i]!, 9);
};

describe('parseSvgPath', () => {
  test('a relative line is one cubic ending at (100, 0)', () => {
    const cubics = parseSvgPath('M0 0 l100 0');
    expect(cubics.length).toBe(8);
    expect(cubics[0]).toBe(0);
    expect(cubics[1]).toBe(0);
    expect(cubics[6]).toBe(100);
    expect(cubics[7]).toBe(0);
  });

  test('a line puts its control points at the thirds', () => {
    expectClose(parseSvgPath('M0 0 L90 30'), [0, 0, 30, 10, 60, 20, 90, 30]);
  });

  test('absolute and relative lines agree', () => {
    expectClose(parseSvgPath('M10 20 L40 50'), parseSvgPath('m10 20 l30 30'));
  });

  test('H and V move along one axis, absolute and relative', () => {
    expectClose(
      parseSvgPath('M10 20 H40 V80'),
      [10, 20, 20, 20, 30, 20, 40, 20, 40, 20, 40, 40, 40, 60, 40, 80],
    );
    expectClose(parseSvgPath('M10 20 h30 v60'), parseSvgPath('M10 20 H40 V80'));
  });

  test('C passes its control points through, absolute and relative', () => {
    expectClose(parseSvgPath('M10 10 C20 0 30 40 50 10'), [10, 10, 20, 0, 30, 40, 50, 10]);
    expectClose(parseSvgPath('M10 10 c10 -10 20 30 40 0'), [10, 10, 20, 0, 30, 40, 50, 10]);
  });

  test('Q is raised to the equivalent cubic, absolute and relative', () => {
    // c1 = p0 + 2/3 (q - p0), c2 = p + 2/3 (q - p)
    expectClose(parseSvgPath('M0 0 Q30 60 90 0'), [0, 0, 20, 40, 50, 40, 90, 0]);
    expectClose(parseSvgPath('M10 10 q30 60 90 0'), [10, 10, 30, 50, 60, 50, 100, 10]);
  });

  test('Z closes with a line back to the subpath start', () => {
    const cubics = parseSvgPath('M0 0 L100 0 L100 100 Z');
    expect(cubics.length).toBe(24);
    expectClose(cubics.slice(16), [100, 100, 100 - 100 / 3, 100 - 100 / 3, 100 / 3, 100 / 3, 0, 0]);
    expectClose(parseSvgPath('M0 0 L100 0 L100 100 z'), cubics);
  });

  test('Z on an already closed subpath adds nothing', () => {
    expect(parseSvgPath('M0 0 L100 0 L0 0 Z').length).toBe(16);
  });

  test('a relative command after Z starts from the subpath start', () => {
    const cubics = parseSvgPath('M10 10 L50 10 Z l0 20');
    expectClose(cubics.slice(16, 18), [10, 10]);
    expectClose(cubics.slice(22), [10, 30]);
  });

  test('coordinates after a moveto are implicit linetos, relative after m', () => {
    expectClose(parseSvgPath('M0 0 10 0 10 10'), parseSvgPath('M0 0 L10 0 L10 10'));
    expectClose(parseSvgPath('m5 5 10 0 0 10'), parseSvgPath('M5 5 L15 5 L15 15'));
  });

  test('a command repeats while coordinates remain', () => {
    expectClose(parseSvgPath('M0 0 l10 0 0 10'), parseSvgPath('M0 0 l10 0 l0 10'));
    expectClose(
      parseSvgPath('M0 0 C1 2 3 4 5 6 7 8 9 10 11 12'),
      parseSvgPath('M0 0 C1 2 3 4 5 6 C7 8 9 10 11 12'),
    );
  });

  test('compact number forms: commas, signs as separators, bare decimals, exponents', () => {
    expectClose(parseSvgPath('M0,0L10-5'), parseSvgPath('M0 0 L10 -5'));
    expectClose(parseSvgPath('M.5.5l1e1,0'), parseSvgPath('M0.5 0.5 l10 0'));
  });

  test('a second moveto starts a new subpath without joining it', () => {
    const cubics = parseSvgPath('M0 0 L10 0 M50 50 L60 50');
    expect(cubics.length).toBe(16);
    expectClose(cubics.slice(8, 10), [50, 50]);
  });

  test('a path that draws nothing has no cubics', () => {
    expect(parseSvgPath('')).toEqual([]);
    expect(parseSvgPath('  ')).toEqual([]);
    expect(parseSvgPath('M10 10')).toEqual([]);
  });

  test('rejects path data it cannot read', () => {
    expect(() => parseSvgPath('L10 10')).toThrow(RangeError);
    expect(() => parseSvgPath('10 10')).toThrow(RangeError);
    expect(() => parseSvgPath('M0 0 L10')).toThrow(RangeError);
    expect(() => parseSvgPath('M0 0 C1 2 3 4 5')).toThrow(RangeError);
    expect(() => parseSvgPath('M0 0 Z 5 5')).toThrow(RangeError);
    expect(() => parseSvgPath('M0 0 L')).toThrow(RangeError);
    expect(() => parseSvgPath('M0 0 L10 # 10')).toThrow(RangeError);
  });

  test('rejects the commands it does not support, naming them', () => {
    expect(() => parseSvgPath('M0 0 A5 5 0 0 1 10 10')).toThrow(/"A"/);
    expect(() => parseSvgPath('M0 0 S5 5 10 10')).toThrow(/"S"/);
    expect(() => parseSvgPath('M0 0 T10 10')).toThrow(/"T"/);
  });
});
