---
"@flare-engine/core": patch
---

The `AppLifecycle` class JSDoc claimed it bridges React Native `AppState` and auto-pauses / auto-resumes the loop. It subscribes to nothing: the host calls `background()`, `foreground()` and `memoryWarning()` itself. The JSDoc now says so, and attributes the post-resume timestamp reset to `GameLoop.resume()`, where it lives. Documentation only; behaviour is unchanged.

<!-- symbols-ok: AppState -->
