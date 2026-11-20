---
'@flare-engine/render-web': patch
---

`loadCanvasKit` now rejects a later call that names a different `wasmUrl` instead of silently returning the kit loaded from the first URL.

The loader keeps one CanvasKit per page. Before, once a load was in flight or had succeeded, every later call returned that load's promise whatever `wasmUrl` it passed, so a caller asking for another binary got the first one with no sign of it. Such a call now returns a promise that rejects with an `Error` naming both URLs:

```
loadCanvasKit: CanvasKit is already loaded or loading from "<first url>"; cannot load it again from "<requested url>"
```

`onProgress` is not called for the rejected call, and the first load and its promise are unaffected.

A later call with the same `wasmUrl` behaves as before: it returns the same promise and calls `onProgress(1)`. The URLs are compared by exact string equality, so two spellings of one address (`/canvaskit.wasm` and `https://example.com/canvaskit.wasm`, say) count as different — pass the same string each time.

A failed load is still not cached, so after a failure a call with any `wasmUrl` starts a new load.
