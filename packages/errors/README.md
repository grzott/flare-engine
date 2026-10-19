# @flare-engine/errors

React error boundary + structured crash payloads. `createCrashPayload(err, context?)` normalizes any thrown value into a stable `CrashPayload` shape. Pluggable `CrashTransport` sinks: `createNoopTransport`, `createConsoleTransport`, `createSentryTransport` (lazy-loaded `@sentry/react-native`, optional peer dep), and `composeTransports` for fan-out.

## Install

```sh
bun add @flare-engine/errors
```

Optional peer deps: `react`, `@sentry/react-native` (only if you wire the Sentry transport).

## Usage

```tsx
import { ErrorBoundary, createSentryTransport, createConsoleTransport,
         composeTransports, type CrashPayload } from '@flare-engine/errors';
import type { ReactNode } from 'react';

declare function CrashScreen(props: { err: CrashPayload; onRetry: () => void }): ReactNode;
declare function App(): ReactNode;

const transport = composeTransports(
  createConsoleTransport(),
  createSentryTransport({ dsn: 'https://xxx@o0.ingest.sentry.io/0', enabled: true }),
);

<ErrorBoundary
  fallback={(err, reset) => <CrashScreen err={err} onRetry={reset} />}
  transport={transport}
  context={{ scene: 'play', level: 4 }}
>
  <App />
</ErrorBoundary>
```

`createSentryTransport` starts Sentry with the SDK's own capture switched off — no global error or
rejection handlers, no automatic session tracking, no native crash handling, no console/network
instrumentation — so Sentry sends only what the transport is given, and a consent check placed in
front of the transport holds. Process-wide JS errors reach it through `installGlobalErrorCapture`
(next section). The one exception the transport cannot close: on Android 11+ the native SDK reports
past ANRs on its own; if consent must cover those, set the `io.sentry.anr.enable` meta-data to
`false` in your Android manifest ([Sentry Android docs](https://docs.sentry.io/platforms/android/configuration/app-not-respond/)).

## Catching what the boundary cannot

`ErrorBoundary` only sees errors thrown during React's render phase. Most of a game's crashes are
not there — they are in the update loop, in an asset load, in a promise nobody awaited.
`installGlobalErrorCapture` routes those into the same transport chain.

```ts
import { installGlobalErrorCapture, createConsoleTransport } from '@flare-engine/errors';

// `globalThis` supplies `addEventListener` on web and `ErrorUtils` on React
// Native, so one call covers both.
const capture = installGlobalErrorCapture(globalThis, {
  transport: createConsoleTransport(),
  context: { build: '1.2.3' },
});

// Later, e.g. on scene teardown or hot reload:
capture.uninstall();
```

The transport can attach **after** installing. Errors raised in between are held in a small ring
buffer (default 20, oldest dropped) and drained on attach, so the crashes that happen during boot —
usually the interesting ones — are not lost while your reporter is still initialising:

```ts
import { installGlobalErrorCapture, createClientTransport } from '@flare-engine/errors';

declare const Sentry: { captureException(error: unknown, hint?: unknown): unknown };

const capture = installGlobalErrorCapture(globalThis);   // no transport yet
// ... boot, read config, initialise the reporter ...
capture.setTransport(createClientTransport(Sentry));     // buffered errors drain here
```

Two things worth knowing:

- On React Native the previous `ErrorUtils` handler is **chained, not replaced** — that handler is
  what shows the red box in development and ends the process on a fatal, so it still runs.
  `uninstall()` restores it.
- `createSentryTransport` is native-only (it imports `@sentry/react-native`).
  `createClientTransport` is the web counterpart: you initialise a browser client and inject it, so
  this package depends on no reporter of its own.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineerrors--2kb-raw).

## License

Apache-2.0
