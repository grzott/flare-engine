---
'@flare-engine/render-web': patch
---

`loadCanvasKit` now downloads `canvaskit.wasm` once on `canvaskit-wasm` 0.41+: the bytes from the
progress-reporting fetch reach the glue both as `wasmBinary` (read by ≤0.40) and through a Blob URL
returned from `locateFile` (0.41+ ignores `wasmBinary` and fetches `locateFile()` itself), and the
URL is revoked once init settles. Before, those glues fetched the 3.26 MB binary a second time after
the progress bar had already reached 100%. If the Blob URL load fails (for example a CSP without
`blob:` in `connect-src`), the loader still falls back to the network `wasmUrl` as before.
