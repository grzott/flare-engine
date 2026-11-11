---
'@flare-engine/errors': patch
---

Internal refactor: `createClientTransport` and `createSentryTransport` now rebuild a crash payload into an `Error` through one shared internal helper instead of two hand-written copies, and `createClientTransport` with `ErrorClientLike` moved to its own module beside the Sentry transport. Both transports hand their client the same `Error` as before (the payload's name and message, and its stack when it has one). No behaviour or API change.
