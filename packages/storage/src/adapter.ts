/**
 * Backend-agnostic async key/value storage contract.
 *
 * All values are serialized to strings by the caller (`Storage` in `storage.ts`)
 * so adapters only deal with `string` payloads. Keeping the contract async
 * lets us unify sync backends (MMKV) and async backends (IndexedDB).
 */
export interface StorageAdapter {
  /** Read a value. Resolves to `null` if the key is not present. */
  get(key: string): Promise<string | null>;
  /** Write a value. */
  set(key: string, value: string): Promise<void>;
  /** Delete a key. No-op if the key is not present. */
  delete(key: string): Promise<void>;
  /** List all keys currently stored. */
  keys(): Promise<string[]>;
  /** Remove every key. */
  clear(): Promise<void>;
}
