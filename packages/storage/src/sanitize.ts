/**
 * Lenient field-drop validators for migrating real persisted data.
 *
 * Unlike the `s.*` schema (which throws on invalid input), `san.*` combinators
 * accept unknown input and return the best valid value — either the sanitized
 * input or a caller-supplied fallback. This matches the field-drop pattern used
 * when parsing real save files that may contain legacy, partial, or corrupt data.
 */

/** A lenient parser: accepts any input, always returns T. Never throws. */
export type Sanitizer<T> = (input: unknown) => T;

/** Namespace of sanitizer combinators. */
export const san = {
  /** Returns input if it is a string, else returns `fallback`. */
  string(fallback: string): Sanitizer<string> {
    return (input) => (typeof input === 'string' ? input : fallback);
  },

  /** Returns input if it is a finite number, else returns `fallback`. */
  number(fallback: number): Sanitizer<number> {
    return (input) => (typeof input === 'number' && Number.isFinite(input) ? input : fallback);
  },

  /** Returns input if it is a boolean, else returns `fallback`. */
  boolean(fallback: boolean): Sanitizer<boolean> {
    return (input) => (typeof input === 'boolean' ? input : fallback);
  },

  /**
   * Returns input if it is strictly equal to one of `options`, else returns
   * `fallback`. `fallback` must be one of `options`.
   */
  literal<L extends string | number | boolean>(options: readonly L[], fallback: L): Sanitizer<L> {
    return (input) => (options.includes(input as L) ? (input as L) : fallback);
  },

  /**
   * Build a Sanitizer for a plain object shape. Each field's sanitizer is
   * applied independently; fields not present in `shape` are dropped. If
   * `input` is not a plain object, every field falls back to its default.
   */
  object<Shape extends Record<string, Sanitizer<unknown>>>(
    shape: Shape,
  ): Sanitizer<{ [K in keyof Shape]: ReturnType<Shape[K]> }> {
    const keys = Object.keys(shape) as (keyof Shape & string)[];
    return (input) => {
      const record: Record<string, unknown> =
        input !== null && typeof input === 'object' && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : {};
      const out: Record<string, unknown> = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        out[k] = shape[k]!(record[k]);
      }
      return out as { [K in keyof Shape]: ReturnType<Shape[K]> };
    };
  },

  /**
   * Apply `item` to every element of an input array. Non-array input returns
   * `[]`. All elements are transformed — none are dropped.
   */
  array<T>(item: Sanitizer<T>): Sanitizer<T[]> {
    return (input) => {
      if (!Array.isArray(input)) return [];
      const out: T[] = [];
      for (let i = 0; i < input.length; i++) {
        out.push(item(input[i]));
      }
      return out;
    };
  },

  /**
   * Filter an array by a type guard, dropping elements that fail the guard.
   * Non-array input returns `[]`. This is the drop-invalid pattern used when
   * deserializing sets of ids, enum values, or validated strings.
   */
  arrayOf<T>(guard: (v: unknown) => v is T): Sanitizer<T[]> {
    return (input) => {
      if (!Array.isArray(input)) return [];
      const out: T[] = [];
      for (let i = 0; i < input.length; i++) {
        if (guard(input[i])) out.push(input[i] as T);
      }
      return out;
    };
  },

  /**
   * Clamp a number to `[min, max]`. Non-number / non-finite input returns
   * `fallback`. Applied as a standalone sanitizer or composed via `pipe`.
   */
  clamped(fallback: number, min: number, max: number): Sanitizer<number> {
    return (input) => {
      if (typeof input !== 'number' || !Number.isFinite(input)) return fallback;
      return input < min ? min : input > max ? max : input;
    };
  },

  /**
   * Chain a sanitizer with a transform. Useful for post-process steps like
   * Math.floor, deduplication, or forcing a minimum value.
   */
  pipe<A, B>(sanitizer: Sanitizer<A>, transform: (v: A) => B): Sanitizer<B> {
    return (input) => transform(sanitizer(input));
  },
} as const;
