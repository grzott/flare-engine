---
"@flare-engine/render-web": patch
---

`loadCanvasKit` no longer rejects with a bare non-`Error` value. When the load rejects with anything that is not an `Error` (the full CanvasKit glue rejected with the number `Infinity` when served the non-full binary), it now rejects with an `Error` whose message names the likely cause and the file to serve, `canvaskit-wasm/bin/full/canvaskit.wasm`, and whose `cause` is the original value. A rejection that is already an `Error` is unchanged.

The README and the API spec now say that `wasmUrl` must serve the full binary, `canvaskit-wasm/bin/full/canvaskit.wasm`, and show the Vite `?url` import for it.
