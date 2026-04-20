---
name: flare-analytics
description: Deep knowledge of the @flare-engine/analytics package — typed analytics provider interface, track/screen/identify, NoopProvider, AnalyticsContext, useAnalytics. Use when wiring an analytics provider (PostHog / Amplitude / custom backend) to a Flare game. Concrete adapters ship in 0.2.0.
---

# `@flare-engine/analytics`

Tier-2 stub. Interface-only at 0.1.0.

```ts
import {
  type AnalyticsProvider,
  createNoopProvider,
  AnalyticsContext,
  useAnalytics,
} from "@flare-engine/analytics";
```

## Interface

```ts
interface AnalyticsProvider {
  identify(userId: string, traits?: Record<string, unknown>): void;
  track(event: string, props?: Record<string, unknown>): void;
  screen(name: string, props?: Record<string, unknown>): void;
}
```

Wire a real adapter by replacing `createNoopProvider()` in `AnalyticsContext.Provider`. Adapters ship 0.2.0. See [flare-tier2-stubs](../flare-tier2-stubs/SKILL.md).
