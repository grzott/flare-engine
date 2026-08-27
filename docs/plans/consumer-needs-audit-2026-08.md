# CE-W7 consumer-needs audit (2026-08-25)

Audit of the two consumer-needs docs — [portfolio-collapse-needs-2026-08.md](portfolio-collapse-needs-2026-08.md)
and [pan-tvardowski-needs-2026-08.md](pan-tvardowski-needs-2026-08.md) — against engine HEAD at 0.3.0.
20 asks, one agent each, every **defect** claim then handed to two independent skeptics whose default
was that the claim is wrong. 38 agents, 0 errors.

This file is the SoT for what was decided and why. The consumer docs remain the SoT for what the
consumers asked; nothing here edits them.

## Version line

Fixes land on **0.3.1 (patch)**, not 0.4.0. Both consumers pin `^0.3.0`, which for a 0.x version means
`>=0.3.0 <0.4.0` — a minor bump would produce exactly the release neither consumer would receive.
`scripts/check-changeset.mjs` gates changeset *coverage*, not bump level, so patch changesets pass the
gate. The "always minor" convention exists to avoid an accidental major (which forces 1.0.0); patch is
equally safe on that axis. 0.4.0 remains the October freeze cut.

## Refuted — build nothing

### PORT-2.4 deep-stack tunnelling is NOT a solver bug

The portfolio's only correctness item. Both skeptics reproduced independently against
`packages/dynamics/src/world.ts` at HEAD and found no tunnelling at any parameters:

- A sweep of 17 configurations — depth n=5/12/20/30/45/60 at 10 iterations, plus n=60 at
  iterations 5/10/20/40/80 — produced **zero** bodies through the floor.
- Instrumenting every crossing of the floor-top plane: 53 of 60 pieces did end below the floor line,
  and **all 53 had |center.x| >= 107.0 when they crossed, against a floor half-extent of 100.** They
  fell past the *end* of the floor, not through its face.

The doc set its own pass/fail — "If no, it is a solver bug and this is a reproduction." The answer is
no. The consumer's floor is narrower than its debris spread. **Answer the consumer; ship no engine code.**

### PT-10.1 UI packages under a test runner — contract, not defect

PT's top *testing* ask. The mechanism is real and reproduced: every component in `packages/ui/src` and
`packages/ui-shop/src` value-imports `react-native` at module scope, and a bare
`await import('@flare-engine/ui')` dies at `node_modules/react-native/index.js:27` under bun 1.3.11.
But that is the documented peer-dependency contract, and both skeptics showed PT's own stated success
criterion is **already met at HEAD with zero engine source change**. What is missing is a documented
testing recipe, not a code change. Queued as a docs row, not an engine row.

## Corrected — the consumer's proposed fix does not work

### PT-9.1 multi-touch blocker (real) — but Options A and B are both wrong

Traced through RN 0.83.6: finger-2 lands on the bomb, RN begins the shouldSet negotiation at
LCA(joystick, button) = GameView's container View and traverses **upward only**, so the button is never
asked. GameView returns true, the joystick receives a termination request it does not implement
(default-permit), fires `onResponderTerminate` -> release -> vector zeroed. Bomb dead; dash multiplies zero.

- **Option A** (`onResponderTerminationRequest -> false` on both controls) fixes only half — the
  joystick keeps its vector so dash works, but the button still receives nothing and the touch goes
  nowhere. Shipping it alone leaves the reported blocker open.
- **Option B** (re-add `react-native-gesture-handler`) directly reverses two landed, verified
  decisions — OSS-C1 (#236) dropped it as a peer from input/react/engine, OSS-B32 (#255) dropped it
  from all three scaffolder templates after grepping zero usage — and would silently break any
  consumer lacking a `GestureHandlerRootView`, six weeks before the freeze.
- **Option C (adopted)**: route multi-touch through the single responder the engine already owns —
  starting with `packages/react/src/game-view.tsx:246-263` no longer hard-coding pointer id 0, reading
  `Number(e.nativeEvent.identifier)` instead.

## Adopted for 0.3.1

| row | ask | packages | effort |
| --- | --- | --- | --- |
| CW7-1 | PT-9.1 multi-touch via the engine's own responder (Option C) | react, input | M |
| CW7-2 | PT-9.2 `Label` truncation — 4 optional props forwarded to `Text` | ui | S |
| CW7-3 | PT-2.1 / E11 optional `query?` on both cull-system factories | ecs | S |
| CW7-4 | PT-2.2 / E9 widen `uniforms` to `Float32Array \| number[]` | postfx, render | S |
| CW7-5 | PT-2.3 / E10 generation token for the activation stall | scene | S |
| CW7-6 | PT-3.2 collider readback mirroring `Camera2D.getBoundsInto` | physics | S |
| CW7-7 | PT-10.2 `StyleProp<ViewStyle>` across 8 prop declarations | ui | S |

CW7-4 is the highest value-per-line in the set: a real cross-package contradiction fixed at **two
lines** (`packages/postfx/src/runtime.ts:38`, `packages/render/src/frame-renderer.ts:195`), which
deletes an `as unknown as` bridge from a consumer that bans `any`.

CW7-7 widens a published type. Widening is source-compatible for every caller passing a plain
`ViewStyle`; it is only observable to code that *reads* the prop type.

## Queued, not now

Grid/hash broadphase (PT's top gameplay ask, M — the binding limit for a bullet-hell), DYN-3 sleeping,
the timeline recorder donation, `stepUntil`, `shapeBoundsBox`, SFX synthesis, the bench-session
primitive, `SystemDef._worldFn`, camera-surface docs, `createHeadlessContext()` donation, and the
PT-10.1 testing recipe.

## Non-goals

All 20 asks were checked against both consumers' explicit non-goal lists. **None violated one.** The
lists are load-bearing and were passed verbatim to every agent: the portfolio forbids DOM work,
transport UI, a dynamics DOM renderer and rendering of any kind; PT forbids absorbing `visual-spec/`,
the value-budget economy, the Kenney pipeline, its localization, and explicitly does **not** want
`CoroutineManager` fixed or adopted.
