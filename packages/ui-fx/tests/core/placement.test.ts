import { describe, expect, test } from 'bun:test';
import {
  type Placement,
  type PlacementOptions,
  placeFloatingInto,
  type RectLike,
} from '../../src/core/placement';

const VIEWPORT: RectLike = { x: 0, y: 0, width: 400, height: 800 };

const options = (overrides: Partial<PlacementOptions> = {}): PlacementOptions => ({
  side: 'top',
  align: 'center',
  offset: 8,
  padding: 8,
  flip: true,
  shift: true,
  arrow: 6,
  ...overrides,
});

const blank = (): Placement => ({ x: 0, y: 0, side: 'top', arrowOffset: 0 });

describe('placeFloatingInto: sides', () => {
  const anchor: RectLike = { x: 150, y: 300, width: 100, height: 40 };

  test('top sits above the anchor by the offset', () => {
    const out = blank();
    const result = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'top' }), out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 170, y: 262, side: 'top', arrowOffset: 30 });
  });

  test('bottom sits below the anchor by the offset', () => {
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'bottom' }), blank());
    expect(out).toEqual({ x: 170, y: 348, side: 'bottom', arrowOffset: 30 });
  });

  test('left sits before the anchor, aligned on y', () => {
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'left' }), blank());
    expect(out).toEqual({ x: 82, y: 305, side: 'left', arrowOffset: 15 });
  });

  test('right sits after the anchor, aligned on y', () => {
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'right' }), blank());
    expect(out).toEqual({ x: 258, y: 305, side: 'right', arrowOffset: 15 });
  });
});

describe('placeFloatingInto: align', () => {
  const anchor: RectLike = { x: 150, y: 300, width: 100, height: 40 };

  test('start, center and end on a horizontal cross axis', () => {
    const out = blank();
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ align: 'start' }), out).x).toBe(
      150,
    );
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ align: 'center' }), out).x).toBe(
      170,
    );
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ align: 'end' }), out).x).toBe(190);
  });

  test('start, center and end on a vertical cross axis', () => {
    const out = blank();
    const right = (align: PlacementOptions['align']) => options({ side: 'right', align });
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, right('start'), out).y).toBe(300);
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, right('center'), out).y).toBe(305);
    expect(placeFloatingInto(anchor, 60, 30, VIEWPORT, right('end'), out).y).toBe(310);
  });
});

describe('placeFloatingInto: flip', () => {
  test('an anchor at y = 4 with side top flips to bottom', () => {
    const anchor: RectLike = { x: 150, y: 4, width: 100, height: 40 };
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'top' }), blank());
    expect(out.side).toBe('bottom');
    expect(out.y).toBe(52);
  });

  test('flip disabled keeps the requested side even when it overflows', () => {
    const anchor: RectLike = { x: 150, y: 4, width: 100, height: 40 };
    const o = options({ side: 'top', flip: false });
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, o, blank());
    expect(out.side).toBe('top');
    expect(out.y).toBe(-34);
  });

  test('a side that fits is kept', () => {
    const anchor: RectLike = { x: 150, y: 46, width: 100, height: 40 };
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'top' }), blank());
    expect(out.side).toBe('top');
    expect(out.y).toBe(8);
  });

  test('does not flip when the opposite side overflows more', () => {
    const viewport: RectLike = { x: 0, y: 0, width: 400, height: 100 };
    // top starts at -48, 56 past the padded bound of 8; bottom would end at 168, 76 past 92.
    const anchor: RectLike = { x: 150, y: 40, width: 100, height: 40 };
    const out = placeFloatingInto(anchor, 60, 80, viewport, options({ side: 'top' }), blank());
    expect(out.side).toBe('top');
    expect(out.y).toBe(-48);
  });

  test('left flips to right, and right to left', () => {
    const out = blank();
    const nearLeft: RectLike = { x: 10, y: 300, width: 40, height: 40 };
    placeFloatingInto(nearLeft, 60, 30, VIEWPORT, options({ side: 'left' }), out);
    expect(out.side).toBe('right');
    expect(out.x).toBe(58);

    const nearRight: RectLike = { x: 350, y: 300, width: 40, height: 40 };
    placeFloatingInto(nearRight, 60, 30, VIEWPORT, options({ side: 'right' }), out);
    expect(out.side).toBe('left');
    expect(out.x).toBe(282);
  });

  test('bottom flips to top', () => {
    const anchor: RectLike = { x: 150, y: 750, width: 100, height: 40 };
    const out = placeFloatingInto(anchor, 60, 30, VIEWPORT, options({ side: 'bottom' }), blank());
    expect(out.side).toBe('top');
    expect(out.y).toBe(712);
  });
});

