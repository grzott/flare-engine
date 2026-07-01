# Game Migration Audit — engine 0.2.x → Pan-Tvardowski + Berek (2026-07-01)

Down-leg of [extraction-audit-2026-06.md](extraction-audit-2026-06.md) (Arc XPACK): now the engine
ships the lifts, the games delete their local copies and consume the engine import. Companion to the
extraction audit; this doc is the game-consumption record + forward queue.

**Engine version: `0.2.1`** (published npm, all 40 packages lockstep). Re-verified vs `0.2.0`: the
only src change touching a switch candidate was `localization/format-timestamp.ts` (JSDoc-only, no
behavior change); `physics/solid-grid`, `tilemap-renderer`, `math`, `ecs`, `a11y`, `storage` src
unchanged. `0.2.1` also reclassified `render-web` to a Layer-4 web bridge + added a downward-only
dep/tier CI guardrail + dropped 12 phantom deps — none of which affect the games.

Prereq wall (now cleared for both games): `^0.1.0` ceilings `<0.2.0`; games bumped to `^0.2.1`.
Private-registry install needs `NPM_TOKEN` — sourced from `~/.npmrc`'s granular token
(`export NPM_TOKEN=$(sed -n 's#^//registry.npmjs.org/:_authToken=##p' ~/.npmrc | head -1)`), else
`bun install` returns 404 on the restricted `@flare-engine/*` packages.

`simulation` + `render-web` have NO game consumer (flare-engine-page only) — not added.

---

## DONE — 2026-07-01

### B1 — Berek → engine 0.2.1 (gate green: typecheck 0 / lint clean / 13 tests pass)
- Bumped 6 deps `^0.1.0`→`^0.2.1` **and added `@flare-engine/physics@^0.2.1`**; `bun install` regen'd `bun.lock`.
- Deleted `src/movement.ts`; `App.tsx` + `tests/movement.test.ts` now import `buildSolidGrid` /
  `isBlockedAABB` / `moveAndSlideInto` from `@flare-engine/physics`. Collision math byte-identical;
  call sites rewritten to the `Into`/out-param form (`pos` passed as `out` preserves in-place move).
- `App.tsx` tilemap render path: hand-rolled `draw()`+flush+`drawRaw` re-queue → `TilemapRenderer.drawInto(gameCtx.camera, gameCtx.batch)`.

### P0 — PT range bump (gate green: typecheck 0 / lint 572 / 2055 tests / balance clean / locale 505 parity)
- All 31 `@flare-engine/*` deps (incl. `cli` devDep) `^0.1.0`→`^0.2.1`; `bun install` regen'd `bun.lock`. No code change.

### P1 — PT Tier-1 safe swaps (gate green: typecheck 0 / lint clean / 2055 tests / balance clean / locale clean)
Three byte-identical dedups (local functions kept as thin domain wrappers delegating to the engine —
call sites + config bindings untouched):
- `fx/destruction-pool.ts:pickDestructionVariant` → `math.seededIndex(seed, def.variants)` (byte-identical lowbias32).
- `systems/economy/risk.ts` reward cluster → `math` `reward.ts`: `advanceChain`→`advanceWindowedStreak`,
  `chainLapsed`→`windowExpired`, `grazeRemainingThisSec`→`remainingInWindow`, `chainBonus`/`pointBlankBonus`→`cappedBonus`.
- `save/preview.ts:formatLastPlayed` → `localization.formatTimestamp` (passes `'en-US'`/`'pl-PL'` since
  `LocaleCode = string`, so output byte-identical to the prior inline `Intl.DateTimeFormat`).

**Deferred from P1 (discovered non-trivial on read — NOT laziness):**
- `systems/integrate.ts` → `ecs.createMovementSystem`: logic byte-identical, but PT calls `integrate`
  **imperatively** at `scenes/play/update.ts:642` with an external query, while `createMovementSystem`
  returns a `SystemDef` for a scheduler. Adopting it restructures the hottest loop's integration step
  (homing runs "just before integrate" — explicit ordering the imperative form encodes) for a 12-line
  win. Keep local; owner-decide if the `SystemDef` adoption is wanted.
- `src/agent-qa/contrast.ts` → `a11y.audit`: not real duplication — PT's module is a hex+domain adapter
  over `math.Color` (which `a11y.audit` also just wraps), and the API shapes differ (hex vs `Color`,
  `fail:boolean` vs `WcagLevel`). Swapping adds indirection without removing logic. Keep local.

---

## Forward queue (owner-gated)

### P2 — PT Tier-2 progression (adds `@flare-engine/progression@^0.2.1`)
`config/ship-upgrades.ts`+`effectiveShipStats` → `createUpgradeTrack`+`resolveStats`; `codex/shards.ts`
(+`entries.ts`) → `createCollectibleRegistry`; `save/migrate.ts` sanitizers → `storage.san`. Unfrozen
paths only. Gate with price-parity + codex goldens.

### P3 — LANDMINES (each its own owner-decision design+build)
- `save/store.ts` → `storage.createDocumentStore`: raw-JSON→envelope **wipes live saves** without a
  dual-format parse shim.
- `systems/economy/drops.ts` → `progression.createDropTable`: PT's `{none,weight:6}` row shifts drop
  shares (engine has no `none` slot) + touches frozen `DROP_TABLE`/`DROP_PITY` + `ALLOW_BALANCE_CHANGE`.
  The SESSION_LOG "fizzle fix" was an engine-side re-impl defect — PT was already correct.
- `shop.ts` pricing: math identical but touches frozen `PRICE_BASES` (`ALLOW_BALANCE_CHANGE`).

### Keep-local (verified no-swap)
`homing.ts` (ULP-fragile, worse API), `dev-mode.ts:isDevMode` (`globalThis` variant is test-safe;
engine's bare `__DEV__` throws under bun), `cleanup.ts` lifetime/bounds (deferred-removal ordering),
exhaust/shadow/boss-part `Follower` (3 divergent shapes), unlock DAGs, `hud/useOverlayFade`/`use-count-up`
(engine drops RN native-driver), `resolveTier` (no consumer yet), plus the two P1-deferred items above.

### E1 — engine-side (flare-engine)
`render-web` XP2 row claims `createWebFrameRenderer` is exported; `packages/render-web/src/index.ts`
exports only `loadCanvasKit`/`createWebSurface`/`createWebSkiaModule`/`createPostFxSurface`. Export it
or correct the row. Docs/exports only.
