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
Private-registry install needs the `NPM_TOKEN` env var set to the restricted-registry auth token
(owner-provided; specifics kept out of the repo), else `bun install` returns 404 on the restricted
`@flare-engine/*` packages.

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

### P2 — PT Tier-2 progression swaps (gate green: typecheck 0 / lint 572 / 2059 tests / locale 505 / balance clean)
Adds `@flare-engine/progression@^0.2.1`. Two byte-identical dedups landed; the `resolveStats` + codex
pieces deferred keep-local (P1-style, discovered non-trivial on read).
- `config/ship-upgrades.ts` price/canAfford/buy → per-hull `createUpgradeTrack`
  (`.price`/`.canBuy`/`.buy`). Byte-identical below cap; `price()` returns `Infinity` at cap (dead —
  `HangarOverlay` shows `maxed` there). +4 parity tests.
- `save/migrate.ts` `parseSettings` + `parsePrivacy` → `storage.san.object` (`san.boolean` /
  `san.clamped` / `san.literal`); every fallback == the matching `defaultSettings`/`defaultControls`
  field. Removed dead `parseControls`/`clamp01`/`isAssistTier`/`ASSIST_TIERS`. Dynamic-key record +
  dedup-list parsers kept local (`san.object` fixed-keys; `san.arrayOf` no-dedup).

**Deferred from P2 (keep-local, P1 criterion):**
- `effectiveShipStats` → `resolveStats`: PT folds 3 tracks into one shared {hp,speed,fireRate};
  `resolveStats` is single-track — matching it needs chained constant-lambda calls (indirection > win).
- `codex/shards.ts` → `createCollectibleRegistry`: `shardCodexUnlocksForZoneClear` is a stateless
  delta-calc over a mixed id list; the registry starts empty, throws on unknown ids, and doesn't model
  the z8 campaign-complete capstone fallback. `entries.ts` kept local per owner.

---

## Forward queue (owner-gated)

### P2 — DONE 2026-07-01 (see the DONE section above). The `resolveStats` + codex-registry pieces stayed keep-local.

### P3 — resolved (2026-07-01)

**Classification correction:** shop + drops were flagged as needing `ALLOW_BALANCE_CHANGE`, but that
was wrong — they *read* frozen constants (`PRICE_BASES`, `DROP_TABLE`/`DROP_PITY`), they do NOT modify
`balance.ts`, and the freeze only trips on modification. Neither ever needed the flag.

- **`shop.ts` pricing → `createUpgradeTrack` — DONE (gate green 2059 tests, balance-freeze clean, NO flag).**
  Mirror of the P2 ship-upgrades swap: per-track `createUpgradeTrack` built from `PRICE_BASES`
  (cap `MAX_UPGRADE_LEVEL`); `shopPrice`/`canAfford`/`purchase` delegate. Byte-identical below cap
  (`price→Infinity` at cap is dead — Workshop shows `maxed`). Existing `economy-shop`/`workshop` tests
  are the parity lock. UNCOMMITTED (git blocked this session).
- **`drops.ts` → `progression.createDropTable` — KEEP LOCAL (adopting degrades the code).** The engine
  algorithm is already exactly PT's `rollDrop` (pity→chance→weighted-pick over a `none`-inclusive table),
  but its `DropPity<K>` is a generic `Record<K,number>` vs PT's domain `{medikitDry,bombDry}` — swapping
  forces either a pity-shape reshape rippling into run-state/`update.ts`/save, or an allocating per-roll
  adapter + a spurious `none` pity counter, for ZERO dedup benefit and real pity-order/distribution risk.
  Proven local code wins. (Distribution is preserved only by keeping `none` as an entry — the adapter not
  worth building.)
- **`save/store.ts` → `storage.createDocumentStore` — the one real remaining landmine (save-format, NOT
  balance).** raw-JSON→`{version,data}` envelope **wipes live saves** without a dual-format parse shim +
  real-save QA. Owner-decision.

### Keep-local (verified no-swap)
`homing.ts` (ULP-fragile, worse API), `dev-mode.ts:isDevMode` (`globalThis` variant is test-safe;
engine's bare `__DEV__` throws under bun), `cleanup.ts` lifetime/bounds (deferred-removal ordering),
exhaust/shadow/boss-part `Follower` (3 divergent shapes), unlock DAGs, `hud/useOverlayFade`/`use-count-up`
(engine drops RN native-driver), `resolveTier` (no consumer yet), plus the two P1-deferred items above.

### E1 — engine-side (flare-engine)
`render-web` XP2 row claims `createWebFrameRenderer` is exported; `packages/render-web/src/index.ts`
exports only `loadCanvasKit`/`createWebSurface`/`createWebSkiaModule`/`createPostFxSurface`. Export it
or correct the row. Docs/exports only.

---

## Save-subsystem redesign — DONE 2026-07-01 (owner ruling: drop back-compat, wipe is fine)

Owner authorized wiping saves (PT is dev-only; wipe = clear app data), unblocking a clean redesign with
no migration/legacy-bridge workarounds. Gate green throughout (typecheck 0 / lint 571 / 2048 tests /
balance clean / locale 505). UNCOMMITTED (git blocked this session).

- **SV1 — dropped the version-migration chain.** `src/save/migrate.ts` (658 lines) → `src/save/parse.ts`
  (396): deleted the 12-step v1→v13 `MIGRATIONS` chain, the `NAMING_MIGRATION_IDS` folk→semantic remap,
  `backfillClearedCells`, and `defineMigrationChain`/`runMigrations` (~262 lines of pure back-compat).
  KEPT the lenient current-shape validators; `fromUnknown` = `structuralParse` only. Deleted
  `save-migrator.test.ts`; renamed `migrate-helpers.test.ts` → `parse-helpers.test.ts`.
- **SV2 — adopted `storage.createDocumentStore` in `store.ts`.** `{version,data}` envelope +
  `__flare_doc_version` + `parse: fromUnknown`; first-run OS seed handled cleanly (detect empty key
  before load, async-seed after). Legacy raw saves read as non-envelope → reset to default (the intended
  one-time wipe). Preserved the full ~50-method `SaveStore` interface, so all ~28 consumer tests stayed
  green. Updated `save.test.ts` (+envelope-format golden), `first-run-os-seed.test.ts` (raw-reset),
  `settings-roundtrip.test.ts` (field-defaulting via `fromUnknown`).
- **SV3 — dev save backup/transfer.** `SaveStore.exportSave()`→`store.exportJSON()`,
  `importSave(json)`→`store.importJSON` + apply. Dev-console handle in `providers.ts` guarded by
  `isDevMode()`: `__ptSave.export()` / `__ptSave.import(json)` (no clipboard dep — a clipboard button
  would need `expo-clipboard`). +round-trip test.

Vestigial `SaveFile.version` kept (envelope owns real versioning) — low-churn, trivially droppable.
Deferred keep-locals unchanged by save-freedom (non-save reasons): drops→createDropTable,
effectiveShipStats→resolveStats, codex/shards→createCollectibleRegistry.
