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
         composeTransports } from '@flare-engine/errors';

const transport = composeTransports(
  createConsoleTransport('crash'),
  createSentryTransport({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, enabled: true }),
);

<ErrorBoundary
  fallback={(err, reset) => <CrashScreen err={err} onRetry={reset} />}
  transport={transport}
  context={{ scene: 'play', level: 4 }}
>
  <App />
</ErrorBoundary>
```

See [API spec](../../docs/design/api-specs.md#flare-engineerrors--2kb-raw) and [skill reference](../../.github/skills/flare-errors/SKILL.md).

## License

MIT
