import type { StorageAdapter } from './adapter.js';
import { runMigrations } from './migrations.js';
import type { Migration } from './migrations.js';
import type { Schema } from './schema.js';

const VERSION_KEY = '__flare_version';
const SLOT_PREFIX = 'slot:';

export interface StorageOptions<T> {
  adapter: StorageAdapter;
  /** Schema applied to every slot on load. */
  schema: Schema<T>;
  /** Current data version. Stored data below this is lifted via `migrations`. */
  version: number;
  /** Forward-only migrations from one version to the next. */
  migrations?: readonly Migration[];
}

/**
 * Typed, versioned key/value storage with named save slots and JSON
 * import/export. Values of type `T` are persisted as JSON strings under
 * `slot:<name>` keys. On read, data is migrated forward to `version` and then
 * validated against the schema.
 */
export interface Storage<T> {
  /** Low-level get. Bypasses schema + migrations. Returns `null` if missing. */
  get(key: string): Promise<string | null>;
  /** Low-level set. Bypasses schema + migrations. */
  set(key: string, value: string): Promise<void>;
  /** Low-level delete. */
  delete(key: string): Promise<void>;

  /** Save data into a named slot. Schema-validated before write. */
  saveSlot(name: string, data: T): Promise<void>;
  /** Load a slot. Runs migrations then schema validation. `null` if missing. */
  loadSlot(name: string): Promise<T | null>;
  /** Delete a slot by name. */
  deleteSlot(name: string): Promise<void>;
  /** Names of all slots currently stored. */
  listSlots(): Promise<string[]>;

  /** Serialize every stored key/value (including version + slots) to JSON. */
  exportJSON(): Promise<string>;
  /** Clear storage and restore from a previously exported JSON payload. */
  importJSON(json: string): Promise<void>;
}

interface SlotEnvelope {
  version: number;
  data: unknown;
}

function isSlotEnvelope(x: unknown): x is SlotEnvelope {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as SlotEnvelope).version === 'number' &&
    'data' in (x as Record<string, unknown>)
  );
}

export function createStorage<T>(options: StorageOptions<T>): Storage<T> {
  const { adapter, schema, version, migrations = [] } = options;
  if (!Number.isInteger(version) || version < 1)
    throw new Error('[@flare-engine/storage] version must be a positive integer');

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

    async saveSlot(name, data) {
      schema.parse(data);
      const envelope: SlotEnvelope = { version, data };
      await adapter.set(SLOT_PREFIX + name, JSON.stringify(envelope));
      await adapter.set(VERSION_KEY, String(version));
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
