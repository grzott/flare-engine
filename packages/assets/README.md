# @flare-engine/assets

Manifest-driven asset loading — `AssetManager` with progress signal, `SpriteSheet` (TexturePacker hash + array, Aseprite JSON), `Texture` wrapper around `SkImage`, `createProceduralAtlas` for shape-atlas / placeholder generation. Audio buffer types live in `@flare-engine/audio`.

## Install

```sh
bun add @flare-engine/assets
```

## Usage

A manifest is a list of `{ key, type, path }` entries. `AssetManager` delegates
the actual fetch+decode to an injected `AssetLoader`; two default loaders ship —
one for web (`fetch`) and one for native (a filesystem `readFile`). Both take a
`decodeImage` you wire to your Skia/CanvasKit instance, so the package pulls in
no renderer of its own.

### Web (CanvasKit)

```ts
import { AssetManager, createFetchAssetLoader, type ManifestEntry } from '@flare-engine/assets';

// `kit` is your initialised CanvasKit instance.
const loader = createFetchAssetLoader({
  decodeImage: (bytes) => kit.MakeImageFromEncoded(bytes),
});

const manifest: ManifestEntry[] = [
  { key: 'hero', type: 'texture', path: '/assets/hero.png' },
  { key: 'atlas', type: 'spritesheet', path: '/assets/hero.json' },
];

const assets = new AssetManager(loader);
assets.onProgress.add((p) => console.log(`loading ${Math.round(p * 100)}%`));
await assets.load(manifest);

const hero = assets.get('hero'); // Texture
```

### Native (React Native + Skia)

```ts
import { Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system';
import { AssetManager, createFileAssetLoader, decodeImage } from '@flare-engine/assets';

const loader = createFileAssetLoader({
  readFile: async (path) => {
    const base64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  },
  decodeImage: (bytes) => decodeImage(Skia, bytes),
});

const assets = new AssetManager(loader);
await assets.load(manifest);
```

Per entry `type`: `texture` → a `Texture`; `binary` → `Uint8Array`;
`json` / `spritesheet` → the parsed JSON (feed a spritesheet result to
`parseTexturePackerHash` / `parseTexturePackerArray` / `parseAseprite`).

### Partial-failure loading

`load()` is fail-fast — one failed entry rejects the whole call. When a partial
asset set is acceptable, use `loadManifestSettled()`:

```ts
const { loaded, failed } = await assets.loadManifestSettled(manifest);
if (failed.length) console.warn('some assets failed', failed);
// loaded: string[] of cached keys; failed: { key, error }[]
```

### Sprite sheets & procedural atlases

```ts
import { parseTexturePackerHash, createProceduralAtlas } from '@flare-engine/assets';

const sheet = parseTexturePackerHash(json);

// Procedural placeholder atlas:
const { image, sheet: atlas } = await createProceduralAtlas(skia, [
  { name: 'enemy', w: 32, h: 32, color: 0xff_00_ff_00 },
]);
```

**Rotated frames are not supported.** TexturePacker's "Allow rotation" packs some
frames sideways; the parser cannot yet remap them, so they render rotated. Frames
with `rotated: true` emit a dev-mode `console.warn` naming the frame — re-export
the atlas with rotation disabled. Full rotation support is post-launch.

See [API spec](../../docs/design/api-specs.md#flare-engineassets--6kb-gzip).

## License

MIT
