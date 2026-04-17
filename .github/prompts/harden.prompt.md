---
description: "Phase 7 — Hardening: audit all packages against API spec, find gaps, fix bugs, add integration tests"
agent: builder
---

# Phase 7 — Hardening

## Step 1 — Audit each package against API spec

1. Read `docs/design/api-specs.md` — the full spec
2. Read `docs/references/builder-reference.md` — current state
3. For each package (bottom-up by layer):
   - Read every source file in `packages/<name>/src/`
   - Compare implementation against the API spec table
   - List any **gaps** (missing methods, missing edge case handling, wrong signatures)
   - List any **deviations** (behavior that differs from spec intent)
   - List any **code smells** (allocations in hot paths, `any` usage, missing type safety)

State all findings before fixing anything. Example:

```
@flare/physics:
  - GAP: raycast() missing maxDistance clamping when maxDist <= 0
  - DEVIATION: CollisionWorld.step() doesn't emit onTriggerExit for removed entities
  - SMELL: Vec2 allocation in narrowphase per-pair check
```

## Step 2 — Fix gaps and bugs

For each finding:

1. Write a failing test that exposes the gap/bug
2. Fix the implementation
3. `cd packages/<name> && bun test` → all pass (old + new)
4. Move to next finding

Do NOT change working behavior. Only fix actual gaps, bugs, and spec violations.

## Step 3 — Cross-package integration tests

Create `packages/engine/tests/integration.test.ts` that exercises multiple packages together:

1. **ECS + Physics**: create world, add entities with Position + Collider, step physics, verify collision signals fire
2. **ECS + Animation**: create entity with SpriteAnimator, step world, verify frame advances
3. **ECS + Render**: create entities with Position + Sprite, verify SpriteBatch receives correct draw calls
4. **Scene lifecycle**: create SceneManager, transition between scenes, verify enter/exit/update hooks fire in order
5. **Full loop**: GameLoop driving World.step() + CollisionWorld.step() + TweenManager.update() in a single frame

Each test should be self-contained — no real Skia canvas, mock what's needed.

## Step 4 — Memory & allocation audit

For each hot-path module (`ecs`, `physics`, `particles`, `render`, `math`):

1. Review update/step/draw functions for `new` keyword, array literals `[]`, object spread `{...}`, or `.map()/.filter()` in per-frame code
2. Flag any allocation that occurs per-frame or per-entity
3. Fix by pre-allocating, using output parameters, or pooling
4. Add a comment `// zero-alloc: <reason>` where non-obvious

## Step 5 — Verification gate

1. `bun run typecheck` → zero errors
2. `bun run lint` → zero errors
3. `bun run build` → all packages build
4. `bun run test` → all tests pass
5. Update `docs/references/builder-reference.md` — mark Phase 7 as **DONE**
