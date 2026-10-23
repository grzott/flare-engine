# @flare-engine/cli

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

### Patch Changes

- 0d8afc9: The scaffolder ships as `@flare-engine/create` (bin `flare-create`), published with the rest of the
  scope. Per ADR-0007.

  The unscoped name it was developed under, `create-flare-app`, was never published by this project
  and has belonged to an unrelated npm package since 2026-09-11, so `npm create flare-app` runs that
  package instead. Scaffold with `npm create @flare-engine my-game` (npm, pnpm and yarn map a bare
  `@flare-engine` to `@flare-engine/create`) or `bunx @flare-engine/create my-game`; programmatic use
  imports `scaffoldApp` from `@flare-engine/create`. Templates and options are unchanged.

  `flare new` previously ran `npx create-flare-app`, which now resolves to the other package. It now
  runs `@flare-engine/create` pinned to the CLI's own version, which lockstep versioning guarantees
  exists, so it can never pick up an unscoped package of the same name.

- 14b532e: PF-1a: `flare tiled-to-flare` now emits Tiled-shaped JSON, so `@flare-engine/tilemap`'s `parseTiled` — its only importer — actually accepts the file. Per ADR-0004.

  `convertTiled` used to write layers as `{ kind: 'tile' | 'object' }` with no `type`, converted object `properties` to a `Record`, and dropped every tileset's `tiles[]` — the only place `solid`/`collision` flags live. `parseTiled` requires `type: 'tilelayer' | 'objectgroup'` and throws on anything else, so a consumer who followed the documented flow — run `flare tiled-to-flare`, then `parseTiled(require('./zone1.flare.json'))` — got `unsupported type "undefined"`, and even past that, every `solid` tile flag would have come out empty.

  The fix is a pass-through of the original layer and tileset objects (group/image layers flattened/dropped, external tilesets inlined), not a re-projection through a narrower shape: beyond `type`, `properties` (kept as Tiled's `{name,type,value}[]`, not a `Record` — `parseTiled` has no length guard for a Record and throws on one) and tileset `tiles[]`, object `rotation`, layer `offsetx`/`offsety`, and per-layer/tileset `properties` all now survive.

  `FlareMap` / `FlareTileLayer` / `FlareObjectLayer` / `FlareObject` / `FlareTileset` / `FlareLayer` are deleted from the cli barrel — there is no second published map format. `TiledResult` now returns Tiled-shaped `TiledLayer` / `TiledTileset` / `TiledMap` (plus `TiledObject`, `TiledTile`, `TiledProperty`), all newly exported.

  `--no-embed-tilesets` keeps its existing behaviour (preserves the Tiled `source` reference) but is now documented, not silently broken: `parseTiled` rejects a tileset with `source` set, so that output is for a pipeline that resolves external tilesets itself, not a `parseTiled`-ready file.

## 0.3.1

## 0.3.0

### Minor Changes

- ddbb151: both CLIs report their real version read from their own package.json at build time (no more hardcoded 0.0.0); Windows spawn uses shell:isWin with a validated app-name guard against injection; tiled-to-flare default out path now writes beside the input instead of a double-prepended absolute path that ENOENT'd without -o; --no-embed-tilesets preserves the external tileset source reference instead of emitting an empty zero stub.
- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- abdb991: README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

  - Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
  - `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

  (Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
