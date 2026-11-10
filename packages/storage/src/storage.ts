import type { StorageAdapter } from './adapter.js';
import type { Migration } from './migrations.js';
import { runMigrations } from './migrations.js';
import type { Sanitizer } from './sanitize.js';
import type { Schema } from './schema.js';

const SLOT_PREFIX = 'slot:';

export interface StorageOptions<T, H = unknown> {
  adapter: StorageAdapter;
  /** Schema applied to every slot on load. */
  schema: Schema<T>;
  /** Current data version. Stored data below this is lifted via `migrations`. */
  version: number;
  /** Forward-only migrations from one version to the next. */
  migrations?: readonly Migration[];
  /**
   * Lenient, caller-owned parser for slot headers, like `createDocumentStore`'s
   * `parse`: expected to return a valid `H` for any input (e.g. a
   * `san.object(...)`), which is how a header written in an older shape is
   * repaired. Runs only in `listSlotHeaders`; `saveSlot` stores the header as
   * given. Without it, `listSlotHeaders` returns headers as stored.
   */
  parseHeader?: Sanitizer<H>;
}

/** One entry of `Storage.listSlotHeaders`. */
export interface SlotHeader<H> {
  name: string;
  /** Stored envelope version, or `null` when the slot is not a valid envelope. */
  version: number | null;
  /** The header as listed, or `null` when absent, unreadable or rejected by `parseHeader`. */
  header: H | null;
}

/**
 * Typed, versioned key/value storage with named save slots and JSON
 * import/export. Values of type `T` are persisted as JSON strings under
 * `slot:<name>` keys. On read, data is migrated forward to `version` and then
 * validated against the schema. An optional header of type `H` is stored
 * beside each slot's data for listing without a load.
 */
export interface Storage<T, H = unknown> {
  /** Low-level get. Bypasses schema + migrations. Returns `null` if missing. */
  get(key: string): Promise<string | null>;
  /** Low-level set. Bypasses schema + migrations. */
  set(key: string, value: string): Promise<void>;
  /** Low-level delete. */
  delete(key: string): Promise<void>;

  /**
   * Save data into a named slot. Schema-validated before write. The optional
   * `header` is stored in the envelope beside `data` for `listSlotHeaders`; it
   * must be JSON-serialisable, and one that is not (a BigInt, a cycle) rejects
   * before anything is written. Saving without a header drops the slot's
   * previous header.
   */
  saveSlot(name: string, data: T, header?: H): Promise<void>;
  /** Load a slot. Runs migrations then schema validation. `null` if missing. */
  loadSlot(name: string): Promise<T | null>;
  /** Delete a slot by name. */
  deleteSlot(name: string): Promise<void>;
  /** Names of all slots currently stored. */
  listSlots(): Promise<string[]>;
  /**
   * Headers of every stored slot, in `listSlots` order, without loading them.
   * Each slot's full string is still read and JSON-parsed; only migrations and
   * the schema are skipped. A slot that cannot be read or is not a valid
   * envelope lists as `{ version: null, header: null }`, one saved without a
   * header as `header: null`, and one whose header makes `parseHeader` throw as
   * `header: null` with its version — a bad slot never fails the others. It
   * never throws for slot contents, but rejects when `adapter.keys()` does.
   *
   * Headers are not migrated: a consumer that changes its header shape reads
   * old headers as they were written, unless `parseHeader` repairs them.
   */
  listSlotHeaders(): Promise<SlotHeader<H>[]>;

  /** Serialize every stored key/value (including version + slots) to JSON. */
  exportJSON(): Promise<string>;
  /** Clear storage and restore from a previously exported JSON payload. */
  importJSON(json: string): Promise<void>;
}

interface SlotEnvelope {
  version: number;
  data: unknown;
  header?: unknown;
}

function isSlotEnvelope(x: unknown): x is SlotEnvelope {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as SlotEnvelope).version === 'number' &&
    'data' in (x as Record<string, unknown>)
  );
}

export function createStorage<T, H = unknown>(options: StorageOptions<T, H>): Storage<T, H> {
  const { adapter, schema, version, migrations = [], parseHeader } = options;
  if (!Number.isInteger(version) || version < 1)
    throw new Error('[@flare-engine/storage] version must be a positive integer');

  function readHeader(name: string, raw: string | null): SlotHeader<H> {
    if (raw === null) return { name, version: null, header: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { name, version: null, header: null };
    }
    if (!isSlotEnvelope(parsed)) return { name, version: null, header: null };
    if (!('header' in parsed)) return { name, version: parsed.version, header: null };
    if (parseHeader === undefined)
      return { name, version: parsed.version, header: parsed.header as H };
    try {
      return { name, version: parsed.version, header: parseHeader(parsed.header) };
    } catch {
      return { name, version: parsed.version, header: null };
    }
  }

  return {
    get(key) {
      return adapter.get(key);
    },
    set(key, value) {
      return adapter.set(key, value);
    },
    delete(key) {
      return adapter.delete(key);
    },

    async saveSlot(name, data, header) {
      schema.parse(data);
      // The key is omitted, not set to undefined, so a header-less save writes
      // the same string as before headers existed.
      const envelope: SlotEnvelope =
        header === undefined ? { version, data } : { version, data, header };
      const json = JSON.stringify(envelope);
      await adapter.set(SLOT_PREFIX + name, json);
    },

    async loadSlot(name) {
      const raw = await adapter.get(SLOT_PREFIX + name);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isSlotEnvelope(parsed))
        throw new Error(`[@flare-engine/storage] slot "${name}" is not a valid envelope`);
      const migrated = runMigrations(parsed.data, parsed.version, version, migrations);
      return schema.parse(migrated);
    },

    async deleteSlot(name) {
      await adapter.delete(SLOT_PREFIX + name);
    },

    async listSlots() {
      const keys = await adapter.keys();
      const out: string[] = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        if (k.startsWith(SLOT_PREFIX)) out.push(k.slice(SLOT_PREFIX.length));
      }
      return out;
    },

    async listSlotHeaders() {
      const keys = await adapter.keys();
      const out: SlotHeader<H>[] = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        if (!k.startsWith(SLOT_PREFIX)) continue;
        let raw: string | null;
        try {
          raw = await adapter.get(k);
        } catch {
          raw = null;
        }
        out.push(readHeader(k.slice(SLOT_PREFIX.length), raw));
      }
      return out;
    },

    async exportJSON() {
      const keys = await adapter.keys();
      const out: Record<string, string> = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        const v = await adapter.get(k);
        if (v !== null) out[k] = v;
      }
      return JSON.stringify({ version, entries: out });
    },

    async importJSON(json) {
      const parsed: unknown = JSON.parse(json);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        typeof (parsed as { version?: unknown }).version !== 'number' ||
        typeof (parsed as { entries?: unknown }).entries !== 'object' ||
        (parsed as { entries: unknown }).entries === null
      ) {
        throw new Error('[@flare-engine/storage] invalid import payload');
      }
      const entries = (parsed as { entries: Record<string, unknown> }).entries;
      for (const [k, v] of Object.entries(entries)) {
        if (typeof v !== 'string')
          throw new Error(`[@flare-engine/storage] import entry "${k}" is not a string`);
      }
      await adapter.clear();
      for (const [k, v] of Object.entries(entries)) {
        await adapter.set(k, v as string);
      }
    },
  };
}
