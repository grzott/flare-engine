---
'@flare-engine/engine': patch
---

The main entry now re-exports `@flare-engine/engine/headless` instead of repeating its export list,
so the two entries cannot drift. The exported names are unchanged.
