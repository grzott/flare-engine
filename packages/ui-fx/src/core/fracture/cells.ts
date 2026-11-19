/**
 * The grid of `cell`-pixel cells covering a `widthPx` by `heightPx` element. When that is more
 * than `maxFragments` cells, the cell grows a pixel at a time until the grid fits; the returned
 * `cell` is the size used. A partial cell at the right or bottom counts as a whole column or row.
 *
 * Throws a `RangeError` for a size or cell that is not positive and finite, or a `maxFragments`
 * that is not an integer of at least 1.
 */
export function cellGridFor(
  widthPx: number,
  heightPx: number,
  cell: number,
  maxFragments: number,
): { cols: number; rows: number; cell: number } {
  if (!(widthPx > 0 && heightPx > 0 && Number.isFinite(widthPx) && Number.isFinite(heightPx))) {
    throw new RangeError(
      `cellGridFor: size must be positive and finite, got ${widthPx} x ${heightPx}`,
    );
  }
  if (!(cell > 0) || !Number.isFinite(cell)) {
    throw new RangeError(`cellGridFor: cell must be positive and finite, got ${cell}`);
  }
  if (!Number.isInteger(maxFragments) || maxFragments < 1) {
    throw new RangeError(`cellGridFor: maxFragments must be an integer >= 1, got ${maxFragments}`);
  }
  let size = cell;
  let cols = Math.ceil(widthPx / size);
  let rows = Math.ceil(heightPx / size);
  while (cols * rows > maxFragments) {
    size += 1;
    cols = Math.ceil(widthPx / size);
    rows = Math.ceil(heightPx / size);
  }
  return { cols, rows, cell: size };
}
