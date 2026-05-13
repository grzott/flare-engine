# Todo

Next work, in order. Pick top → `/start`. When done → `/close`. History appends to `SESSION_LOG.md`.

## Active

- **PT — 1D polar shadow maps (lighting §2b)** — depends on §2a (now landed). Smok's rect weapons cast shadows from the rim light: render occluders to small FBO via `renderShapesToImage` → reduce to 1D shadow map per light (256 angles, distance-to-nearest-occluder) → sample in polar space during the rim-light pass via `atan2(fragPos − lightPos)`. Per [lighting-2-5d.md §Validation Plan step 2](../design/lighting-2-5d.md#validation-plan-pt-first): code stays local to PT until step 3 promotion. References: [LWJGL 2D Pixel-Perfect Shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows), [Defold sample](https://github.com/defold/sample-lights-and-shadows). Scope: `apps/pan-tvardowski/**`.

## Future tracks

See [roadmap.md "Future tracks"](roadmap.md#future-tracks-when-meta-refactor-closes). None is the default. Options:

1. **Ship PT** — store accounts + IAP + legal + screenshots + submits (~$124 + weekend of work).
2. **Second game** — top-down or deck-builder in a separate private repo.
3. **Engine feature** — e.g. 2.5D lighting via SkSL RuntimeEffect.
4. **Pre-launch polish** — Phase 11.11 / 11.12 / 11.13 (landing MP4, docs site, RC publish, EUIPO trademark).

## Done

- **Engine — bridge canvas shape primitives + occluder render helper (lighting §2a)** (2026-05-13). Added named `SkOffscreenCanvasLike` interface (renamed from planned `SkCanvasLike` to avoid collision with the parallel `@flare-engine/assets` type). Extended `SkSurfaceLike.getCanvas()` return type. Added `ShapeRect`, `RenderShapesOpts`, `renderShapesToImage(skia, opts)` to `packages/react`. 8 new tests, +8 in react package (83 → 91). Unblocks §2b.
- **PT — rim light prototype (lighting §1)** (2026-05-13). PT-local SkSL fullscreen pass, analytical hemisphere normals over Smok Krzemionkowski boss disc, warm amber rim light orbiting overhead at altitude -60 / radius 80. Wired through structural `PostFxRuntimeLike` (no engine package changes). FPS watchdog disables on <55fps. 13 pure-JS tests for uniform packing + normal + attenuation. Next gate: §2 (1D polar shadow maps on rect weapons) and on-device perf measurement.
- **M3 — meta-refactor close** (2026-05-13). Killed Copilot mirrors (`.github/agents`, `.github/prompts`, `.github/copilot*`). Collapsed 11 instructions → 2 in `docs/conventions/`. Moved 3 surviving skills to `.claude/skills/`. Lifted PT rules into `apps/pan-tvardowski/AGENTS.md`.
- **M2 — meta-refactor** (2026-05-13). Cut 6 agents + 6 commands + 35 flare-* skills + 39 .claude/skills stubs. Built `verify.sh` + `/start` + `/close`. Simplified `session-start.sh` hook.
- **M1 — plan consolidation** (2026-05-13). Created `roadmap.md` + `todo.md`. Deleted 4 plan docs + 3 reference docs. Trimmed CLAUDE.md + AGENTS.md.
