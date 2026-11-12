import { describe, expect, it } from 'bun:test';
import {
  Circle,
  circleVsCircle,
  lineVsCircle,
  lineVsRect,
  pointInCircle,
  pointInRect,
  Rect,
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

describe('boundary semantics', () => {
  it('pointInRect is inclusive on every edge and corner', () => {
    expect(pointInRect({ x: 0, y: 5 }, rect)).toBe(true);
    expect(pointInRect({ x: 10, y: 5 }, rect)).toBe(true);
    expect(pointInRect({ x: 5, y: 0 }, rect)).toBe(true);
    expect(pointInRect({ x: 5, y: 10 }, rect)).toBe(true);
    expect(pointInRect({ x: 10, y: 0 }, rect)).toBe(true);
    expect(pointInRect({ x: 0, y: 10 }, rect)).toBe(true);
    expect(pointInRect({ x: 11, y: 5 }, rect)).toBe(false);
    expect(pointInRect({ x: 5, y: -1 }, rect)).toBe(false);
  });

  it('pointInCircle is inclusive on the circumference', () => {
    expect(pointInCircle({ x: -5, y: 0 }, circle)).toBe(true);
    expect(pointInCircle({ x: 0, y: 5 }, circle)).toBe(true);
    expect(pointInCircle({ x: 3, y: 4 }, circle)).toBe(true);
    expect(pointInCircle({ x: 4, y: 4 }, circle)).toBe(false);
  });

  it('rectVsRect is strict: rects sharing only an edge or a corner do not overlap', () => {
    expect(rectVsRect(rect, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectVsRect(rect, { x: -10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectVsRect(rect, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
    expect(rectVsRect(rect, { x: 0, y: -10, width: 10, height: 10 })).toBe(false);
    expect(rectVsRect(rect, { x: 10, y: 10, width: 10, height: 10 })).toBe(false);
    expect(rectVsRect(rect, { x: 9, y: 9, width: 10, height: 10 })).toBe(true);
  });

  it('rectVsCircle is inclusive: a circle tangent to an edge or a corner overlaps', () => {
    expect(rectVsCircle(rect, { x: 15, y: 5, radius: 5 })).toBe(true);
    expect(rectVsCircle(rect, { x: 5, y: -5, radius: 5 })).toBe(true);
    expect(rectVsCircle(rect, { x: 13, y: 14, radius: 5 })).toBe(true);
    expect(rectVsCircle(rect, { x: 16, y: 5, radius: 5 })).toBe(false);
    expect(rectVsCircle(rect, { x: 14, y: 14, radius: 5 })).toBe(false);
  });

  it('circleVsCircle is strict: externally tangent circles do not overlap', () => {
    expect(circleVsCircle(circle, { x: 10, y: 0, radius: 5 })).toBe(false);
    expect(circleVsCircle(circle, { x: 0, y: -10, radius: 5 })).toBe(false);
    expect(circleVsCircle(circle, { x: 6, y: 8, radius: 5 })).toBe(false);
    expect(circleVsCircle(circle, { x: 9, y: 0, radius: 5 })).toBe(true);
    expect(circleVsCircle(circle, { x: 1, y: 0, radius: 1 })).toBe(true);
  });
});

// Each free function and its namespace twin must answer alike on every boundary case —
// touching edges, shared corner, containment, disjoint — so neither can drift alone.
describe('free functions agree with their Rect / Circle twins', () => {
  // Offsets step across both edges of `rect` (0..10) and the circumference of `circle` (r = 5).
  const steps = [-11, -10, -6, -5, -4, -3, 0, 3, 4, 5, 6, 9, 10, 11, 15, 16, 20];
  const sizes = [0, 1, 5, 10, 30];

  it('pointInRect matches Rect.contains', () => {
    let hits = 0;
    for (const x of steps) {
      for (const y of steps) {
        const p = { x, y };
        const got = pointInRect(p, rect);
        expect(got).toBe(Rect.contains(rect, p));
        if (got) hits++;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(steps.length * steps.length);
  });

  it('pointInCircle matches Circle.contains', () => {
    let hits = 0;
    for (const x of steps) {
      for (const y of steps) {
        const p = { x, y };
        const got = pointInCircle(p, circle);
        expect(got).toBe(Circle.contains(circle, p));
        if (got) hits++;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(steps.length * steps.length);
  });

  it('rectVsRect matches Rect.intersects', () => {
    let hits = 0;
    let total = 0;
    for (const x of steps) {
      for (const y of steps) {
        for (const size of sizes) {
          const other = { x, y, width: size, height: size };
          const got = rectVsRect(rect, other);
          expect(got).toBe(Rect.intersects(rect, other));
          expect(rectVsRect(other, rect)).toBe(Rect.intersects(other, rect));
          if (got) hits++;
          total++;
        }
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(total);
  });

  it('rectVsCircle matches Circle.intersectsRect', () => {
    let hits = 0;
    let total = 0;
    for (const x of steps) {
      for (const y of steps) {
        for (const radius of sizes) {
          const c = { x, y, radius };
          const got = rectVsCircle(rect, c);
          expect(got).toBe(Circle.intersectsRect(c, rect));
          if (got) hits++;
          total++;
        }
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(total);
  });

  it('circleVsCircle matches Circle.intersects', () => {
    let hits = 0;
    let total = 0;
    for (const x of steps) {
      for (const y of steps) {
        for (const radius of sizes) {
          const other = { x, y, radius };
          const got = circleVsCircle(circle, other);
          expect(got).toBe(Circle.intersects(circle, other));
          expect(circleVsCircle(other, circle)).toBe(Circle.intersects(other, circle));
          if (got) hits++;
          total++;
        }
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(total);
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

describe('lineVsRect matches its previous allocating body (#118)', () => {
  // The body lineVsRect had before #118, kept verbatim as the reference.
  function lineVsRectReference(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: { x: number; y: number; width: number; height: number },
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tMin = 0;
    let tMax = 1;
    const edges = [
      { p: -dx, q: x1 - r.x },
      { p: dx, q: r.x + r.width - x1 },
      { p: -dy, q: y1 - r.y },
      { p: dy, q: r.y + r.height - y1 },
    ];
    for (const { p, q } of edges) {
      if (Math.abs(p) < 1e-12) {
        if (q < 0) return false;
      } else {
        const t = q / p;
        if (p < 0) {
          if (t > tMax) return false;
          if (t > tMin) tMin = t;
        } else {
          if (t < tMin) return false;
          if (t < tMax) tMax = t;
        }
      }
    }
    return tMin <= tMax;
  }

  it('agrees on a seeded random sweep, including grid-aligned and degenerate segments', () => {
    let seed = 0x5eed118;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const pick = (): number => {
      const u = rand();
      // A third of the coordinates snap to the rect's edges and corners so parallel and touching cases are common.
      if (u < 0.33) return [0, 10, 5, -0.0, 10.000000000001][Math.floor(rand() * 5)] as number;
      return rand() * 30 - 10;
    };
    const r = { x: 0, y: 0, width: 10, height: 10 };
    let mismatches = 0;
    for (let i = 0; i < 200_000; i++) {
      const x1 = pick();
      const y1 = pick();
      const x2 = rand() < 0.05 ? x1 : pick();
      const y2 = rand() < 0.05 ? y1 : pick();
      if (lineVsRect(x1, y1, x2, y2, r) !== lineVsRectReference(x1, y1, x2, y2, r)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('agrees on hand-picked edge cases', () => {
    const r = { x: 0, y: 0, width: 10, height: 10 };
    const cases: [number, number, number, number][] = [
      [0, -5, 0, 15],
      [10, -5, 10, 15],
      [-5, 0, 15, 0],
      [-5, 10, 15, 10],
      [5, 5, 5, 5],
      [-1, -1, -1, -1],
      [-5, -5, 0, 0],
      [10, 10, 20, 20],
      [-5, 5, -1, 5],
      [3, 3, 7, 7],
      [-5, -5, 15, 15],
      [0, 0, 1e-13, 1e-13],
    ];
    for (const [x1, y1, x2, y2] of cases) {
      expect(lineVsRect(x1, y1, x2, y2, r)).toBe(lineVsRectReference(x1, y1, x2, y2, r));
    }
  });
});

describe('lineVsRect non-finite inputs match the previous body (#118)', () => {
  it('treats NaN and infinite coordinates exactly as before', () => {
    const r = { x: 0, y: 0, width: 10, height: 10 };
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 5, 10, -3];
    let checked = 0;
    for (const x1 of values) {
      for (const y1 of values) {
        for (const x2 of values) {
          for (const y2 of [5, Number.NaN]) {
            // Reference inlined from the previous body.
            const dx = x2 - x1;
            const dy = y2 - y1;
            let tMin = 0;
            let tMax = 1;
            let ref = true;
            for (const [p, q] of [
              [-dx, x1 - r.x],
              [dx, r.x + r.width - x1],
              [-dy, y1 - r.y],
              [dy, r.y + r.height - y1],
            ] as const) {
              if (Math.abs(p) < 1e-12) {
                if (q < 0) {
                  ref = false;
                  break;
                }
              } else {
                const t = q / p;
                if (p < 0) {
                  if (t > tMax) {
                    ref = false;
                    break;
                  }
                  if (t > tMin) tMin = t;
                } else {
                  if (t < tMin) {
                    ref = false;
                    break;
                  }
                  if (t < tMax) tMax = t;
                }
              }
            }
            if (ref) ref = tMin <= tMax;
            expect(lineVsRect(x1, y1, x2, y2, r)).toBe(ref);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(686);
  });
});

describe('lineVsRect with a NaN rect field matches the previous body (#118)', () => {
  it('a vertical segment against a rect with NaN x still clips the other edges, as before', () => {
    // dx = 0, so the x edges are parallel with q = x1 - NaN = NaN; the previous body skipped them
    // (NaN < 0 is false) and went on to the y edges.
    const r = { x: Number.NaN, y: 0, width: 10, height: 10 };
    expect(lineVsRect(5, -5, 5, 15, r)).toBe(true);
    expect(lineVsRect(5, 20, 5, 30, r)).toBe(false);
  });
});
