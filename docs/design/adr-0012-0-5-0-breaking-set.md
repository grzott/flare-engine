# ADR-0012: 0.5.0 makes eleven breaking changes, each announced in a 0.4.x patch first, and `pop()` keeps its default

- **Status**: Proposed <!-- Proposed | Accepted | Superseded by ADR-NNNN -->
- **Date**: 2026-11-25
- **Consumer impact**: breaking
- **Release level**: minor

## Context

Checked at HEAD `e4290aa5` on 2026-11-25. Where a line below names a consumer, the claim was checked
by searching that consumer's tree on the same day: Pan Tvardowski (`687a9a01`), flare-engine-page,
and Berek.

`docs/plans/versioning-and-announcements.md` holds breaking changes back for the planned minor,
`0.5.0`. It removes a public symbol no earlier than the minor after a patch that marked it
`@deprecated`, and it raises a peer floor only after a patch announced the new floor. Ten issues in
the `0.5.0` milestone wait on an ADR: #172, #173, #175, #176, #177, #178, #179, #236, #375 and #426.
`check:bump` refuses the minor changeset until an accepted ADR is cited. This ADR covers all ten, so
that one document records what 0.5.0 changes, and so the announcement patch can ship before the cut. `@flare-engine/engine` re-exports every package, so each
removal below also leaves the umbrella barrel.

Already announced in a published patch:

