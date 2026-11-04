---
'@flare-engine/errors': patch
---

`installGlobalErrorCapture` (both the live path and the `setTransport` drain) and `ErrorBoundary`
now handle a transport whose `report` returns a rejected promise: the rejection is caught and logged
with the `[@flare-engine/errors]` prefix, as a synchronous throw already was. Before, a
consumer-written `async report` that rejected (for example awaiting `fetch` while offline) was left
as an unhandled rejection; on web the capture's own `unhandledrejection` listener then reported it
through the same transport, which rejected again, and so on until the transport recovered. The
bundled transports swallow their own failures and were not affected. `ErrorBoundary` also now logs a
transport that throws synchronously instead of letting the throw escape `componentDidCatch`.
