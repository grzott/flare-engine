---
'@flare-engine/shapes': patch
---

Renames the file-local alias for the Skia module type that `drawShape` and its helpers take, so the
emitted declaration file no longer carries a generated dollar-one-suffixed copy of that alias as the
type of the first parameter. No exported symbol changes.
