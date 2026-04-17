---
description: "Kickoff Phase 1 — implement @flare/math and @flare/events foundation packages"
agent: builder
---

# Phase 1 — Foundation Packages

Implement `@flare/math` and `@flare/events` — the two zero-dependency foundation packages.

## Before You Start

1. Read the full API spec: `docs/design/api-specs.md` (Layer 0 section)
2. Read the architecture: `docs/design/architecture.md`

## @flare/math

Implement in `packages/math/src/`. One file per concept, in this order (each may depend on the previous):

1. `scalar.ts` — clamp, lerp, inverseLerp, map, degToRad, radToDeg, approxEquals, wrap, pingPong, smoothStep, sign
2. `vec2.ts` — Vec2 as `{ x: number, y: number }` type + static namespace with zero-alloc methods (add, sub, scale, normalize, dot, cross, lerp, slerp, distance, distanceSq, length, lengthSq, angle, rotate, equals, clone, zero, one, up, down, left, right)
3. `rect.ts` — Rect `{ x, y, width, height }` + static methods (contains, intersects, intersection, union, fromPoints, center, expand)
4. `circle.ts` — Circle `{ x, y, radius }` + static methods (contains, intersects, intersectsRect)
5. `transform2d.ts` — Transform2D `{ position: Vec2, rotation: number, scale: Vec2 }` + static methods
6. `mat3.ts` — 3x3 matrix on Float32Array (identity, multiply, translate, rotate, scale, invert, fromTransform)
7. `color.ts` — Color `{ r, g, b, a }` normalized 0-1 + static methods (fromHex, toHex, lerp, multiply, WHITE, BLACK, TRANSPARENT)
8. `easings.ts` — 42 easing functions as named exports (easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, ... through all Robert Penner easings + spring, bounce, elastic variants). Type: `(t: number) => number`
9. `random.ts` — Seeded RNG (mulberry32), randomFloat, randomInt, randomVec2InRect, randomPointInCircle, shuffle
10. `intersection.ts` — Intersection tests: pointInRect, pointInCircle, rectVsRect, rectVsCircle, circleVsCircle, lineVsRect, lineVsCircle, rayVsRect

**Per-module loop** — for each module above:

1. Implement the module
2. Export from `src/index.ts`
3. Write tests in `packages/math/tests/<module>.test.ts` (edge cases: NaN, Infinity, zero, negative, degenerate)
4. `cd packages/math && bun test` → verify pass
5. Fix any failures → re-test until green
6. Move to next module

## @flare/events

Implement in `packages/events/src/`:

1. `emitter.ts` — `EventEmitter<EventMap>` class. Methods: `on(event, handler)`, `off(event, handler)`, `once(event, handler)`, `emit(event, ...args)`, `removeAll(event?)`. Type-safe generics. Returns unsubscribe function from `on`/`once`.
2. `signal.ts` — `Signal<T>` class for single-event pattern. Methods: `add(handler)`, `remove(handler)`, `once(handler)`, `emit(value)`, `clear()`. Returns unsubscribe function from `add`/`once`.

**Per-module loop** — same as math: implement → export → test → verify → next.

Write tests in `packages/events/tests/`.

## Phase Gate

After ALL modules in both packages are complete, run the full verification:

1. `bun run typecheck` → zero errors
2. `bun run lint` → zero errors
3. `bun run build` → 16/16 packages build
4. `bun run test` → all tests pass across both packages
5. Check tsup output: math < 5KB, events < 1KB

## Deliverable

When done, update the "Current State" table in `docs/references/builder-reference.md` to mark math and events as **DONE** with file/test counts.
