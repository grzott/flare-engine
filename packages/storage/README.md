# @flare-engine/storage

Typed, versioned key/value persistence for save games and app settings. Adapters: MMKV on native (sync, sub-millisecond), IndexedDB on web, in-memory for tests. Tiny Zod-ish schema validator (`s.string()`, `s.object()`, …) with `Infer<S>` type extraction. Forward-only `Migration[]` chain validated by `defineMigrationChain` — gaps throw at startup, not in production. Single-document versioned store (`createDocumentStore`) for settings-style docs. Lenient field-drop sanitizers (`san.*`) for migrating real persisted data.

## Install

```sh
bun add @flare-engine/storage
```

## Usage

```ts
import { createStorage, createMemoryAdapter, s, defineMigrationChain } from '@flare-engine/storage';

const SaveSchema = s.object({
  version: s.literal(2),
  zone: s.number(),
  inventory: s.array(s.string()),
});

const migrations = defineMigrationChain([
  {
    from: 1,
    to: 2,
    // Lift a v1 { zone, items } save into the v2 shape, preserving the player's data.
    migrate: (old: unknown) => {
      const v1 = old as { zone?: number; items?: string[] };
      return { version: 2, zone: v1.zone ?? 0, inventory: v1.items ?? [] };
    },
  },
]);

const storage = createStorage({
  adapter: createMemoryAdapter(), // in-memory: tests/SSR; swap for MMKV on native (below)
  schema: SaveSchema,
  version: 2,
  migrations,
});

await storage.saveSlot('slot1', { version: 2, zone: 4, inventory: ['key'] });
const data = await storage.loadSlot('slot1');
```

On native, swap in the persistent MMKV adapter. `react-native-mmkv` is a **structural** peer — you construct `MMKV` and pass it in; this package takes no dependency on it (`createMmkvAdapter` accepts the exported `MMKVLike` subset):

```ts no-check
import { MMKV } from 'react-native-mmkv';
import { createStorage, createMmkvAdapter } from '@flare-engine/storage';

const storage = createStorage({
  adapter: createMmkvAdapter(new MMKV()),
  schema: SaveSchema,
  version: 2,
  migrations,
});
```

Single-document store with lenient parser for a settings doc:

```ts
import { createDocumentStore, createMemoryAdapter, san } from '@flare-engine/storage';

interface Settings { locale: string; volume: number; }

function parseSettings(raw: unknown): Settings {
  return san.object({ locale: san.string('en'), volume: san.clamped(1, 0, 1) })(raw);
}

const store = createDocumentStore<Settings>({
  adapter: createMemoryAdapter(),
  key: 'myapp:settings',
  version: 1,
  parse: parseSettings,
  onFirstRun: (doc) => ({ ...doc, locale: 'en' }),
});

const settings = await store.load();
await store.save({ ...settings, volume: 0.8 });
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginestorage--4kb-gzip).

## License

MIT
