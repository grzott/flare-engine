# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Workflow
- Use the `/builder` agent for non-trivial implementation tasks; `/explorer` for read-only investigation; `/reviewer` for an independent second opinion on a diff.
- Read [docs/design/api-specs.md](docs/design/api-specs.md) before implementing any module — it is the source of truth for public API shape. Divergence between code and spec is treated as a spec bug.
- Architecture, dependency graph, and tooling rationale live in [docs/design/](docs/design/). Active build plans are in [docs/plans/](docs/plans/).
- Per-domain rules (code style, testing, git) are in [.claude/rules/](.claude/rules/) — these are loaded by glob and apply to matching files.

## Commands
```bash
bun install                              # Install all workspace deps
bun run build                            # Build all packages — verifies full dep chain (turbo)
bun run test                             # Test all packages (turbo, depends on build)
bun run lint                             # Biome check across all packages
bun run lint:fix                         # Biome auto-fix + format
bun run typecheck                        # tsc --noEmit across all packages
bun run bench                            # Run benchmark suite in benchmarks/
```

### Per-package
```bash
cd packages/<name> && bun test           # Run one package's tests
cd packages/<name> && bun test <file>    # Run a single test file
cd packages/<name> && bun run build      # Build one package (tsup)
cd packages/<name> && bun run typecheck  # Type-check one package
```

## Workspaces
- `packages/*` — the 16 publishable `@flare-engine/*` packages
- `apps/demo` — Expo + React Native consumer app; **device-verified end-to-end loop** (menu → play → boss → game-over/victory → menu). Treat it as the canonical integration test for Layer 4 (`@flare-engine/react`, `@flare-engine/engine`) and as the reference for how a consumer wires scenes, audio, input, and HUD.
- `apps/bench-dashboard` — visualizer for `benchmarks/results/`
- `benchmarks/` — perf harness; results are committed under `apps/bench-dashboard`

## Package Structure
16 packages (`@flare-engine/*`) across 5 layers — dependencies flow **downward only**:
- **Layer 0**: `math`, `events`
- **Layer 1**: `core`, `ecs`
- **Layer 2**: `render`, `input`, `physics`, `audio`, `assets`
- **Layer 3**: `scene`, `animation`, `particles`, `tilemap`, `debug`
- **Layer 4**: `react`, `engine`

Each package lives at `packages/<name>/`, builds with `tsup` to dual CJS+ESM with `.d.ts`, and is independently versioned via Changesets. Use the `/new-package` skill to scaffold one.

## Key Invariants
- No circular dependencies between packages — Layer N may only import from Layer < N.
- No barrel re-exports of entire modules (`export * from ...` is banned) so consumers stay tree-shakeable.
- Hot-path code is zero-alloc — no `new` inside `update()`/`render()`. Use plain objects + static methods, pre-allocated buffers, and `out` parameters.
- TypeScript strict + ES2022 + `verbatimModuleSyntax` + `noUncheckedIndexedAccess` — array/record access is `T | undefined`; handle it.
- Named exports only. No `any`, no `as any`, no `@ts-ignore`.
- Biome owns formatting and linting — never run Prettier or ESLint. `bun run lint:fix` is the fixer.

## Commits & Versioning
- Conventional Commits, max 72 chars, no emoji: `feat(math): add Vec2.lerp`. Enforced by commitlint via Husky.
- Add a changeset (`bun changeset`) for any user-facing change so SemVer bumps are correct.
- Full git conventions in [.claude/rules/git.md](.claude/rules/git.md).
