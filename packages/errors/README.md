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

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineerrors--2kb-raw).

## License

MIT
