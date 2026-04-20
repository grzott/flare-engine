---
name: flare-tier2-stubs
description: Knowledge of the Tier-2 interface-only stubs — @flare-engine/leaderboards, @flare-engine/achievements, @flare-engine/iap, @flare-engine/analytics. Each ships a typed interface + NoopProvider + React context. Use when integrating a third-party provider (Game Center / Play Games / RevenueCat / PostHog / etc.) or when documenting the interface contract before 0.2.0 adapters land.
---

# Tier-2 Stubs

Four packages ship interface-only at 0.1.0. Concrete adapters land as 0.2.0.

| Package                      | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `@flare-engine/leaderboards` | Typed leaderboard submission + fetch interface |
| `@flare-engine/achievements` | Unlock / progress / listing interface          |
| `@flare-engine/iap`          | Purchase / restore / product-listing interface |
| `@flare-engine/analytics`    | Track / screen / identify interface            |

## Shape (identical across all four)

Each package exports:

- A typed `XxxProvider` interface describing the methods (e.g. `submit`, `unlock`, `purchase`, `track`)
- `createNoopProvider()` — safe default that resolves everything with `{ ok: false, reason: 'noop' }`
- `XxxContext` + `useXxx()` — React context wiring

```ts
import {
  AnalyticsContext,
  useAnalytics,
  createNoopProvider,
} from "@flare-engine/analytics";
```

## Rules

- These stubs exist so consumers can wire the interface today and swap in a real adapter later without refactoring.
- Don't add concrete SDKs here — those live in separate 0.2.0 adapter packages (`@flare-engine/analytics-posthog`, etc.).
- The interface contract is the source of truth — adapters must conform, not extend.

Adapters table: [docs/plans/build-plan.md § Tier-2](../../../docs/plans/build-plan.md).
