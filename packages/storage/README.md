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

## Slot headers

A slot menu needs one line per save ("Day 12 · Kaszuby · 6 h played") without paying for `loadSlot` on each: that runs every migration and the full schema parse per slot, and one corrupt save throws and takes the menu down. Pass a small, JSON-serialisable header as the third argument of `saveSlot`; `listSlotHeaders()` returns `{ name, version, header }` for every slot from the envelope alone, with no migration and no schema. A slot saved without a header, or written before headers existed, lists with `header: null`; a slot whose envelope cannot be read lists with `version: null` and `header: null`. A bad slot never fails the others.

```ts
import { createStorage, createMemoryAdapter, s, san } from '@flare-engine/storage';

const SaveSchema = s.object({ day: s.number(), zone: s.string(), inventory: s.array(s.string()) });

// Lenient and never throwing: a header written before `playedSeconds` existed lists it as 0.
const parseHeader = san.object({
  day: san.number(0),
  zone: san.string('unknown'),
  playedSeconds: san.number(0),
});

const storage = createStorage({
  adapter: createMemoryAdapter(),
  schema: SaveSchema,
  version: 1,
  parseHeader,
});

await storage.saveSlot(
  'slot1',
  { day: 12, zone: 'Kaszuby', inventory: ['key'] },
  { day: 12, zone: 'Kaszuby', playedSeconds: 21_600 },
);

for (const slot of await storage.listSlotHeaders()) {
  const label = slot.header
    ? `Day ${slot.header.day} · ${slot.header.zone} · ${Math.round(slot.header.playedSeconds / 3600)} h played`
    : 'Unreadable save';
  console.log(slot.name, slot.version ?? '?', label);
}
```

- **Headers are not migrated.** `listSlotHeaders` returns an old header as it was written, so a consumer that changes its header shape reads the old shape unless `parseHeader` repairs it. `parseHeader` is a lenient `Sanitizer<H>` like `createDocumentStore`'s `parse`; it also types `H`, runs only in `listSlotHeaders` (`saveSlot` stores the header as given), and a header that makes it throw lists as `null`.
- **Cost.** `listSlotHeaders` still reads and JSON-parses each slot's full string; it skips only the migrations and the schema. The saving is per-slot CPU and the no-throw contract, not I/O.
- **Overwrite drops the header.** `saveSlot(name, data)` without a header removes the slot's previous header; pass it on every save.
- A header-less `saveSlot` writes the same `{ version, data }` envelope as before, and `loadSlot` ignores the header, so existing saves need no migration.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginestorage--4kb-gzip).

## License

Apache-2.0
