---
name: flare-errors
description: Deep knowledge of the @flare-engine/errors package — ErrorBoundary, createCrashPayload, CrashTransport (noop/console/Sentry). Use when wiring React error boundaries, capturing structured crash payloads, or integrating a crash-reporting backend in Flare.
---

# `@flare-engine/errors`

Layer 2.5. React peer dep. Provides a boundary + a stable crash-payload shape + pluggable transport.

## Exports

```ts
import {
  createCrashPayload,
  type CrashPayload,
  createNoopTransport,
  createConsoleTransport,
  type CrashTransport,
  ErrorBoundary,
  type ErrorBoundaryProps,
} from "@flare-engine/errors";
```

## Usage sketch

```tsx
<ErrorBoundary
  transport={createConsoleTransport("flare")}
  context={{ scene: "play", level: 3 }}
  fallback={(err, reset) => <CrashScreen err={err} onRetry={reset} />}
>
  <GameView config={config} />
</ErrorBoundary>
```

## Rules

- `ErrorBoundary` catches render-time errors only — async/game-loop errors must be caught manually and fed to `transport.send(createCrashPayload(err, ctx))`.
- `CrashPayload` is the stable contract. Custom transports should not rewrite the shape.
- The default transport is no-op; opt into `createConsoleTransport` for dev or write your own for Sentry/Crashlytics.

Spec: [docs/design/api-specs.md § @flare-engine/errors](../../../docs/design/api-specs.md).
