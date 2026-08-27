---
"@flare-engine/scene": patch
---

Fix scene activation stall: extract `_finishOutPhase()` from `_updateTransition`, add a generation token so superseded `go()` settle handlers bail early, and re-drive activation from the surviving settle handler so the scene activates even when `update()` has stopped.
