---
description: Start the next pending session from docs/plans/sessions.md. Routes to engine-builder or game-builder by scope tag. Verifies state, presents implementation plan, stops for user approval before touching files.
argument-hint: "[#session-id]"
---

# /session-start

Begin a session from [docs/plans/sessions.md](../../docs/plans/sessions.md).

## Step 0 — Pick session

If the user passed `#N`, target that row. Else, among `pending` rows whose `depends on` is satisfied:

1. **Skip Deferred** — rows whose `goal` matches a Deferred prefix below are owner-managed manually; picker never surfaces them.
2. **Pick lowest P0** if any pending row matches a P0 prefix.
3. Else **pick lowest P2** if any pending row matches a P2 prefix.
4. Else **pick lowest** of the remaining pending rows (P1 default — engine→PT presentation chains, polish, anything not in P0/P2/Deferred).

If no pickable row → report "no pending sessions — run /plan-sessions" and stop.

### Tier table (matched by exact-prefix on `goal` text)

| Tier | Match prefixes | Picker |
|------|---------------|--------|
| **P0 — visual-runtime closure** (current focus) | `Postfx-Compositor`, `PT-PostFx-Wire`, `PT-Boss-PaletteShift-Wire`, `PT-HUD-DataDriven` | **active first** — these 4 close the postfx-not-rendering + boss-palette-unwired + HUD-hardcoded gaps surfaced in session #103 audit. |
| **P2 — quality + dev-tooling** | `Hermes-`, `PT-LocaleQA-Fix`, `PT-DocSync-`, `PT-Smoke-`, `PT-DebugHUD`, `PT-UnskipCloudSmoke` | active after P0 drains, picked AFTER P1 default (dev-tooling has lowest priority among active tiers). |
| **P1 — default** (no explicit prefix) | anything else not matching P0 / P2 / Deferred | active after P0 drains, picked BEFORE P2 (engine→PT chains live here: `Scene-`, `Render-`, `Animation-`, `PT-EasedTransitions`, `PT-PerlinShake`, `PT-SigilPulse`, `PT-SlowMo-`, `PT-Z*-ShaderBg`, etc.) |
| **Deferred — manual launch tier** | `PT-Store`, `PT-Legal-`, `PT-Submit-`, `PT-Accounts`, `PT-DataSafety`, `PT-RR-Walk`, `PT-AppIcon`, `PT-Screenshots-`, `PT-Trailer`, `PT-DocsiteLive`, `PT-ClosedTest-Kickoff` | **skipped** — owner runs these directly outside the session loop. Tracked in [`release-readiness-checklist.md`](../../docs/plans/release-readiness-checklist.md). |

**Engine-first** is enforced naturally by the dep graph, not the tier rule: a PT-side wire row's `depends on` column references its engine prerequisite, so the picker only surfaces the engine session first; the wire becomes pickable once the engine session closes.

Rationale: visual-runtime + engine support must ship before launch tasks. Release tier is owner-managed — picker never surfaces those rows. When all P0 + P1 + P2 rows close and the game looks ship-ready on local emulator, owner unblocks the launch tier as a batch.

If the target row is `in_progress` (left over from a previous abandoned attempt), ask the user whether to resume or reset. Do not auto-resume.

## Step 1 — Route by scope

- `[engine]` → delegate to `engine-builder`
- `[game]` → delegate to `game-builder`
- `[mixed]` → delegate to `engine-builder` first (engine half), then hand off to `game-builder` for the game half. Each agent owns its scope; no cross-editing.

## Step 2 — Flip row status

Edit `docs/plans/sessions.md`: flip the row `pending` → `in_progress`. Stamp open date.

## Step 3 — Builder verifies + plans

The builder:
1. Runs state verification per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md).
2. Reads the session row's `goal`, `touched paths`, `gates`, `target commits`.
3. Drafts an implementation plan (files to create/modify, tests to add, risks, dep additions).
4. **STOPS.** Presents the plan. Waits for user approval.

## Step 4 — On approval

Builder implements exactly what was planned. No drive-by changes. Session does not close here — run `/session-close` when implementation is complete.
