# Flare Engine

**Flare** is a modular 2D game engine for React Native + Web, built on `@shopify/react-native-skia` (native) and CanvasKit WASM (web).

## Architecture

34 packages (`@flare-engine/*` + `create-flare-app`) across layered tiers. Dependencies flow **downward only**.

```
Layer 0   Foundation         math · events
Layer 1   Runtime            core · ecs
Layer 2   Systems            render · input · physics · audio · assets
Layer 2.5 Persistence        storage · errors · testing · localization ·
                             deep-links · share · a11y
Layer 3   Features           scene · animation · particles · tilemap · debug ·
                             pathfinding · dialogue
Layer 3.5 UI                 ui · postfx
Layer 4   Integration        react · engine
Tooling                      cli · devtools · create-flare-app
Tier-2 stubs                 leaderboards · achievements · iap · analytics
```

Each package is independently publishable. No circular deps. Full diagram in [docs/design/architecture.md](docs/design/architecture.md); documentation index in [docs/README.md](docs/README.md).

## Status

The full engine is shipping. Two apps in the monorepo:

- [`apps/demo`](apps/demo) — **proof-of-concept + integration smoke test.** Minimal vertical-slice shoot-em-up, device-verified end-to-end on Android (procedural placeholder art). Covers the full engine loop: menu + 3 save slots → base hub → dialogue → play (w/ pause) → end summary. MMKV-backed saves + settings. PolyForm Noncommercial license.
- [`apps/pan-tvardowski`](apps/pan-tvardowski) — **the canonical showcase.** Full-scope vertical shmup themed on Polish folklore (_Pan Twardowski_ legend). 8 zones, 12 enemies, 4 weapons, PL+EN, shape-atlas visuals at 0.1.x. Exercises every shipping `@flare-engine/*` package except `pathfinding` (covered by a separate post-launch project). Pre-production as of 2026-04-22; design locked in [docs/plans/pan-tvardowski-build-plan.md](docs/plans/pan-tvardowski-build-plan.md).

Engine packages ship MIT; game apps ship PolyForm Noncommercial.

**OSS launch target: October 2026.** Phase 11 (M1–M5) ships the full-stack RN+Web surface — 14 added packages plus web parity for the existing packages (CanvasKit / Web Audio / pointer events / fetch loader), a landing-page MP4 placeholder + store-page links (Google Play, App Store; Steam deferred to 0.2.0), and `apps/site` (Docusaurus). Game 2 (roguelike + JRPG battle) is deferred post-launch to a separate private repo as the real-world dogfood test. Phase 12 (M6) is a 6-week content runway + coordinated launch. See [docs/plans/build-plan.md](docs/plans/build-plan.md).

## Conventions

- **Bun** for runtime, package management, and testing
- **Turborepo** for monorepo orchestration
- **Biome** for linting and formatting (Rust-based, single tool)
- **tsup** for building (dual CJS+ESM, .d.ts generation)
- **Conventional Commits**: `feat(math): add Vec2.lerp` — max 72 chars, no emoji
- **SemVer** via Changesets — independent versioning per package
- **TypeScript strict**, ES2022, bundler resolution, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`

## Code Style

- Zero-alloc hot paths — plain objects + static methods, no `new` in game loops
- Named exports only — no default exports
- Tree-shakeable — no `export *` barrels (except `@flare-engine/engine`)
- No `any`, `as any`, or `@ts-ignore`
- No classes where plain objects + static functions suffice

## Commands

```bash
bun install          # Install deps
bun run build        # Build all packages (turbo)
bun run test         # Test all packages (turbo)
bun run lint         # Lint all packages (turbo → biome)
bun run typecheck    # Type-check all packages (turbo → tsc)
bun run lint:fix     # Auto-fix lint + format (biome)
```
