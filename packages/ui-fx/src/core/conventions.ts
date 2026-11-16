/** A mutable 2D point the `…Into` functions write their result to. */
export interface Vec2Out {
  x: number;
  y: number;
}

/**
 * Unit vector for a direction of travel. Angles are degrees, 0° = up, clockwise; screen y points
 * down, so 90° is +x and 180° is +y.
 */
export function directionInto(angleDeg: number, out: Vec2Out): Vec2Out {
  'worklet';
  const radians = (angleDeg * Math.PI) / 180;
  out.x = Math.sin(radians);
  out.y = -Math.cos(radians);
  return out;
}

/** An origin on an element: its centre, the press point, or 0..1 coordinates of its box. */
export type OriginSpec = 'center' | 'press' | { x: number; y: number };

/**
 * Resolve an origin to element pixels. `press` is the press point in element pixels; `'press'`
 * with a null press point resolves to the centre.
 */
export function resolveOriginInto(
  o: OriginSpec,
  w: number,
  h: number,
  press: Vec2Out | null,
  out: Vec2Out,
): Vec2Out {
  if (o === 'center' || o === 'press') {
    if (o === 'press' && press !== null) {
      out.x = press.x;
      out.y = press.y;
    } else {
      out.x = w / 2;
      out.y = h / 2;
    }
  } else {
    out.x = o.x * w;
    out.y = o.y * h;
  }
  return out;
}

/** An element edge. `'start'` and `'end'` follow the writing direction. */
export type Edge = 'left' | 'right' | 'top' | 'bottom' | 'start' | 'end';

/** Resolve a logical edge to a physical one: `'start'` is left in LTR and right in RTL. */
export function resolveEdge(e: Edge, rtl: boolean): 'left' | 'right' | 'top' | 'bottom' {
  if (e === 'start') return rtl ? 'right' : 'left';
  if (e === 'end') return rtl ? 'left' : 'right';
  return e;
}
