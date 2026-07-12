# Contributing to Flare

Thanks for your interest in Flare! This is a modular 2D engine for React Native + Web (animation, gamification, interactive UI, and games), built on Skia. We welcome bug reports, feature requests, documentation fixes, and code contributions — no contribution is too small.

> **Before the public OSS launch (October 2026)** the public API can still move. If you're planning a substantial change, open an issue or discussion first so we can align before you invest the effort.

---

## Quick Start

```bash
bun install          # Install all dependencies
bun run build        # Build all packages (turbo, dependency-ordered)
bun run test         # Run the full test suite
```

First-time setup needs [Bun](https://bun.sh) 1.1+.

---

## Ways to Contribute

- **Bug reports.** Open a GitHub Issue with a minimal reproduction — a failing `bun test` snippet or a small standalone repo is ideal.
- **Feature requests.** Open a Discussion first so we can scope it against the [roadmap](docs/plans/roadmap.md).
- **Docs.** Typos, clarifications, new examples — all welcome. Docs live under [docs/](docs/README.md) and in each package's README.
- **Code.** See the workflow below.

---

## Development Workflow

1. Fork the repo and create a branch: `feat/<short-name>` or `fix/<short-name>`.
2. Read [docs/design/api-specs.md](docs/design/api-specs.md) before touching any public API — it's the source of truth for package contracts.
3. Implement your change in the relevant `packages/<name>/src/` directory. One concept per file.
4. Write tests in `packages/<name>/tests/<module>.test.ts`. Cover edge cases.
5. Run local verification:
   ```bash
   bun test                 # or: cd packages/<name> && bun test
   bun run typecheck
   bun run lint
   bun run build
   ```
6. Add a changeset if the change is user-facing:
   ```bash
   bun changeset
   ```
7. Commit using Conventional Commits (enforced by commitlint): `feat(math): add Vec2.lerp`.
8. Push and open a Pull Request. The CI workflow runs the same four checks as step 5.

After a publish, the [Pan Tvardowski repo](https://github.com/grzott/Pan-Tvardowski)'s nightly
`Engine Compat` workflow is the post-publish drift signal — it floats `@flare-engine/*` to the
latest in-range versions and runs PT's full gate. **Engine minor bumps (`0.x` → `0.x+1`) fall
outside PT's caret ranges and silently freeze that guard** — bumping PT's `@flare-engine/*`
ranges is part of every minor release.

---

## Project Layout

- [packages/](packages/) — the 36 `@flare-engine/*` packages + the `create-flare-app` scaffolder. See [README.md](README.md#packages) for the layer map.
- [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) — device-verified Expo consumer game in its own repo; canonical end-to-end reference consuming `@flare-engine/*` from npm.
- [apps/bench-dashboard/](apps/bench-dashboard/) — Next.js visualizer for benchmark results.
- [benchmarks/](benchmarks/) — perf harness.
- [docs/](docs/README.md) — design, plans, references.

Each package follows the same layout:

```
packages/<name>/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts         # Barrel — named exports only
│   └── <module>.ts      # One file per concept
└── tests/
    └── <module>.test.ts # One test file per source file
```

---

## Conventions at a Glance

| Concern       | Rule                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| TypeScript    | Strict, ES2022, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, no `any`, no `@ts-ignore`    |
| Exports       | Named only. No default exports. No `export *` barrels (except `@flare-engine/engine`).           |
| Dependencies  | Layer N may only import from layer < N. No circular imports.                                     |
| Hot paths     | Zero-alloc — no `new` inside `update()` / `render()`. Use plain objects + static methods.        |
| Lint + Format | [Biome](https://biomejs.dev). Run `bun run lint:fix` to auto-fix. Never Prettier or ESLint.      |
| Commits       | Conventional Commits, ≤72 chars, no emoji. Example: `feat(ecs): cache archetype bitmask`.        |
| Tests         | `bun test`. One test file per source file. Cover `NaN`, `Infinity`, zero, negative, edge inputs. |
| Versioning    | Changesets (lockstep — one shared version across `@flare-engine/*` + `create-flare-app`).        |

Longer versions live in [AGENTS.md](AGENTS.md).

---

## PR Checklist

- [ ] Tests cover the new behavior and edge cases
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean
- [ ] `bun test` green
- [ ] `bun run build` green (verifies the full dep chain)
- [ ] Changeset added for user-facing changes
- [ ] Docs updated if the public API moved (`docs/design/api-specs.md`, package README, etc.)
- [ ] Commit subjects follow `type(scope): description` and are ≤72 chars

---

## Code of Conduct

Be kind, assume good intent, and keep discussion focused on the work. A formal Code of Conduct (Contributor Covenant 2.1) lands at 0.1.0-rc.

---

## License

By contributing you agree that your contributions are licensed under the project's [MIT license](LICENSE).
