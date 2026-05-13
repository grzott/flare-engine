# Todo

Next work, in order. Pick top → `/start`. When done → `/close`. History appends to `SESSION_LOG.md`.

## Active

_(none — pick next from Future tracks)_

## Future tracks

See [roadmap.md "Future tracks"](roadmap.md#future-tracks-when-meta-refactor-closes). None is the default. Options:

1. **Ship PT** — store accounts + IAP + legal + screenshots + submits (~$124 + weekend of work).
2. **Second game** — top-down or deck-builder in a separate private repo.
3. **Engine feature** — e.g. 2.5D lighting via SkSL RuntimeEffect.
4. **Pre-launch polish** — Phase 11.11 / 11.12 / 11.13 (landing MP4, docs site, RC publish, EUIPO trademark).

## Done

- **PT — 1D polar shadow maps (lighting §2b)** (2026-05-13). Smok's rim light now casts shadows from rect weapons + hull-AABB occluder. PT-local: `shadow-map.ts` (256-angle ray-rect reduction via slab method, pre-allocated `Float32Array(256)`), `shadow-rim-sksl.ts` (augmented §1 shader, samples 256×1 child-shader texture via `atan2(fragToLight)` with SHADOW_BIAS), `shadow-rim-runtime.ts` (`ShadowRimRuntime` replaces `RimLightRuntime`, rebuilds 256×1 offscreen texture per occluder update). 3-element occluder array: left weapon, right weapon, hull AABB (half-extent 48). 11 new pure-JS tests (PT 878 → 889). FPS watchdog unchanged. Build 39/39 green. On-device validation needed for child-shader texture path in postfx runtime; HULL_HALF tunable to 36 (inscribed) if too heavy.
- **Engine — lift `readPixels` to `SkImageLike` (lighting §2b prereq)** (2026-05-13). Added required `readPixels(): Float32Array | Uint8Array | null` to `SkImageLike` in `packages/assets/src/texture.ts`. Return type matches RN Skia's `SkImage.readPixels` so real images satisfy the interface structurally; callers narrow with `instanceof Uint8Array`. Updated 5 mock sites across `packages/assets/tests/**` and `packages/react/tests/**`; api-specs.md row updated; 1 new round-trip test in `texture.test.ts` (assets 26 → 29). Unblocks PT §2b.
- **Engine — bridge canvas shape primitives + occluder render helper (lighting §2a)** (2026-05-13). Added named `SkOffscreenCanvasLike` interface (renamed from planned `SkCanvasLike` to avoid collision with the parallel `@flare-engine/assets` type). Extended `SkSurfaceLike.getCanvas()` return type. Added `ShapeRect`, `RenderShapesOpts`, `renderShapesToImage(skia, opts)` to `packages/react`. 8 new tests, +8 in react package (83 → 91). Unblocks §2b.
- **PT — rim light prototype (lighting §1)** (2026-05-13). PT-local SkSL fullscreen pass, analytical hemisphere normals over Smok Krzemionkowski boss disc, warm amber rim light orbiting overhead at altitude -60 / radius 80. Wired through structural `PostFxRuntimeLike` (no engine package changes). FPS watchdog disables on <55fps. 13 pure-JS tests for uniform packing + normal + attenuation. Next gate: §2 (1D polar shadow maps on rect weapons) and on-device perf measurement.
- **M3 — meta-refactor close** (2026-05-13). Killed Copilot mirrors (`.github/agents`, `.github/prompts`, `.github/copilot*`). Collapsed 11 instructions → 2 in `docs/conventions/`. Moved 3 surviving skills to `.claude/skills/`. Lifted PT rules into `apps/pan-tvardowski/AGENTS.md`.
- **M2 — meta-refactor** (2026-05-13). Cut 6 agents + 6 commands + 35 flare-* skills + 39 .claude/skills stubs. Built `verify.sh` + `/start` + `/close`. Simplified `session-start.sh` hook.
- **M1 — plan consolidation** (2026-05-13). Created `roadmap.md` + `todo.md`. Deleted 4 plan docs + 3 reference docs. Trimmed CLAUDE.md + AGENTS.md.
