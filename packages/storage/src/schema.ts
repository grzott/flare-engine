/**
 * Tiny Zod-ish runtime schema for save data. Keeps the surface small:
 * primitives, object, array, optional, literal, union. Enough for typed
 * save games without pulling in a full validator.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Schema<T> {
  /** Throw on invalid input. */
  parse(input: unknown): T;
  /** Non-throwing parse. */
  safeParse(input: unknown): ParseResult<T>;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

function makeSchema<T>(check: (input: unknown) => ParseResult<T>): Schema<T> {
  return {
    parse(input) {
      const r = check(input);
      if (!r.ok) throw new Error(`[@flare-engine/storage] schema: ${r.error}`);
      return r.value;
    },
    safeParse(input) {
      return check(input);
    },
  };
}

function err(path: string, msg: string): ParseResult<never> {
  return { ok: false, error: path === '' ? msg : `${path}: ${msg}` };
}

function checkString(input: unknown, path: string): ParseResult<string> {
  if (typeof input !== 'string') return err(path, `expected string, got ${typeof input}`);
  return { ok: true, value: input };
}

function checkNumber(input: unknown, path: string): ParseResult<number> {
  if (typeof input !== 'number' || Number.isNaN(input))
    return err(path, `expected number, got ${typeof input}`);
  return { ok: true, value: input };
}

function checkBoolean(input: unknown, path: string): ParseResult<boolean> {
  if (typeof input !== 'boolean') return err(path, `expected boolean, got ${typeof input}`);
  return { ok: true, value: input };
}

interface InternalSchema<T> extends Schema<T> {
  _check: (input: unknown, path: string) => ParseResult<T>;
}

function wrap<T>(check: (input: unknown, path: string) => ParseResult<T>): InternalSchema<T> {
  const s = makeSchema<T>((input) => check(input, '')) as InternalSchema<T>;
  s._check = check;
  return s;
}

export const s = {
  string(): Schema<string> {
    return wrap(checkString);
  },
  number(): Schema<number> {
    return wrap(checkNumber);
  },
  boolean(): Schema<boolean> {
    return wrap(checkBoolean);
  },
  literal<L extends string | number | boolean>(value: L): Schema<L> {
    return wrap((input, path) => {
      if (input !== value) return err(path, `expected literal ${String(value)}`);
      return { ok: true, value: value };
    });
  },
  optional<T>(inner: Schema<T>): Schema<T | undefined> {
    const ic = (inner as InternalSchema<T>)._check;
    return wrap<T | undefined>((input, path) => {
      if (input === undefined) return { ok: true, value: undefined };
      return ic(input, path);
    });
  },
  array<T>(item: Schema<T>): Schema<T[]> {
    const ic = (item as InternalSchema<T>)._check;
    return wrap((input, path) => {
      if (!Array.isArray(input)) return err(path, `expected array, got ${typeof input}`);
      const out: T[] = [];
      for (let i = 0; i < input.length; i++) {
        const r = ic(input[i], `${path}[${i}]`);
        if (!r.ok) return r;
        out.push(r.value);
      }
      return { ok: true, value: out };
    });
  },
  object<Shape extends Record<string, Schema<unknown>>>(
    shape: Shape,
  ): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
    const entries = Object.entries(shape) as [string, InternalSchema<unknown>][];
    return wrap((input, path) => {
      if (input === null || typeof input !== 'object' || Array.isArray(input))
        return err(path, `expected object, got ${Array.isArray(input) ? 'array' : typeof input}`);
      const record = input as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (let i = 0; i < entries.length; i++) {
        const [key, child] = entries[i]!;
        const childPath = path === '' ? key : `${path}.${key}`;
        const r = child._check(record[key], childPath);
        if (!r.ok) return r;
        out[key] = r.value;
      }
      return { ok: true, value: out as { [K in keyof Shape]: Infer<Shape[K]> } };
    });
  },
  union<T extends Schema<unknown>[]>(...options: T): Schema<Infer<T[number]>> {
    const checks = options.map((o) => (o as InternalSchema<unknown>)._check);
    return wrap((input, path) => {
      for (let i = 0; i < checks.length; i++) {
        const r = checks[i]!(input, path);
        if (r.ok) return { ok: true, value: r.value as Infer<T[number]> };
      }
      return err(path, 'no union variant matched');
    });
  },
};
