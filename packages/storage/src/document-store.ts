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
   * Load from adapter. On first run (or corrupt data) calls parse(undefined)
   * then onFirstRun, persists the result, and returns it. On subsequent loads
   * migrates the stored data forward then calls parse on the result.
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

  function tryParseEnvelope(raw: string): unknown {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isDocEnvelope(parsed)) return undefined;
      return runMigrations(parsed.data, parsed.version, version, migrations);
    } catch {
      return undefined;
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
      const migrated = tryParseEnvelope(raw);
      if (migrated === undefined) {
        let doc = parse(undefined);
        if (onFirstRun) doc = onFirstRun(doc);
        await persistRaw(doc);
        cached = doc;
        return doc;
      }
      const doc = parse(migrated);
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
      const migrated = tryParseEnvelope(json);
      const doc = parse(migrated === undefined ? undefined : migrated);
      cached = doc;
      await persistRaw(doc);
      return doc;
    },
  };
}
