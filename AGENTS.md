# Flare Engine

**Flare** is a modular 2D engine for React Native + Web (animation, gamification, interactive UI, and games), built on `@shopify/react-native-skia` (native) and CanvasKit WASM (web). Scoped `@flare-engine/*` packages across layered tiers; **deps flow downward only**.

Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Architecture: [docs/design/architecture.md](docs/design/architecture.md). API: [docs/design/api-specs.md](docs/design/api-specs.md).

## Tooling

- **Biome** lint + format — never Prettier or ESLint
- **Changesets** lockstep (`fixed`) versioning across `@flare-engine/*` — never bump a single package
- **`patch` is the default and needs no permission.** A `minor` or `major` changeset is an owner
  decision, not an implementation detail: lockstep means one word moves all 42 packages — `minor`
  opens `0.4.0` (reserved for the freeze cut), `major` publishes `1.0.0`, and npm does not take a
  publish back. `check:bump` refuses any pending changeset above `patch` unless it cites an
  `ADR-NNNN` in `docs/design/` whose `Status` is `Accepted`. There is no env-var override.
  Write the ADR from [`adr-0000-template.md`](docs/design/adr-0000-template.md) and get it accepted
  first — and write one for a consumer-observable behaviour change even when it ships as a `patch`,
  which the gate cannot see.
- **Pre-flip, the answer to that decision is often "yes".** The scope is `restricted` with no public
  consumers, so a break costs a migration we control. Minors are deliberately unblocked until the
  flip, announced version numbers are provisional, and an accepted breaking ADR carries a
  **posting obligation** to `flare-engine-page` and the portfolio. Posture, reserved numbers
  (`0.4.0` = freeze cut, `1.0.0` = launch) and the obligation:
  [`docs/plans/versioning-and-announcements.md`](docs/plans/versioning-and-announcements.md).

## Code style

- No `any`, no `as any`, no `@ts-ignore`
- No `export *` barrels except `@flare-engine/engine`
- No classes where plain objects + module-level functions suffice
- Only comment non-obvious logic; no `TODO` / `FIXME`

(Named exports and `import type` are enforced by Biome — `noDefaultExport` and `useImportType`.)

## Performance (hot paths)

- Zero-alloc in `update()` / `render()` — no `new` in game loops
- Pre-allocate and reuse buffers; pre-create queries outside the loop
- Provide `out`-parameter (`…Into`) zero-alloc form alongside allocating form when value is consumed per-frame
- `Float32Array` for bulk numeric data

## Conventions

- Conventional Commits: `feat(math): add Vec2.lerp` — ≤72 chars, no body, no emoji, no Co-Authored-By trailer
- One source per fact (no mirror rows, no duplicate changelogs)
- Status: 0.2.1 on npm (restricted); **public OSS flip October 2026** — queue + full specs in [docs/plans/road-to-oss-2026-09.md](docs/plans/road-to-oss-2026-09.md)
