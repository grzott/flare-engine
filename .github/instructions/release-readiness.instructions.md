---
description: "Release-readiness rules for Pan Tvardowski and any future Flare game shipping to stores. Enforces asset-swap seams, localization parity, IAP catalogue discipline, privacy registry, and post-milestone checklist sync."
applyTo: "docs/plans/release-readiness-checklist.md,apps/pan-tvardowski/**,packages/iap/**,packages/share/**"
---

# Release Readiness Rules

Complements [status-sync.instructions.md](./status-sync.instructions.md). That file governs _status docs_. This file governs _game code + release surface_.

## Asset-swap discipline

1. **No hardcoded asset paths** in `apps/<game>/src/**`. All sprite, audio, and portrait asset paths come from one of three manifests under `apps/<game>/assets/`: `sprites.manifest.json`, `audio.manifest.json`, `portraits.manifest.json`.
2. **Manifest is the swap contract.** Production assets must land at the same manifest keys as placeholders. If a key renames, the manifest version bumps — not the game code.
3. **Placeholder = procedural today, real file tomorrow.** Shape-atlas entries, procedural sine tracks, and shape-portraits all live behind the same manifest interface as real PNG/MP3/portrait assets.
4. **Reject PRs** that add a string literal referencing an asset path outside a manifest.

## Localization discipline

1. Every user-facing string has an entry in **both** `locales/en.json` and `locales/pl.json` (for PT). Games that ship more locales add them in the same file set.
2. Key parity is scripted — the check runs in CI and blocks merges with missing keys.
3. No inline strings in JSX or in scene logic. Use `t('key')` exclusively.

## IAP catalogue discipline

1. All IAP product IDs live in **one file** per game: `apps/<game>/src/iap/catalog.ts`. No ad-hoc string literals elsewhere.
2. Product ID format: `<game_id_snake>.<product_id_snake>` (e.g. `pan_tvardowski.full_game`). Enforced by a regex check in tests.
3. Every product has: `id`, `type` (`consumable` | `non-consumable` | `subscription`), `entitlement` (the entitlement key it grants, if any), `disabled` (default `false`; set `true` for reserved slots).
4. `EntitlementStore` usage is always `isEntitled(key)`-driven — never a direct product-ID check. This keeps the "100 % free game" and "buy-once game" and "freemium game" paths on the same API.
5. Store-side product metadata (prices, localized descriptions) lives in Play Console / App Store Connect, not in the code. The catalogue knows about slots; stores know about prices.

## Privacy + consent registry

1. Every subsystem that can send data off-device (analytics, crash reporting, leaderboards) is listed in `apps/<game>/src/privacy/registry.ts` with its opt-in key (e.g. `settings.privacy.crashOptIn`).
2. Default for every opt-in key is `false` unless the game legitimately requires it at startup (rare; requires explicit rationale comment next to the registry entry).
3. The privacy policy at `flare-engine.dev/privacy` must cover every registry entry. If a subsystem is added, the policy is updated in the same PR.

## Build + reliability

1. No committed keystores, certificates, API keys, product signing material, or store credentials. EAS credentials storage only.
2. Version (app version + build number) bumped monotonically. Never reuse a build number that hit a store track.
3. `bun run test && bun run build` green before tagging a release build.

## Post-milestone sync (complements status-sync)

When closing any M9.x milestone:

1. Tick the relevant items in [release-readiness-checklist.md](../../docs/plans/release-readiness-checklist.md).
2. If any item moved 🟡 → ❌ (rejected), write the rationale inline on that line.
3. Closure record is the verifier's `SESSION_LOG.md` block — **do not** append to `pan-tvardowski-build-plan.md` Change log (retired 2026-05-10, session #103).
4. Surface any **uncovered release gap** discovered during the milestone — add it as a new checklist item rather than silently absorbing it.

## Extraction review gate (complements build-plan §11.14)

At every M9.x close, the architect reviews: _did this milestone produce anything extractable under the strict genre-agnostic rule?_ If yes, add a row to the Extraction candidates table in [builder-reference.md](../../docs/references/builder-reference.md). If no, state so in the verifier's SESSION_LOG closure block. Never skip the review silently.
