---
'@flare-engine/errors': patch
---

Fix `installGlobalErrorCapture` leaving its React Native `ErrorUtils` handler live after
`uninstall()` when no previous global handler existed. `uninstall()` only restored a handler when
`getGlobalHandler()` had returned one, so with none the installed closure stayed as the global
handler and kept reporting to the transport, or filling the buffer, for a capture the consumer
believed detached. `uninstall()` now always calls `setGlobalHandler`, with the previous handler when
there was one and a no-op otherwise, and the installed closure itself turns into a pure pass-through
once uninstalled. Restoring an existing previous handler is unchanged.
