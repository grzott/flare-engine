# ADR-0006: `SpriteDrawCommand`'s new blend and flip fields are required, and the break lands before the flip

- **Status**: Accepted <!-- owner, 2026-09-08 -->
- **Date**: 2026-09-08
- **Consumer impact**: breaking
- **Release level**: minor

## Context

Verified at HEAD `2ae80cc` on 2026-09-08.

Row **OSS-M10** (`docs/plans/road-to-oss-2026-09.md:794-806`) adds additive blending, per-axis
sprite mirroring, a 9-slice helper and opt-in culling to `packages/render`. Blend and flip both need
to participate in `SpriteBatch.flush()`'s batch key, so they must live on `SpriteDrawCommand`.

`SpriteDrawCommand` is a **published type** — `packages/render/src/index.ts:54` exports it, and
`@flare-engine/engine` re-exports the render barrel. Every field it already carries is required,
including the ones that have a natural default: `alpha: number` (documented default 1) and
`effect: AnySpriteEffect | undefined` (explicit `undefined` rather than an optional marker). That
is a deliberate house style, not an accident — it forces a producer to state its intent and lets
`flush()` compare keys without normalising.

Adding `blend`, `flipX` and `flipY` as required fields therefore matches the interface's own style
and keeps every read site free of `?? 'normal'` normalisation. It also breaks any consumer that
constructs a `SpriteDrawCommand` object literal.

Two facts bound how much that break costs:

1. **All 41 scoped packages are published `restricted`** and nothing is anonymously installable
   before the October flip, so a break costs a migration we control rather than a semver event
   against strangers. `AGENTS.md` states the posture directly: pre-flip, the answer to a
   minor-or-breaking decision "is often yes".
2. **The break is only reachable by a producer, not a consumer.** Code that *reads* commands — a
   custom frame renderer iterating `batch.commands` — compiles unchanged when fields are added.
   Only code that *builds* a command literal breaks. Inside this repo that is `SpriteBatch._acquire`
   alone; outside it, no known consumer does it, because `SpriteBatch.draw()` is the supported way
   to produce commands.

The window closes on **October 5**. After the flip on October 20 the same edit is a `major`, and a
`major` under lockstep publishes `1.0.0` across all 41 packages, which is reserved for launch.

## Decision

`SpriteDrawCommand` gains `blend: 'normal' | 'additive'`, `flipX: boolean` and `flipY: boolean` as
**required** fields, matching the interface's existing style, and OSS-M10 lands before the October 5
freeze so the break is absorbed while the scope is still `restricted`. The ergonomic consumer-facing
surface — `SpriteData` in `render-system.ts` — takes the same three as **optional** fields, because
that type is authored by game code every frame and a required field there would be a real ergonomic
regression for no gain.

## Consumer impact

- **Who breaks.** Only code that constructs a `SpriteDrawCommand` object literal. In this repo that
  is `SpriteBatch._acquire()`, which the same row updates. **Verified 2026-09-08:** a grep for `SpriteDrawCommand`
  across every sibling repo checked out in this workspace — `Pan-Tvardowski`, `Berek`,
  `flare-engine-page`, `pan-tvardowski-lore`, `_pt-extracted-archive` and both `_fe-s5-rehearsal`
  copies — returns **zero hits**. Every consumer goes through `SpriteBatch.draw()` / `SpriteData`.
  `grzott-portfolio` is not checked out here and was not scanned.
- **What they see.** A compile error naming the three missing properties. This is the good failure
  mode: it is loud, it points at the exact line, and there is no silent behaviour change hiding
  behind it. Nothing renders differently for code that already compiles.
- **Migration.** Add `blend: 'normal', flipX: false, flipY: false` to the literal. Those are the
  values the previous behaviour was equivalent to, so the edit is mechanical and cannot change
  output.
- **Why now.** Because "now" is the only time it is cheap. Post-flip it costs `1.0.0`. The row was
  budgeted P2-cuttable and post-flip-acceptable; this decision moves it to pre-freeze specifically
  so the interface shape is settled before the surface is frozen. If the row cannot land by Oct 5,
  the correct fallback is the optional-field variant shipping post-flip as a patch — **not** slipping
  the freeze.

**Posting obligation.** `AGENTS.md` attaches one to an accepted breaking ADR: `flare-engine-page`
and the portfolio must reflect it. Scope here is small — the render surface changed additively for
every documented path — but the obligation is not waived by being small.

## Alternatives considered

- **Optional fields (`blend?`, `flipX?`, `flipY?`).** Genuinely additive, `patch` level, no ADR, no
  freeze deadline. Rejected: it costs a `?? default` at every read site including
  `flush()`'s hot key comparison, and it leaves `SpriteDrawCommand` permanently inconsistent with
  its own existing fields — `alpha` and `effect` are required-with-a-default and these three would
  not be. Accepting a permanent style split to avoid a break that has no victims is the wrong trade
  while the scope is still `restricted`. This remains the correct fallback if the row misses Oct 5.
- **Split the row: land the interface extension and blend pre-freeze, defer flip / 9-slice /
  culling.** Locks the shape in while the window is open at lower cost. Rejected because the builder's
  estimate is 1.5 sessions against a comfortable 2, and a split leaves `flipX`/`flipY` on the
  interface with no implementation behind them — a worse published surface than either endpoint.
- **A separate `SpriteDrawFlags` side-channel** keyed alongside the command. Rejected without much
  deliberation: it keeps `SpriteDrawCommand` frozen at the cost of two structures that must stay
  index-aligned, which is a correctness hazard in a zero-alloc pooled path.

## What would reverse this

- **OSS-M10 does not land by October 5.** Then the break is no longer cheap, and the optional-field
  variant is correct. This ADR is superseded rather than deferred, because its whole argument is the
  window.
- **An external consumer that constructs `SpriteDrawCommand` literals is discovered.** The workspace scan above covers every repo
  checked out here but not `grzott-portfolio`. If one turns up there the migration is one mechanical
  edit per literal, not a reversal — but if the count is large, the optional variant wins.
- **The freeze date moves earlier.** Same reasoning as the first item.
