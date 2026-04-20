---
name: flare-cli
description: Deep knowledge of the @flare-engine/cli package — flare pack-atlas (TexturePacker-compatible atlas from images), flare tiled-to-flare (Tiled .tmj normalizer), flare new (scaffolder). Use when working on the Flare CLI, packing sprite atlases, or converting editor formats.
---

# `@flare-engine/cli`

Tooling package. Commander-based CLI shipping `flare` with three subcommands.

## Exports

```ts
import { packAtlas, convertTiled } from "@flare-engine/cli";
// type PackAtlasOptions, type ConvertTiledOptions
```

## Commands

- `flare pack-atlas <inputDir> <outputDir>` — reads PNGs, bin-packs via `maxrects-packer`, encodes with `sharp`, emits TexturePacker-compatible JSON + PNG.
- `flare tiled-to-flare <tmj>` — parses Tiled `.tmj`, normalizes to Flare's runtime tilemap JSON.
- `flare new <name>` — alias for `npm create flare-app@latest <name>`.

## Programmatic API

```ts
await packAtlas({
  inputDir: "./art/sprites",
  outputDir: "./assets",
  name: "enemies",
  padding: 2,
  maxSize: 2048,
});
```

## Rules

- `sharp` + `maxrects-packer` are real runtime deps here (CLI-only) — safe because nothing in `packages/*/src/**` imports this package.
- Output is TexturePacker hash-format JSON — compatible with `parseTexturePacker` from `@flare-engine/assets`.

Background: [docs/references/cli-image-tooling.md](../../../docs/references/cli-image-tooling.md).
