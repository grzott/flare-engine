# @flare-engine/assets

Manifest-driven asset loading — `AssetManager` with progress signal, `SpriteSheet` (TexturePacker hash + array, Aseprite JSON), `Texture` wrapper around `SkImage`, `createProceduralAtlas` for shape-atlas / placeholder generation. Audio buffer types live in `@flare-engine/audio`.

## Install

```sh
bun add @flare-engine/assets
```

## Usage

```ts
import { AssetManager, parseTexturePackerHash, createProceduralAtlas } from '@flare-engine/assets';

const assets = new AssetManager(loadFn);
assets.onProgress.add((p) => console.log(p));
await assets.load(manifest);

const sheet = parseTexturePackerHash(json);

// Procedural placeholder atlas:
const { image, sheet: atlas } = await createProceduralAtlas(skia, [
  { name: 'enemy', w: 32, h: 32, color: 0xff_00_ff_00 },
]);
```

See [API spec](../../docs/design/api-specs.md#flare-engineassets--6kb-gzip).

## License

MIT
