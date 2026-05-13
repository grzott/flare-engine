# Flare Engine

**Flare** is a modular 2D game engine for React Native + Web, built on `@shopify/react-native-skia` (native) and CanvasKit WASM (web). 37 packages across layered tiers; deps flow downward only.

Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Architecture: [docs/design/architecture.md](docs/design/architecture.md). API: [docs/design/api-specs.md](docs/design/api-specs.md).

## Tooling

- **Bun** runtime + package management + testing
- **Turborepo** monorepo orchestration
- **Biome** lint + format (never Prettier or ESLint)
- **tsup** build (dual CJS+ESM, .d.ts)
- **Changesets** independent SemVer per package
- **TypeScript strict**, ES2022, bundler resolution, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`

## Code style

- No `any`, no `as any`, no `@ts-ignore`
- Named exports only — no default exports
- No `export *` barrels except `@flare-engine/engine`
- `import type` for type-only imports
- No classes where plain objects + module-level functions suffice
- Only comment non-obvious logic; no `TODO` / `FIXME`

## Performance (hot paths)

- Zero-alloc in `update()` / `render()` — no `new` in game loops
- Pre-allocate and reuse buffers; pre-create queries outside the loop
- Provide `out`-parameter (`…Into`) zero-alloc form alongside allocating form when value is consumed per-frame
- `Float32Array` for bulk numeric data

## Commands

```bash
bun install
bun run build       # all packages (turbo)
bun run test        # all packages (turbo)
bun run lint        # biome
bun run typecheck   # tsc per package (turbo)
bun run lint:fix
```

## Conventions

- Conventional Commits: `feat(math): add Vec2.lerp` — ≤72 chars, no body, no emoji
- One source per fact (no mirror rows, no duplicate changelogs)
- Status: feature-complete at 0.1.x; OSS launch target October 2026
