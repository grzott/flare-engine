const TOKEN = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
const SEPARATORS = /^[\s,]*$/;

// Coordinates each command takes per repetition, by upper-case letter.
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

function pushLine(out: number[], x0: number, y0: number, x1: number, y1: number): void {
  out.push(
    x0,
    y0,
    x0 + (x1 - x0) / 3,
    y0 + (y1 - y0) / 3,
    x0 + ((x1 - x0) * 2) / 3,
    y0 + ((y1 - y0) * 2) / 3,
    x1,
    y1,
  );
}

/**
 * SVG path data as cubic segments, 8 numbers each (p0, c1, c2, p3). Reads `M`, `L`, `H`, `V`,
 * `C`, `Q` and `Z`, absolute and relative, with the usual implicit repeats. Lines become cubics
 * with their handles at the thirds, quadratics are raised to the equivalent cubic, and `Z` adds
 * the closing line when the subpath is not already closed. A second `M` starts its segments at
 * the new point without joining them to the previous subpath.
 *
 * Throws a `RangeError` for data that does not start with a moveto, a command outside that set
 * (`S`, `T` and `A` included), a coordinate count that does not fit its command, or anything that
 * is neither a command nor a number.
 */
export function parseSvgPath(d: string): number[] {
  const out: number[] = [];
  const args: number[] = [];
  let command = '';
  let end = 0;
  // Current point and the start of the current subpath.
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const flush = (): void => {
    if (command === '') {
      if (args.length > 0) throw new RangeError('parseSvgPath: path data must start with M or m');
      return;
    }
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const arity = ARITY[upper]!;
    if (arity === 0) {
      if (args.length > 0) {
        throw new RangeError(`parseSvgPath: "${command}" takes no coordinates`);
      }
      if (x !== startX || y !== startY) pushLine(out, x, y, startX, startY);
      x = startX;
      y = startY;
      return;
    }
    if (args.length === 0 || args.length % arity !== 0) {
      throw new RangeError(
        `parseSvgPath: "${command}" takes coordinates in groups of ${arity}, got ${args.length}`,
      );
    }
    for (let i = 0; i < args.length; i += arity) {
      const ox = relative ? x : 0;
      const oy = relative ? y : 0;
      if (upper === 'M' && i === 0) {
        x = ox + args[i]!;
        y = oy + args[i + 1]!;
        startX = x;
        startY = y;
      } else if (upper === 'M' || upper === 'L') {
        // Pairs after the first of a moveto are implicit linetos.
        const nx = ox + args[i]!;
        const ny = oy + args[i + 1]!;
        pushLine(out, x, y, nx, ny);
        x = nx;
        y = ny;
      } else if (upper === 'H') {
        const nx = ox + args[i]!;
        pushLine(out, x, y, nx, y);
        x = nx;
      } else if (upper === 'V') {
        const ny = oy + args[i]!;
        pushLine(out, x, y, x, ny);
        y = ny;
      } else if (upper === 'C') {
        const nx = ox + args[i + 4]!;
        const ny = oy + args[i + 5]!;
        out.push(
          x,
          y,
          ox + args[i]!,
          oy + args[i + 1]!,
          ox + args[i + 2]!,
          oy + args[i + 3]!,
          nx,
          ny,
        );
        x = nx;
        y = ny;
      } else {
        const qx = ox + args[i]!;
        const qy = oy + args[i + 1]!;
        const nx = ox + args[i + 2]!;
        const ny = oy + args[i + 3]!;
        out.push(
          x,
          y,
          x + ((qx - x) * 2) / 3,
          y + ((qy - y) * 2) / 3,
          nx + ((qx - nx) * 2) / 3,
          ny + ((qy - ny) * 2) / 3,
          nx,
          ny,
        );
        x = nx;
        y = ny;
      }
    }
  };

  const expectSeparators = (from: number, to: number): void => {
    const between = d.slice(from, to);
    if (!SEPARATORS.test(between)) {
      throw new RangeError(`parseSvgPath: cannot read "${between.trim()}" at offset ${from}`);
    }
  };

  for (const match of d.matchAll(TOKEN)) {
    expectSeparators(end, match.index);
    end = match.index + match[0].length;
    const letter = match[1];
    if (letter === undefined) {
      args.push(Number(match[0]));
      continue;
    }
    flush();
    args.length = 0;
    if (!Object.hasOwn(ARITY, letter.toUpperCase())) {
      throw new RangeError(`parseSvgPath: unsupported command "${letter}"`);
    }
    if (command === '' && letter !== 'M' && letter !== 'm') {
      throw new RangeError('parseSvgPath: path data must start with M or m');
    }
    command = letter;
  }
  expectSeparators(end, d.length);
  flush();
  return out;
}
