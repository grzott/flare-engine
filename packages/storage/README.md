# @flare-engine/storage

Typed, versioned key/value persistence for save games and app settings. Adapters: MMKV on native (sync, sub-millisecond), IndexedDB on web, in-memory for tests. Tiny Zod-ish schema validator (`s.string()`, `s.object()`, …) with `Infer<S>` type extraction. Forward-only `Migration[]` chain validated by `defineMigrationChain` — gaps throw at startup, not in production. Single-document versioned store (`createDocumentStore`) for settings-style docs. Lenient field-drop sanitizers (`san.*`) for migrating real persisted data.

## Install

```sh
bun add @flare-engine/storage
```

Peer deps (only for native): `react-native-mmkv`.

## Usage

```ts
import { createStorage, createMmkvAdapter, s, defineMigrationChain } from '@flare-engine/storage';
import { MMKV } from 'react-native-mmkv';

const SaveSchema = s.object({
  version: s.literal(2),
  zone: s.number(),
  inventory: s.array(s.string()),
});

const migrations = defineMigrationChain([
  { from: 1, to: 2, migrate: (old: any) => ({ ...old, inventory: old.items ?? [] }) },
]);

const storage = createStorage({
  adapter: createMmkvAdapter(new MMKV()),
  schema: SaveSchema,
  version: 2,
  migrations,
});

await storage.saveSlot('slot1', { version: 2, zone: 4, inventory: ['key'] });
const data = await storage.loadSlot('slot1');
```

Single-document store with lenient parser for a settings doc:

```ts
import { createDocumentStore, createMmkvAdapter, san } from '@flare-engine/storage';
import { MMKV } from 'react-native-mmkv';

interface Settings { locale: string; volume: number; }

function parseSettings(raw: unknown): Settings {
  return san.object({ locale: san.string('en'), volume: san.clamped(1, 0, 1) })(raw);
}

const store = createDocumentStore<Settings>({
  adapter: createMmkvAdapter(new MMKV()),
  key: 'myapp:settings',
  version: 1,
  parse: parseSettings,
  onFirstRun: (s) => ({ ...s, locale: 'en' }),
});

const settings = await store.load();
await store.save({ ...settings, volume: 0.8 });
```

See [API spec](../../docs/design/api-specs.md#flare-enginestorage--4kb-gzip).

## License

MIT