- **`_resetComponentIds` (#172)** is `@deprecated` since 0.4.14 (`packages/ecs/src/component.ts:51-59`).
  In-repo it is called only by `benchmarks/src/ecs.bench.ts:19` and `integration.bench.ts:57`.
- **`ComponentDef.id` and `.bit` (#173)** are `@deprecated` since 0.4.14 (`component.ts:10-23`).
  `bit = 1 << id` wraps from the 33rd definition, which is why the cap at `component.ts:40` and
  `packages/ecs/src/world.ts:9` exists.
- **`Query.requiredMask`, `Query.excludedMask`, the `Query` constructor and `Query.matches(archetype)`
  (#173)** are `@deprecated` since 0.4.14 (`packages/ecs/src/query.ts:19-29`, `:45-63`). They are
  marked as "leaves the public API in 0.5.0". Only `World.query` and `QueryBuilder.build` construct a
  `Query`.
- **`SystemDef._worldFn` (#175)** is `@deprecated` since 0.4.10 (`packages/ecs/src/system.ts:16-17`),
  in favour of `worldFn`, the same function. In-repo it is still used by
  `benchmarks/src/ecs.bench.ts:45` and `integration.bench.ts:93`.

Not yet announced:

- **`springIn`, `springOut` and `springInOut` (#176)** are Back curves under a spring's name
  (`packages/math/src/easings.ts:166-192`). Their JSDoc already says so, but they carry no
  `@deprecated`.
  - `springIn` and `springOut` call `easeInBack` and `easeOutBack`.
  - `springInOut` repeats `easeInOutBack`'s formula with a different multiplication order, so the
    two round differently once the result is subnormal (`:185-187`).
- **`StatsTracker` (#177)** is an exported class (`packages/debug/src/stats.ts:21`). The repo rule
  prefers plain objects and module functions, and no factory exists yet.
- **`createFocusManager`'s `refocusOnUnregister` (#236)** defaults to `true`
  (`packages/ui/src/focus-manager.ts:58`), so unregistering the focused node moves focus to the first
  node. Pan Tvardowski, which asked for the opposite default, already passes `false`
  (`src/ui/focus-manager.ts:10` there).
- **`ShapeSpec.glow` (#236)** takes `'friendly' | 'hazard' | GlowSpec` (`packages/shapes/src/types.ts:48`).
  The two strings are one game's palette.
  - `'friendly'` is exactly `{ color: friendlyGlowArgb(), width: 3 }`
    (`packages/shapes/src/draw.ts:42-51`, `:66-72`).
  - `'hazard'` draws two 0.5 px rings at `r + 1` and `r + 2` (`draw.ts:53-64`), which no `GlowSpec`
    reproduces.
  - Pan Tvardowski uses `'friendly'` 24 times and `'hazard'` 10 times (`src/visual-spec/bullets.ts`,
    `src/visual-spec/ships.ts`).
- **`drawParticles` (#426)** passes per-particle colour only with `{ color: true }`
  (`packages/particles/src/draw-particles.ts:139`). The opt-in shipped with #425 so that a patch would
  not change what existing calls draw.
- **`AudioContextLike.createBufferSource()` (#178)** returns a node synchronously
  (`packages/audio/src/audio-manager.ts:59`), and `music.ts:101` and `sfx-pool.ts:86` use it at once.
  - `react-native-audio-api` 0.11.7's web context returns a `Promise` instead
    (`src/web-core/AudioContext.tsx:114` in that package), so it does not typecheck against the
    interface.
  - Pan Tvardowski keeps web audio switched off for this reason (`src/audio/gate.ts:6-18`, D4b).
  - #178 also claimed that `AudioState` misses web states. That did not reproduce: the library's
    `ContextState` is `'running' | 'closed' | 'suspended'` (`src/types.ts:21`), the same three.
- **The Reanimated peer floor (#375)**: `@flare-engine/react` and `@flare-engine/engine` declare
  `react-native-reanimated >=4.0.0` beside `react-native-worklets >=0.7.0`
  (`packages/react/package.json:68-69`, `packages/engine/package.json:82-83`). Reanimated's own
  compatibility table pairs 4.0.x only with worklets 0.4.x; worklets 0.7 needs Reanimated 4.1.
  Verified in #375 against `compatibility.json` at Reanimated `4.7.1`.
- **`SceneManager.pop()` (#179)** destroys the popped scene unless `{ keep: true }`
  (`packages/scene/src/scene-manager.ts:170-180`), an opt-in since 0.4.9. Berek asked for keep as the
  default. No consumer calls the opt-in: Pan Tvardowski, flare-engine-page and Berek have no
  `pop({ keep })` call.

## Decision

`0.5.0` makes the eleven changes in the table, and only these. Each one not yet announced is announced in
one `0.4.x` patch before the cut: a `@deprecated` JSDoc tag naming the replacement on each symbol that
goes, a JSDoc line naming the new default on each default that flips, and a changeset that lists them
all. A change whose announcement has not been published when the 0.5.0 version PR is cut moves to the
next minor instead of shipping unannounced. The pop default (#179) does not flip.

| # | Issue | Package | 0.5.0 change | Announced in |
|---|---|---|---|---|
| 1 | #172 | ecs | `_resetComponentIds` is removed. | 0.4.14 |
| 2 | #173 | ecs | `ComponentDef.id` and `ComponentDef.bit` are removed. The definition object is the key. | 0.4.14 |
| 3 | #173 | ecs | `Query.requiredMask`, `excludedMask`, the constructor and `matches()` leave the public API. Masks are sized per World, and the 32-type cap is lifted. | 0.4.14 |
| 4 | #175 | ecs | `SystemDef._worldFn` is removed. Use `worldFn`. | 0.4.10 |
| 5 | #176 | math | `springIn`, `springOut` and `springInOut` are removed. Use `easeInBack`, `easeOutBack` and `easeInOutBack`. | the announcement patch |
| 6 | #177 | debug | The `StatsTracker` class is removed. Use `createStatsTracker()`, which the announcement patch adds and which has the same members. | the announcement patch |
| 7 | #236 | ui | `createFocusManager`'s `refocusOnUnregister` defaults to `false`. | the announcement patch |
| 8 | #236 | shapes | `glow: 'friendly'` and `glow: 'hazard'` are removed. A `GlowSpec` takes their place. | the announcement patch |
| 9 | #426 | particles | `drawParticles`' `color` option defaults to `true`. | the announcement patch |
| 10 | #178 | audio | `AudioContextLike.createBufferSource()` returns `AudioBufferSourceNodeLike \| PromiseLike<AudioBufferSourceNodeLike>`. | the announcement patch |
| 11 | #375 | react, engine | The `react-native-reanimated` peer floor rises to `>=4.1.0`. | the announcement patch |

How each change is made:

- **Row 3, the mask representation.**
  - A World holds as many 32-bit words per archetype as its registered types need. Up to 32 types,
    that is one word, compared exactly as today.
  - Masks and the `Query` constructor are internal. The published types do not carry them, and "how
    many words" is not part of the contract, so a later ceiling raise is not a breaking change.
  - `ComponentDef.word` (the sketch at `docs/plans/roadmap-post-flip.md:70-73`) is not added.
- **Row 3, the cost budget.**
  - Track A, the allocation and draw counters in `.perf-baseline.json`, stays unchanged.
  - Track B: the existing `ecs.step` and `ecs.churn` scenarios, all at 32 types or fewer, stay within
    10% of their medians on the pinned desktop lane, measured in the same capture session against
    `main`.
  - A new scenario with more than 32 types is recorded, not budgeted.
  - ecs is tier 1, so every bench lane is recaptured after the change.
- **Row 8, the migration.**
  - `'friendly'` becomes `{ color: friendlyGlowArgb(), width: 3 }`, which draws the same pixels.
  - `'hazard'` becomes `{ color: hazardGlowArgb(), width: 1 }`, which uses the same colour and about
    the same amount of ink, but is one ring whose inner edge sits about 1.5 px further out.
  - `friendlyGlowArgb`, `hazardGlowArgb`, `applyFriendlyGlow` and `applyHazardGlow` stay exported.
    `applyHazardGlow` still draws the two-ring look for a caller that draws imperatively.
- **Row 10, the audio contract.**
  - The SFX pool and music use a source at once when `createBufferSource()` returns one, so native
    and DOM contexts keep today's path, with no extra allocation per play.
  - When it returns a thenable, the voice is claimed synchronously and the source starts when the
    thenable resolves.
  - A source that resolves after its voice was stopped or reused is discarded unstarted.
  - `AudioState` is unchanged.
- **Row 11, the floor.** Both manifests and `check:peers` agree on `>=4.1.0`. `@flare-engine/ui-fx`
  already declares `>=4.7.0` and is unaffected.

## Consumer impact

- **Who breaks.** These are the known consumers, checked on 2026-11-25:
  - **Pan Tvardowski**
    - Row 8: 34 `glow` strings in `src/visual-spec/bullets.ts` and `src/visual-spec/ships.ts`.
    - Row 10: its own call sites, if it reads `createBufferSource()` through the engine's type. Today
      it does not, because web audio is switched off.
    - Not affected by row 7: it already passes `refocusOnUnregister: false`.
  - **flare-engine-page**
    - Its `FakeContext` (`src/components/demos/audio/fake-context.ts:21`) extends `AudioContextLike`.
      It returns a node synchronously, which still satisfies the widened return type.
    - Its DOM adapter is typed with its own `DomBufferSourceLike`. It is expected not to break; the
      0.5.0 bump confirms it.
  - **Berek**: no code that touches the set.
  - **Unknown consumers** break wherever they use a removed symbol, or rely on a default that flips.
- **What they see.**
  - **Compile errors**: a removed symbol (rows 1-6); a `glow` string (row 8); a call that uses
    `createBufferSource()`'s result as a node through `AudioContextLike` (row 10).
  - **A peer warning on install**: Reanimated 4.0.x (row 11).
  - **Silently different behaviour, which needs the most care:**
    - **Row 7.** When the focused node unmounts, focus becomes `null` instead of moving to the first
      node. Keyboard and gamepad users who relied on the jump see no focused control until they press
      next or previous.
    - **Row 9.** Emitters with a non-white `startColor` or `endColor` start drawing tinted. With a
      `SpriteBatch`, a `drawParticles` call becomes one run per image, no longer merged with
      neighbouring uncoloured sprites. A custom `flush` or `DrawSurfaceLike` that ignores `colors`
      draws particles at one alpha, or fully opaque.
    - **Row 8, `'hazard'` only.** The ring moves about 1.5 px outward.
- **Migration.**

  | Row | Edit |
  |---|---|
  | 1 | Delete the call. Each `World` keys storage by the definition object, so tests need no reset. |
  | 2 | Key by the `ComponentDef` object, for example in a `Map<ComponentDef<unknown>, …>`. Never persist `id`. |
  | 3 | Build queries with `world.query()` or `world.queryBuilder()`, and test membership with `query.has(entity)`. |
  | 4 | Replace `._worldFn` with `.worldFn`. |
  | 5 | Replace `springIn`, `springOut` and `springInOut` with `easeInBack`, `easeOutBack` and `easeInOutBack`. They are the same curves; `springInOut` differs only in how it rounds subnormal results. |
  | 6 | Replace `new StatsTracker(…)` with `createStatsTracker(…)`. |
  | 7 | Pass `createFocusManager({ refocusOnUnregister: true })` to keep the old behaviour. |
  | 8 | Replace the strings as given under Decision, above. |
  | 9 | Pass `{ color: false }` to keep the old draw. |
  | 10 | `await` the result, or narrow it, wherever your code calls `createBufferSource()` itself. |
  | 11 | Install `react-native-reanimated` 4.1 or newer. Expo SDK 58 already pins 4.7.1. |

- **Why now.** 0.5.0 is the planned minor (`versioning-and-announcements.md`, "Reserved numbers").
  Each item already waits on it, and the announcement patch has to publish before the cut, or its
  rows slip to 0.6.0. Accepting this ADR now gives that patch its list.
- **Posting obligation.** This ADR is `breaking`, so when it is accepted the obligation is recorded
  on #174. That issue also carries ADR-0002's posting. The 0.5.0 root `CHANGELOG.md` entry gets the
  migration table above.

## Alternatives considered

- **One ADR per issue.** This would mean ten documents with the same context, the same release, and
  one posting obligation between them. It would also make the 0.5.0 changeset cite ten numbers.
  A single ADR that lists each change keeps the record in one place. Its rows can still be split off,
  by superseding the row, if one of them needs its own reversal.
- **Remove only `'friendly'` (row 8)**, since its migration is exact, and keep `'hazard'` until
  `GlowSpec` can draw two rings. That keeps half of one game's palette in the engine for a
  difference of about 1.5 px. Rejected by the owner on 2026-11-25.
- **Always return a `Promise` from `createBufferSource()` (row 10).** That gives one code path, but
  every play on native allocates a promise and starts a microtask later. Rejected.
- **Document a Reanimated, worklets and RN support matrix instead of raising the floor (row 11).**
  The declared range would keep admitting a pairing that upstream does not support, and nothing at
  install time would say so. Rejected.
- **Flip `pop()` to keep by default (#179).** Every popped scene would stay initialized until it is
  pushed again or the manager is destroyed. An app that pushes and pops many distinct scenes would
  retain all of them. No known consumer has used the opt-in since it shipped in 0.4.9. Declined, and #179
  closes with this ADR as its reason.
- **Lift the 32-type cap with a fixed four-word (128-type) mask (row 3)**, the original #173 plan.
  "Four words" would then be part of the contract, so the next raise would be its own breaking minor.
  Rejected in #173's 2026-11-17 scope additions.

## What would reverse this

- **A row's announcement misses the 0.5.0 version PR.** That row moves to the next minor, and the
  0.5.0 changeset does not name it. This is not a reversal of the decision, only of its timing.
- **The row 3 budget fails**, meaning an existing `ecs.step` or `ecs.churn` median is more than 10%
  worse at 32 types or fewer. The representation is reopened before 0.5.0. Rows 1 and 2 can still
  ship without it.
- **A consumer starts using `pop({ keep: true })` on most of its pops.** Then #179's question is
  asked again, for a later minor.
- **`GlowSpec` gains a way to draw more than one ring.** Then the `'hazard'` look gets an exact
  migration recipe, written into the shapes README; no reversal is needed.
- **`react-native-audio-api` makes `createBufferSource()` synchronous on the web.** The union stays,
  since it is the wider type, and the thenable path is kept for other async contexts.
