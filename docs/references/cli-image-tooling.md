# CLI Image Tooling: sharp vs Pure-JS

> Research date: 2026-04-20 | Scope: `@flare-engine/cli` package (stage 11.8)

## Context

The `@flare-engine/cli` package (stage 11.8) includes `flare pack-atlas` — a dev-time command that reads sprite PNGs, bin-packs them via MaxRects, and writes a composite atlas image + JSON descriptor. The API spec says "Node 20+, uses sharp for image work" and includes `--format png|webp`.

## Candidates

| Library                    | DL/week | License    | Native Deps                             | Last Publish | TS Types       |
| -------------------------- | ------- | ---------- | --------------------------------------- | ------------ | -------------- |
| **sharp** v0.34.5          | 53.1M   | Apache-2.0 | Yes (libvips, prebuilt binaries ~50 MB) | 19 hours ago | Built-in       |
| **pngjs** v7.0.0           | 29.8M   | MIT        | None                                    | 3 years ago  | `@types/pngjs` |
| **maxrects-packer** v2.7.3 | 35.5K   | MIT        | None                                    | 8 months ago | Built-in       |
| **jimp** v1.6.1            | 3.8M    | MIT        | None (27 JS deps)                       | 13 days ago  | Built-in       |

## Analysis

### Option A: sharp (per spec)

**Pros:**

- 4-5x faster than ImageMagick, instant for typical atlas sizes (<100 sprites)
- Full format support: PNG, WebP, AVIF, JPEG, TIFF — covers `--format png|webp` out of the box
- Compositing API: `sharp(bg).composite([{input, left, top}])` — one call packs the entire atlas
- Prebuilt binaries for macOS arm64/x64, Linux arm/arm64/x64, Windows x64 — no compile step for 99% of users
- Actively maintained, Apache-2.0 compatible
- Already in `bun.lock`; spec says "uses sharp"

**Cons:**

- ~50 MB native binary download on first `bun install` / `npm install`
- CI environments occasionally hit prebuild download failures (rare, retryable)
- Cannot run in WASM/browser contexts (irrelevant — CLI is Node/Bun only)

### Option B: pngjs + maxrects-packer (zero native deps)

**Pros:**

- Zero native dependencies, installs instantly
- pngjs: battle-tested PNG codec, direct pixel buffer access (`Uint8Array` RGBA)
- maxrects-packer: same MaxRects algorithm as TexturePacker, TypeScript-native

**Cons:**

- **No WebP output** — pngjs only handles PNG. `--format webp` would require a separate library
- Must implement compositing manually (blit sprite pixels into atlas buffer, then write PNG)
- pngjs last published 3 years ago — stable but no active maintenance
- ~10-20x slower than sharp for large atlases (JS pixel manipulation vs C++ SIMD)

### Option C: jimp (pure JS, higher-level)

**Pros:**

- Higher-level API: `Jimp.read()`, `image.composite(overlay, x, y)`, `image.write()`
- Supports PNG, JPEG, BMP, TIFF, GIF
- Actively maintained, TypeScript-first in v1.x

**Cons:**

- **No WebP output** (same as pngjs)
- 27 transitive dependencies — larger attack surface
- Slower than sharp by 5-10x
- 3.8M DL/week vs sharp's 53M — smaller community

### Option D: Hybrid (maxrects-packer + sharp for I/O) — RECOMMENDED

Use maxrects-packer for bin-packing logic (it only needs `{width, height}` input and produces `{x, y}` positions), then sharp for reading sprites and compositing the final atlas.

**Pros:** Best of both — pure-JS packing algorithm, native-speed image I/O.
**Cons:** Still has the sharp native dep (acceptable for a dev tool).

## Recommendation

**Keep sharp per spec.** Use the hybrid approach (Option D): `maxrects-packer` for packing + `sharp` for image I/O. Rationale:

1. **WebP is a hard requirement.** The spec says `--format png|webp`. No pure-JS library handles WebP encoding well. Removing WebP support to avoid sharp is a spec regression.

2. **CLI is a dev tool, not a runtime dependency.** Native deps in dev tooling is industry standard (TypeScript ships binaries, Biome ships a Rust binary, sharp is in Vite/Next.js/Astro). Users install it once on their dev machine — no impact on games shipped to end users.

3. **Already in the dependency graph.** `sharp` is in `bun.lock`. Removing it to add `pngjs` + `jimp` + a WebP polyfill adds complexity without benefit.

4. **Performance scales.** Large sprite sheets (200+ sprites, 4096x4096 atlas) will take seconds with pngjs but milliseconds with sharp. Game jams and rapid iteration benefit from fast tooling.

5. **maxrects-packer for bin packing is recommended regardless.** It's a pure algorithm library (MIT, zero deps, TypeScript) that sharp doesn't replace. Use maxrects-packer for rect placement, sharp for image I/O.

### Suggested Architecture

```
flare pack-atlas src/sprites/ -o dist/atlas -n atlas --format webp

1. fs.readdir() -> list .png files
2. sharp(file).metadata() -> get {width, height} per sprite
3. maxrects-packer.add({width, height, data: filepath})
4. maxrects-packer.bins[0].rects -> positions
5. sharp({create: {width, height, channels: 4}})
     .composite(rects.map(r => ({input: r.data, left: r.x, top: r.y})))
     .toFormat(format)
     .toFile(output)
6. Write JSON descriptor (TexturePacker format)
```

### If Zero-Native-Deps Is Ever Required (Future)

Make sharp an optional peer dependency with a runtime check:

```typescript
let sharp: typeof import("sharp") | undefined;
try {
  sharp = await import("sharp");
} catch {
  /* fallback */
}
```

PNG-only fallback via pngjs + manual compositing. WebP disabled with a warning. This adds ~100 LOC but keeps the tool functional without sharp. Not needed for 0.1.0.

---

## Sources

| Source              | URL                                              |
| ------------------- | ------------------------------------------------ |
| sharp npm           | https://www.npmjs.com/package/sharp              |
| sharp docs          | https://sharp.pixelplumbing.com/                 |
| pngjs npm           | https://www.npmjs.com/package/pngjs              |
| maxrects-packer npm | https://www.npmjs.com/package/maxrects-packer    |
| jimp npm            | https://www.npmjs.com/package/jimp               |
| Flare CLI spec      | `docs/design/api-specs.md` (search `pack-atlas`) |
| Flare roadmap       | `docs/plans/roadmap.md` (Phase 11 tooling)       |
