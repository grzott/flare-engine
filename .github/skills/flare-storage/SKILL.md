---
name: flare-storage
description: Deep knowledge of the @flare-engine/storage package — StorageAdapter, MMKV/IndexedDB/memory adapters, schema validator (s.string, s.object, etc.), versioned migrations, save slots, JSON import/export. Use when persisting save games, settings, or any keyed data across sessions in Flare.
---

# `@flare-engine/storage`

Layer 2.5. Typed, versioned key/value persistence. Pluggable adapters keep the package free of a hard native peer dep.

## Exports

```ts
import {
  type StorageAdapter,
  createMemoryAdapter,
  createMmkvAdapter,
  createIndexedDbAdapter,
  type MMKVLike,
  s,
  type Infer,
  type Schema,
  type ParseResult,
  runMigrations,
  type Migration,
  createStorage,
  type Storage,
  type StorageOptions,
} from "@flare-engine/storage";
```

## Usage sketch

```ts
const SaveSchema = s.object({
  level: s.number(),
  hp: s.number(),
  inventory: s.array(s.string()),
});
type Save = Infer<typeof SaveSchema>;

const storage = createStorage({
  adapter: createMmkvAdapter(new MMKV()),
  schema: SaveSchema,
  version: 2,
  migrations: [
    {
      version: 2,
      migrate: (old: any) => ({ ...old, inventory: old.items ?? [] }),
    },
  ],
});
await storage.saveSlot("slot1", save);
const save = await storage.loadSlot("slot1"); // runs migrations + schema
```

## Rules

- `createMmkvAdapter` takes an `MMKVLike` the caller constructs — the package never imports `react-native-mmkv` directly.
- Migrations are forward-only, one step per version, ascending order. `runMigrations` throws on backward/duplicate/non-integer versions.
- `importJSON` clears existing keys first — don't use it for merges.

Spec: [docs/design/api-specs.md § @flare-engine/storage](../../../docs/design/api-specs.md).
