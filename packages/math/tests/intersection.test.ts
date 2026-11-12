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

  describe('vertical ray (dirX === 0)', () => {
    it('origin inside the x slab hits at the near face', () => {
      expect(rayVsRect(5, -5, 0, 1, rect)).toBe(5);
    });
    it('origin outside the x slab misses', () => {
      expect(rayVsRect(15, -5, 0, 1, rect)).toBeNull();
      expect(rayVsRect(-1, -5, 0, 1, rect)).toBeNull();
    });
    it('origin on the x = 0 edge hits', () => {
      expect(rayVsRect(0, -5, 0, 1, rect)).toBe(5);
    });
    it('origin on the x = 10 edge hits', () => {
      expect(rayVsRect(10, -5, 0, 1, rect)).toBe(5);
    });
    it('negative direction along an edge hits', () => {
      expect(rayVsRect(0, 15, 0, -1, rect)).toBe(5);
      expect(rayVsRect(10, 15, 0, -1, rect)).toBe(5);
    });
    it('on an edge line pointing away from the rect misses', () => {
      expect(rayVsRect(0, -5, 0, -1, rect)).toBeNull();
      expect(rayVsRect(10, 15, 0, 1, rect)).toBeNull();
    });
    it('starting on an edge, inside the rect span, returns the exit distance', () => {
      expect(rayVsRect(0, 5, 0, 1, rect)).toBe(5);
      expect(rayVsRect(10, 5, 0, -1, rect)).toBe(5);
    });
  });

  describe('horizontal ray (dirY === 0)', () => {
    it('origin inside the y slab hits at the near face', () => {
      expect(rayVsRect(-5, 5, 1, 0, rect)).toBe(5);
    });
    it('origin outside the y slab misses', () => {
      expect(rayVsRect(-5, 15, 1, 0, rect)).toBeNull();
      expect(rayVsRect(-5, -1, 1, 0, rect)).toBeNull();
    });
    it('origin on the y = 0 edge hits', () => {
      expect(rayVsRect(-5, 0, 1, 0, rect)).toBe(5);
    });
    it('origin on the y = 10 edge hits', () => {
      expect(rayVsRect(-5, 10, 1, 0, rect)).toBe(5);
    });
    it('negative direction along an edge hits', () => {
      expect(rayVsRect(15, 0, -1, 0, rect)).toBe(5);
      expect(rayVsRect(15, 10, -1, 0, rect)).toBe(5);
    });
    it('on an edge line pointing away from the rect misses', () => {
      expect(rayVsRect(-5, 0, -1, 0, rect)).toBeNull();
      expect(rayVsRect(15, 10, 1, 0, rect)).toBeNull();
    });
    it('starting on an edge, inside the rect span, returns the exit distance', () => {
      expect(rayVsRect(5, 0, 1, 0, rect)).toBe(5);
      expect(rayVsRect(5, 10, -1, 0, rect)).toBe(5);
    });
  });

  it('never returns NaN for a zero direction component on a slab edge', () => {
    const edges = [0, 10];
    for (const e of edges) {
      for (const d of [1, -1]) {
        expect(rayVsRect(e, -5, 0, d, rect)).not.toBeNaN();
        expect(rayVsRect(e, 15, 0, d, rect)).not.toBeNaN();
        expect(rayVsRect(-5, e, d, 0, rect)).not.toBeNaN();
        expect(rayVsRect(15, e, d, 0, rect)).not.toBeNaN();
      }
    }
  });

  it('axis-parallel ray from the min corner along an edge hits at 0', () => {
    expect(rayVsRect(0, 0, 0, 1, rect)).toBe(0);
    expect(rayVsRect(0, 0, 1, 0, rect)).toBe(0);
  });

  describe('zero direction', () => {
    it('from inside returns null', () => {
      expect(rayVsRect(5, 5, 0, 0, rect)).toBeNull();
    });
    it('from outside returns null', () => {
      expect(rayVsRect(20, 20, 0, 0, rect)).toBeNull();
    });
    it('from an edge or corner returns null', () => {
      expect(rayVsRect(0, 5, 0, 0, rect)).toBeNull();
      expect(rayVsRect(10, 10, 0, 0, rect)).toBeNull();
    });
  });

  it('non-zero-direction behaviour is unchanged', () => {
    expect(rayVsRect(5, 5, 1, 0, rect)).toBe(5);
    expect(rayVsRect(5, 5, 0, -1, rect)).toBe(5);
    expect(rayVsRect(-5, -5, 1, 1, rect)).toBe(5);
    expect(rayVsRect(15, 5, -2, 0, rect)).toBe(2.5);
  });
});
