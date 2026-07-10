---
"@flare-engine/assets": minor
---

Default asset loaders + partial-failure loading + rotated-frame warning. `createFetchAssetLoader({ decodeImage, fetch? })` (web) and `createFileAssetLoader({ readFile, decodeImage })` (native, structural injection — no RN import) satisfy the existing `AssetLoader` type: per manifest `type`, `texture` decodes to a `Texture`, `binary` yields a `Uint8Array`, `json`/`spritesheet` yield parsed JSON. `fetch` is typed structurally (`FetchLike`), keeping the package DOM/Bun-free. `AssetManager.loadManifestSettled()` adds an allSettled path returning `{ loaded, failed: { key, error }[] }` alongside the fail-fast `load()`. TexturePacker frames exported with `rotated: true` now emit a dev-mode `console.warn` naming the frame (rotation is still unsupported — full support is post-launch). README shows real two-platform wiring (CanvasKit `MakeImageFromEncoded` + expo-file-system).
