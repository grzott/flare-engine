import { describe, expect, test } from 'bun:test';
import {
  directionInto,
  resolveEdge,
  resolveOriginInto,
  type Vec2Out,
} from '../../src/core/conventions';

const o: Vec2Out = { x: 0, y: 0 };

describe('directionInto', () => {
  test('directionInto: 0° up, 90° right, clockwise', () => {
    expect(directionInto(0, o)).toMatchObject({ x: 0, y: -1 });
    expect(directionInto(90, o).x).toBeCloseTo(1, 12);
    expect(directionInto(180, o).y).toBeCloseTo(1, 12);
  });

  test('270° is left, and the vector is unit length at any angle', () => {
    expect(directionInto(270, o).x).toBeCloseTo(-1, 12);
    expect(directionInto(270, o).y).toBeCloseTo(0, 12);
    for (const angle of [-45, 33, 135, 400]) {
      directionInto(angle, o);
      expect(Math.hypot(o.x, o.y)).toBeCloseTo(1, 12);
    }
  });

  test('45° points up and to the right', () => {
    directionInto(45, o);
    expect(o.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(o.y).toBeCloseTo(-Math.SQRT1_2, 12);
  });

  test('writes into and returns the out object', () => {
    const out: Vec2Out = { x: 7, y: 7 };
    expect(directionInto(90, out)).toBe(out);
  });
});

describe('resolveOriginInto', () => {
  test("'center' is the middle of the element, in pixels", () => {
    expect(resolveOriginInto('center', 200, 80, null, o)).toEqual({ x: 100, y: 40 });
  });

  test('a normalised origin scales by the element size', () => {
    expect(resolveOriginInto({ x: 0, y: 1 }, 200, 80, null, o)).toEqual({ x: 0, y: 80 });
    expect(resolveOriginInto({ x: 0.25, y: 0.5 }, 200, 80, null, o)).toEqual({ x: 50, y: 40 });
  });

  test("'press' uses the press point, which is already in element pixels", () => {
    expect(resolveOriginInto('press', 200, 80, { x: 12, y: 34 }, o)).toEqual({ x: 12, y: 34 });
  });

  test("'press' with no press point resolves to the centre", () => {
    expect(resolveOriginInto('press', 200, 80, null, o)).toEqual({ x: 100, y: 40 });
  });

  test('a press point is ignored unless the origin asks for it', () => {
    expect(resolveOriginInto('center', 200, 80, { x: 12, y: 34 }, o)).toEqual({ x: 100, y: 40 });
  });

  test('writes into and returns the out object, and leaves the press point alone', () => {
    const press: Vec2Out = { x: 12, y: 34 };
    const out: Vec2Out = { x: 0, y: 0 };
    expect(resolveOriginInto('press', 200, 80, press, out)).toBe(out);
    expect(press).toEqual({ x: 12, y: 34 });
  });
});

describe('resolveEdge', () => {
  test('resolveEdge start/end follow rtl', () => {
    expect(resolveEdge('start', false)).toBe('left');
    expect(resolveEdge('start', true)).toBe('right');
  });

  test('end is the opposite of start', () => {
    expect(resolveEdge('end', false)).toBe('right');
    expect(resolveEdge('end', true)).toBe('left');
  });

  test('physical edges ignore rtl', () => {
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      expect(resolveEdge(edge, false)).toBe(edge);
      expect(resolveEdge(edge, true)).toBe(edge);
    }
  });
});
