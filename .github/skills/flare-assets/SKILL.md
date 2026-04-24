---
name: flare-assets
description: Deep knowledge of the @flare-engine/assets package — AssetManager, SpriteSheet, TexturePacker/Aseprite parser, createProceduralAtlas, Texture wrapper. Use when loading images/audio via manifest, parsing sprite sheet JSON, or generating placeholder atlases at runtime in Flare.
---

# `@flare-engine/assets`

Layer 2. Runtime-agnostic — the real loader is injected by `@flare-engine/react`.

## Exports

```ts
import {
  AssetManager,
  type AssetLoader,
  type Texture,
  createTexture,
  type SkImageLike,
  type SpriteSheet,
  type SpriteFrame,
  parseTexturePacker,
  parseAseprite,
  createProceduralAtlas,
  type SkiaAtlasModuleLike,
} from "@flare-engine/assets";
```

## Usage sketch

```ts
const assets = new AssetManager(loader);
assets.onProgress.add((p) => setProgress(p));
await assets.load({
  playerTex: { type: "image", src: require("./player.png") },
  playerSheet: { type: "json", src: require("./player.json") },
});
const sheet = parseTexturePacker(assets.get("playerSheet"));
```

## Procedural atlas (placeholder art)

```ts
const { image, sheet } = createProceduralAtlas(
  Skia,
  [
    { name: "enemy", w: 24, h: 24, color: "#f33" },
    { name: "bullet", w: 4, h: 8, color: "#ff0" },
  ],
  { maxWidth: 256, padding: 2 },
);
```

**Canonical placeholder-atlas pattern:** [`apps/pan-tvardowski/src/shape-atlas.ts`](../../../apps/pan-tvardowski/src/shape-atlas.ts) draws a full game's worth of enemies / bullets / particles as Skia shapes onto an offscreen surface and emits a `SpriteSheet`. Production sprite art drops into the same manifest slot at M9.5 with no code change. Mirror this pattern for any new game that wants to start without commissioned art.

## Rules

- Audio buffer types live in `@flare-engine/audio` (`AudioBufferLike`), not here. Don't add audio types to this package.
- `AssetLoader` is a plain `(entry) => Promise<unknown>` — keep this package framework-free so it remains bun-testable.

Spec: [docs/design/api-specs.md § @flare-engine/assets](../../../docs/design/api-specs.md).
