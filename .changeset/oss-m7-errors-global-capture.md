---
"@flare-engine/errors": patch
---

OSS-M7: capture the crashes `ErrorBoundary` cannot see.

`installGlobalErrorCapture(target, options?)` routes uncaught errors and unhandled rejections into the existing transport chain — the update-loop, async and asset-load crashes that never reach a React render phase. The target is structural (`addEventListener` for web, `ErrorUtils` for React Native), so one call handles both platforms and tests use a fake global. Returns a handle with `uninstall()`, `setTransport()` and `buffered`.

A transport may attach after installing; errors raised in between are held in a bounded ring buffer (default 20, oldest dropped) and drained on attach, so crashes during boot are not lost while the reporter initialises. On React Native the previous `ErrorUtils` handler is chained rather than replaced, and restored on uninstall.

`createClientTransport(client)` is the web counterpart to the native-only `createSentryTransport`: it takes an already-initialised, structurally-typed browser client, so this package depends on no reporter of its own.