describe('placeFloatingInto: shift', () => {
  test('an anchor at the right edge keeps x + w within the padded viewport', () => {
    const anchor: RectLike = { x: 380, y: 300, width: 20, height: 20 };
    const w = 120;
    const out = placeFloatingInto(anchor, w, 30, VIEWPORT, options({ padding: 8 }), blank());
    expect(out.x + w).toBeLessThanOrEqual(VIEWPORT.width - 8);
    expect(out.x).toBe(272);
  });

  test('an anchor at the left edge keeps x at the padding', () => {
    const anchor: RectLike = { x: 0, y: 300, width: 20, height: 20 };
    const out = placeFloatingInto(anchor, 120, 30, VIEWPORT, options(), blank());
    expect(out.x).toBe(8);
  });

  test('shift disabled leaves the overflow', () => {
    const anchor: RectLike = { x: 380, y: 300, width: 20, height: 20 };
    const out = placeFloatingInto(anchor, 120, 30, VIEWPORT, options({ shift: false }), blank());
    expect(out.x).toBe(330);
  });

  test('left and right sides shift on y', () => {
    const anchor: RectLike = { x: 150, y: 790, width: 100, height: 10 };
    const out = placeFloatingInto(anchor, 60, 50, VIEWPORT, options({ side: 'right' }), blank());
    expect(out.y).toBe(742);
  });

  test('a floating box wider than the padded viewport pins to its start edge', () => {
    const anchor: RectLike = { x: 190, y: 300, width: 20, height: 20 };
    const out = placeFloatingInto(anchor, 500, 30, VIEWPORT, options(), blank());
    expect(out.x).toBe(8);
  });

  test('a non-zero viewport origin moves both bounds', () => {
    const viewport: RectLike = { x: 100, y: 50, width: 200, height: 300 };
    const out = blank();
    placeFloatingInto({ x: 100, y: 200, width: 10, height: 10 }, 80, 30, viewport, options(), out);
    expect(out.x).toBe(108);
    placeFloatingInto({ x: 290, y: 200, width: 10, height: 10 }, 80, 30, viewport, options(), out);
    expect(out.x).toBe(212);
    // top would start at 22, above the padded top bound of 58, so it flips.
    placeFloatingInto({ x: 190, y: 60, width: 10, height: 10 }, 80, 30, viewport, options(), out);
    expect(out.side).toBe('bottom');
  });
});

describe('placeFloatingInto: arrow', () => {
  test('arrowOffset targets the anchor centre', () => {
    const anchor: RectLike = { x: 100, y: 300, width: 40, height: 40 };
    const o = options({ align: 'start' });
    const out = placeFloatingInto(anchor, 200, 30, VIEWPORT, o, blank());
    expect(out.x).toBe(100);
    expect(out.arrowOffset).toBe(20);
  });

  test('arrowOffset follows the anchor after a shift', () => {
    const anchor: RectLike = { x: 340, y: 300, width: 40, height: 20 };
    const out = placeFloatingInto(anchor, 120, 30, VIEWPORT, options(), blank());
    expect(out.x).toBe(272);
    expect(out.arrowOffset).toBe(88);
  });

  test('arrowOffset is clamped into [arrow, w - arrow]', () => {
    const w = 120;
    const o = options({ arrow: 10 });
    const out = blank();
    placeFloatingInto({ x: 396, y: 300, width: 4, height: 20 }, w, 30, VIEWPORT, o, out);
    expect(out.x).toBe(272);
    expect(out.arrowOffset).toBe(w - 10);

    placeFloatingInto({ x: 0, y: 300, width: 4, height: 20 }, w, 30, VIEWPORT, o, out);
    expect(out.x).toBe(8);
    expect(out.arrowOffset).toBe(10);
  });

  test('left and right sides measure arrowOffset down the floating box', () => {
    const anchor: RectLike = { x: 150, y: 300, width: 100, height: 20 };
    const o = options({ side: 'right', align: 'start' });
    const out = placeFloatingInto(anchor, 60, 100, VIEWPORT, o, blank());
    expect(out.y).toBe(300);
    expect(out.arrowOffset).toBe(10);
  });

  test('a floating box narrower than two arrow insets centres the arrow', () => {
    const anchor: RectLike = { x: 150, y: 300, width: 100, height: 20 };
    const o = options({ arrow: 20 });
    const out = placeFloatingInto(anchor, 30, 30, VIEWPORT, o, blank());
    expect(out.arrowOffset).toBe(15);
  });
});
