import type { StorageAdapter } from './adapter.js';
import type { Migration } from './migrations.js';
import { runMigrations } from './migrations.js';

const VERSION_KEY = '__flare_doc_version';

export interface DocumentStoreOptions<T> {
  adapter: StorageAdapter;
  /** Storage key under which the document is persisted. */
  key: string;
  /** Current schema version. Positive integer. */
  version: number;
  /** Forward-only migrations, same contract as createStorage. */
  migrations?: readonly Migration[];
  /**
   * Lenient parser called after migration. Expected to return a valid T for any
   * input, including undefined (first-run / corrupt-data fallback). Must never
   * throw — use san.* combinators or a manual fallback.
   */
  parse: (raw: unknown) => T;
  /**
   * Called on first run (key absent in adapter) with the initial parsed doc.
   * Return value is saved and returned by load(). Useful for seeding
   * platform-detected defaults (locale, reduced-motion, etc.).
   */
  onFirstRun?: (doc: T) => T;
}

export interface DocumentStore<T> {
  /**
   * Load from adapter. On first run, or when the stored data is unparseable
   * JSON or not a valid envelope, calls parse(undefined) then onFirstRun,
   * persists the result, and returns it. On subsequent loads migrates the
   * stored data forward then calls parse on the result. If migration fails
   * (the stored version is newer than this store's, or a migration throws),
   * returns parse(undefined) (then onFirstRun) for this call only and does
   * **not** persist — the stored document is left untouched so a build that
   * can read it recovers the original data. `load()` never throws.
   */
  load(): Promise<T>;
  /**
   * Return the in-memory cached doc. Throws if load() has not been called yet.
   */
  get(): T;
  /** Persist doc to the adapter and update the in-memory cache. */
  save(doc: T): Promise<void>;
  /** Serialize the current in-memory doc as a self-contained JSON string. */
  exportJSON(): string;
  /**
   * Replace in-memory doc and adapter contents from a previously exported
   * JSON string. Returns the parsed doc after import.
   */
  importJSON(json: string): Promise<T>;
}

interface DocEnvelope {
  version: number;
  data: unknown;
}

function isDocEnvelope(x: unknown): x is DocEnvelope {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as DocEnvelope).version === 'number' &&
    'data' in (x as Record<string, unknown>)
  );
}

const UNLOADED = Symbol('unloaded');

export function createDocumentStore<T>(options: DocumentStoreOptions<T>): DocumentStore<T> {
  const { adapter, key, version, migrations = [], parse, onFirstRun } = options;
  if (!Number.isInteger(version) || version < 1)
    throw new Error('[@flare-engine/storage] DocumentStore version must be a positive integer');

  let cached: T | typeof UNLOADED = UNLOADED;

  function makeEnvelope(doc: T): string {
    const envelope: DocEnvelope = { version, data: doc };
    return JSON.stringify(envelope);
  }

  async function persistRaw(doc: T): Promise<void> {
    await adapter.set(key, makeEnvelope(doc));
    await adapter.set(VERSION_KEY, String(version));
  }

  // 'malformed': raw was never a valid envelope (bad JSON, or wrong shape) —
  // safe to overwrite with defaults, same as first-run.
  // 'unmigratable': raw WAS a valid envelope but runMigrations threw (stored
  // version newer than this store's, or a consumer migration threw). The
  // document was readable; load() must not destroy it (F059).
  type EnvelopeResult =
    | { readonly kind: 'malformed' }
    | { readonly kind: 'unmigratable' }
    | { readonly kind: 'ok'; readonly data: unknown };

  function tryParseEnvelope(raw: string): EnvelopeResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: 'malformed' };
    }
    if (!isDocEnvelope(parsed)) return { kind: 'malformed' };
    try {
      return { kind: 'ok', data: runMigrations(parsed.data, parsed.version, version, migrations) };
    } catch {
      return { kind: 'unmigratable' };
    }
  }

  return {
    async load() {
      const raw = await adapter.get(key);
      if (raw === null) {
        let doc = parse(undefined);
        if (onFirstRun) doc = onFirstRun(doc);
        await persistRaw(doc);
        cached = doc;
        return doc;
      }
      const result = tryParseEnvelope(raw);
      if (result.kind === 'ok') {
        const doc = parse(result.data);
        cached = doc;
        return doc;
      }
      let doc = parse(undefined);
      if (onFirstRun) doc = onFirstRun(doc);
      // Never persist over a document we could not migrate — only over one
      // that was never a valid envelope to begin with.
      if (result.kind === 'malformed') {
        await persistRaw(doc);
      }
      cached = doc;
      return doc;
    },

    get() {
      if (cached === UNLOADED)
        throw new Error('[@flare-engine/storage] DocumentStore.get() called before load()');
      return cached;
    },

    async save(doc) {
      cached = doc;
      await persistRaw(doc);
    },

    exportJSON() {
      if (cached === UNLOADED)
        throw new Error('[@flare-engine/storage] DocumentStore.exportJSON() called before load()');
      return makeEnvelope(cached);
    },

    async importJSON(json) {
      // Unlike load(), an explicit import always persists its result (even a
      // parse(undefined) fallback) — the caller supplied this payload directly
      // and expects it to replace whatever was stored, not to be silently
      // preserved. F059 scopes the never-persist-over-unreadable-data rule to
      // the passive load() path.
      const result = tryParseEnvelope(json);
      const doc = parse(result.kind === 'ok' ? result.data : undefined);
      cached = doc;
      await persistRaw(doc);
      return doc;
    },
  };
}
