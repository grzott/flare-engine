# Flare Engine

**Flare** is a modular 2D engine for React Native + Web (animation, gamification, interactive UI, and games), built on `@shopify/react-native-skia` (native) and CanvasKit WASM (web). Scoped `@flare-engine/*` packages across layered tiers. **The dependency rule (single source — every other doc should link here instead of restating it): a package may depend only on packages at an equal or lower tier, never higher; `@flare-engine/engine` is the sanctioned umbrella exception.** Enforced by `scripts/check-deps-tiers.mjs` (`bun run check:deps`); tier map: [docs/design/architecture.md](docs/design/architecture.md#layer-diagram).

Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Architecture: [docs/design/architecture.md](docs/design/architecture.md). API: [docs/design/api-specs.md](docs/design/api-specs.md).

## Tooling

- **Biome** lint + format — never Prettier or ESLint
- **Changesets** lockstep (`fixed`) versioning across `@flare-engine/*` — never bump a single package
- **`patch` is the default and needs no permission.** A `minor` or `major` changeset is an owner
  decision, not an implementation detail: lockstep means one word moves all **42 scoped
  `@flare-engine/*` packages** at once (the scaffolder is `@flare-engine/create` since ADR-0007) — a
  `minor` opens the next `0.x` line, a `major` publishes `1.0.0`, and npm does not take a publish
  back. `check:bump` refuses any pending changeset above `patch` unless it cites an `ADR-NNNN` in
  `docs/design/` whose `Status` is `Accepted`. There is no env-var override. Write the ADR from
  [`adr-0000-template.md`](docs/design/adr-0000-template.md) and get it accepted first. **ADRs are
  for breaking changes** — an exported symbol removed or changed, a peer floor raised, a documented
  contract changed. A bug fix needs none, even when it changes observable behaviour.
- **Public since 2026-10-26, so a break costs strangers their build.** Breaking changes batch into
  the next planned minor behind a deprecation window, and an accepted breaking ADR carries a
  **posting obligation** to `flare-engine-page` and the portfolio. Posture, deprecation policy,
  stability tiers, reserved numbers and the obligation:
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
- Status: **public since 2026-10-26** — the repo and every `@flare-engine/*` package; read
  `CHANGELOG.md` for the current version rather than trusting a literal here. The launch record is
  [docs/plans/road-to-oss-2026-09.md](docs/plans/road-to-oss-2026-09.md)

### Release posture (verified 2026-10-31 at `da9de24`)

- **Public, with provenance from `0.4.5`.** `0.1.0` through `0.4.4` were published restricted; npm
  visibility is retroactive, so every version installs anonymously now. `0.4.5` is the first release
  published as public.
- **Releases go through CI only.** Run `bun run version` locally, add the root `CHANGELOG.md` entry,
  commit and push `main`; `release.yml` (gated on the `ENABLE_RELEASE` variable) runs
  `bun run release` with npm provenance. A local `bun run release` ships without provenance.
- **Publishing uses npm Trusted Publishing.** `release.yml` authenticates by OIDC (`id-token: write`);
  there is no publish token. Each of the 42 packages lists `grzott/flare-engine` + `release.yml` as
  its trusted publisher with direct `npm publish` allowed — a package missing that entry fails with
  `ENEEDAUTH`. First published this way: `0.4.6`. A local `bun run release` cannot publish.
- **A release commit bumps every `package.json` but does not publish.** Git and npm can diverge at
  any moment, in either direction. Never infer one from the other; `CHANGELOG.md` is the index and
  each package's own `CHANGELOG.md` is the source of truth for what changed.

### An audit finding's prose is an argument, not a measurement

Findings docs (`docs/plans/*-audit-*.md`) carry a **Defect**, an **Impact**, a severity, and a
**Fix** written by a *finder*, then **Verifier corrections** written by refuters. Only the defect
claim is verified. The Impact paragraph, the severity and the suggested Fix routinely overstate — in
Arc PFA four did, and two reached a consumer-facing document before a reviewer caught them.

- **Verifier corrections beat the finder's text.** Where they disagree, the correction wins. Where
  the verifiers are *silent* on a detail, that detail is unverified — not endorsed.
- **Re-verify at HEAD before repeating a finding's claim in anything that ships** — a changeset, an
  ADR, `api-specs.md`, a README. Those become the public changelog; a borrowed overstatement ships.
- **Whoever touched the code drafts the consumer-facing prose.** A coordinator writing an ADR row or
  a changeset from the finding text instead of from the implemented diff is the exact path that
  produced all four. Edit that prose, do not author it.
- A finding with **no refuter** (the "unverified" tables) gets its site confirmed at HEAD before any
  code moves. If the premise is false, report it and change nothing.
