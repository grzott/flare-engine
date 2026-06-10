# @flare-engine/storage

Typed, versioned key/value persistence for save games and app settings. Adapters: MMKV on native (sync, sub-millisecond), IndexedDB on web, in-memory for tests. Tiny Zod-ish schema validator (`s.string()`, `s.object()`, …) with `Infer<S>` type extraction. Forward-only `Migration[]` chain validated by `defineMigrationChain` — gaps throw at startup, not in production.

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

See [API spec](../../docs/design/api-specs.md#flare-enginestorage--4kb-gzip).

## License

MIT
