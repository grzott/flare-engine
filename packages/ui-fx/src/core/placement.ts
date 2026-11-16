/** An axis-aligned rectangle: `x` and `y` are its top-left corner. */
export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How a floating box (a tooltip bubble) is placed against its anchor. */
export interface PlacementOptions {
  /** The side of the anchor the floating box sits on. */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment along the anchor edge: `'start'` is left for top/bottom, top for left/right. */
  align: 'start' | 'center' | 'end';
  /** Gap between the anchor and the floating box. */
  offset: number;
  /** Inset of the viewport edges that flip and shift keep the floating box inside. */
  padding: number;
  /** Move to the opposite side when the requested one overflows and the opposite overflows less. */
  flip: boolean;
  /** Slide along the anchor edge to stay inside the padded viewport. */
  shift: boolean;
  /** Closest the arrow centre may come to either end of the floating box's edge. */
  arrow: number;
}

/** Where the floating box goes. `x` and `y` are its top-left, in the anchor's coordinate space. */
export interface Placement {
  x: number;
  y: number;
  /** The side actually used, which differs from the requested one after a flip. */
  side: PlacementOptions['side'];
  /**
   * Arrow centre along the edge facing the anchor, measured from the floating box's left for
   * top/bottom and from its top for left/right.
   */
  arrowOffset: number;
}

/**
 * Place a `floatingW` × `floatingH` box against `anchor` inside `viewport`; all three share one
 * coordinate space.
 *
 * The box never moves along the side axis except to flip, so with both sides overflowing it
 * stays on the one that overflows less (the requested one on a tie). Shift only slides it along
 * the anchor edge; a box larger than the padded viewport pins to the left or top bound. The arrow
 * points at the anchor centre, clamped into `[arrow, size − arrow]`, and sits mid-edge when the
 * edge is shorter than two insets.
 */
export function placeFloatingInto(
  anchor: RectLike,
  floatingW: number,
  floatingH: number,
  viewport: RectLike,
  o: PlacementOptions,
  out: Placement,
): Placement {
  const vertical = o.side === 'top' || o.side === 'bottom';

  // "main" runs through the anchor and the floating box; "cross" runs along the anchor edge.
  const anchorMain = vertical ? anchor.y : anchor.x;
  const anchorMainSize = vertical ? anchor.height : anchor.width;
  const anchorCross = vertical ? anchor.x : anchor.y;
  const anchorCrossSize = vertical ? anchor.width : anchor.height;
  const mainSize = vertical ? floatingH : floatingW;
  const crossSize = vertical ? floatingW : floatingH;
  const mainMin = (vertical ? viewport.y : viewport.x) + o.padding;
  const mainMax =
    (vertical ? viewport.y + viewport.height : viewport.x + viewport.width) - o.padding;
  const crossMin = (vertical ? viewport.x : viewport.y) + o.padding;
  const crossMax =
    (vertical ? viewport.x + viewport.width : viewport.y + viewport.height) - o.padding;

  const before = anchorMain - o.offset - mainSize;
  const after = anchorMain + anchorMainSize + o.offset;
  let useBefore = o.side === 'top' || o.side === 'left';
  if (o.flip) {
    const overflowBefore = mainMin - before;
    const overflowAfter = after + mainSize - mainMax;
    if (useBefore) {
      if (overflowBefore > 0 && overflowAfter < overflowBefore) useBefore = false;
    } else if (overflowAfter > 0 && overflowBefore < overflowAfter) {
      useBefore = true;
    }
  }
  const main = useBefore ? before : after;

  let cross = anchorCross;
  if (o.align === 'center') cross += (anchorCrossSize - crossSize) / 2;
  else if (o.align === 'end') cross += anchorCrossSize - crossSize;
  if (o.shift) cross = Math.max(crossMin, Math.min(cross, crossMax - crossSize));

  const arrowMax = crossSize - o.arrow;
  out.arrowOffset =
    arrowMax < o.arrow
      ? crossSize / 2
      : Math.max(o.arrow, Math.min(anchorCross + anchorCrossSize / 2 - cross, arrowMax));

  if (vertical) {
    out.x = cross;
    out.y = main;
    out.side = useBefore ? 'top' : 'bottom';
  } else {
    out.x = main;
    out.y = cross;
    out.side = useBefore ? 'left' : 'right';
  }
  return out;
}
