---
'@flare-engine/errors': patch
---

`SentryTransportOptions` gains an `integrations` hook, `(kept, defaults) => SentryIntegrationLike[]`,
that receives the ADR-0008 allowlist and the SDK's own default list and returns what `init` uses;
without it `init` receives the allowlist exactly as before, and a hook that throws is logged and
falls back to it. `CrashTransport` gains an optional `close()`: `createSentryTransport` awaits the
SDK's `close()` once (only if the module was loaded) and every later `report()` sends nothing, and
`composeTransports` forwards `close()` to each child that has one. `createNoopTransport` and
`createConsoleTransport` leave `close` undefined.
