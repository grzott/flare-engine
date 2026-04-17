import { describe, expect, it } from 'bun:test';
import {
  circleVsCircle,
  lineVsCircle,
  lineVsRect,
  pointInCircle,
  pointInRect,
  rayVsRect,
  rectVsCircle,
  rectVsRect,
} from '../src/index.js';

const rect = { x: 0, y: 0, width: 10, height: 10 };
const circle = { x: 0, y: 0, radius: 5 };

describe('pointInRect', () => {
  it('inside', () => expect(pointInRect({ x: 5, y: 5 }, rect)).toBe(true));
  it('outside', () => expect(pointInRect({ x: 15, y: 5 }, rect)).toBe(false));
  it('on edge', () => expect(pointInRect({ x: 0, y: 0 }, rect)).toBe(true));
  it('on far corner', () => expect(pointInRect({ x: 10, y: 10 }, rect)).toBe(true));
});

describe('pointInCircle', () => {
  it('center', () => expect(pointInCircle({ x: 0, y: 0 }, circle)).toBe(true));
  it('inside', () => expect(pointInCircle({ x: 3, y: 0 }, circle)).toBe(true));
  it('on edge', () => expect(pointInCircle({ x: 5, y: 0 }, circle)).toBe(true));
  it('outside', () => expect(pointInCircle({ x: 6, y: 0 }, circle)).toBe(false));
});

describe('rectVsRect', () => {
  it('overlap', () => {
    expect(rectVsRect(rect, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
  it('no overlap', () => {
    expect(rectVsRect(rect, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
  });
  it('touching edges', () => {
    expect(rectVsRect(rect, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
  });
  it('contained', () => {
    expect(rectVsRect(rect, { x: 2, y: 2, width: 3, height: 3 })).toBe(true);
  });
});

describe('rectVsCircle', () => {
  it('overlap', () => {
    expect(rectVsCircle(rect, { x: 5, y: 5, radius: 3 })).toBe(true);
  });
  it('no overlap', () => {
    expect(rectVsCircle(rect, { x: 20, y: 20, radius: 2 })).toBe(false);
  });
  it('circle on corner', () => {
    expect(rectVsCircle(rect, { x: -3, y: -4, radius: 5 })).toBe(true);
  });
});

describe('circleVsCircle', () => {
  it('overlap', () => {
    expect(circleVsCircle(circle, { x: 8, y: 0, radius: 5 })).toBe(true);
  });
  it('no overlap', () => {
    expect(circleVsCircle(circle, { x: 20, y: 0, radius: 3 })).toBe(false);
  });
  it('touching', () => {
    expect(circleVsCircle(circle, { x: 10, y: 0, radius: 5 })).toBe(false);
  });
  it('same', () => {
    expect(circleVsCircle(circle, circle)).toBe(true);
  });
});

describe('lineVsRect', () => {
  it('line through rect', () => {
    expect(lineVsRect(-5, 5, 15, 5, rect)).toBe(true);
  });
  it('line above rect', () => {
    expect(lineVsRect(-5, -5, 15, -5, rect)).toBe(false);
  });
  it('line starting inside', () => {
    expect(lineVsRect(5, 5, 15, 5, rect)).toBe(true);
  });
  it('line ending inside', () => {
    expect(lineVsRect(-5, 5, 5, 5, rect)).toBe(true);
  });
  it('line fully inside', () => {
    expect(lineVsRect(2, 2, 8, 8, rect)).toBe(true);
  });
  it('vertical line through', () => {
    expect(lineVsRect(5, -5, 5, 15, rect)).toBe(true);
  });
  it('zero-length line inside', () => {
    expect(lineVsRect(5, 5, 5, 5, rect)).toBe(true);
  });
  it('zero-length line outside', () => {
    expect(lineVsRect(15, 15, 15, 15, rect)).toBe(false);
  });
});

describe('lineVsCircle', () => {
  it('line through circle', () => {
    expect(lineVsCircle(-10, 0, 10, 0, circle)).toBe(true);
  });
  it('line missing circle', () => {
    expect(lineVsCircle(-10, 10, 10, 10, circle)).toBe(false);
  });
  it('line starting inside', () => {
    expect(lineVsCircle(0, 0, 10, 0, circle)).toBe(true);
  });
  it('line fully inside', () => {
    expect(lineVsCircle(-1, 0, 1, 0, circle)).toBe(true);
  });
  it('tangent line', () => {
    expect(lineVsCircle(-10, 5, 10, 5, circle)).toBe(true);
  });
  it('zero-length line inside', () => {
    expect(lineVsCircle(0, 0, 0, 0, circle)).toBe(true);
  });
  it('zero-length line outside', () => {
    expect(lineVsCircle(10, 10, 10, 10, circle)).toBe(false);
  });
});

describe('rayVsRect', () => {
  it('ray hitting rect', () => {
    const t = rayVsRect(-5, 5, 1, 0, rect);
    expect(t).not.toBeNull();
    expect(t).toBeCloseTo(5);
  });
  it('ray missing rect', () => {
    expect(rayVsRect(-5, -5, 1, 0, rect)).toBeNull();
  });
  it('ray starting inside', () => {
    const t = rayVsRect(5, 5, 1, 0, rect);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThanOrEqual(0);
  });
  it('ray pointing away', () => {
    expect(rayVsRect(-5, 5, -1, 0, rect)).toBeNull();
  });
  it('diagonal ray', () => {
    const t = rayVsRect(-5, -5, 1, 1, rect);
    expect(t).not.toBeNull();
  });
});
