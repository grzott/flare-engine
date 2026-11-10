---
'@flare-engine/scene': patch
---

Internal refactor: `SceneManager` now tears the scene stack down through one private helper instead of four copies of the same loop, and an instant `go()` no longer walks the already-emptied stack a second time. Lifecycle order and exports are unchanged.
