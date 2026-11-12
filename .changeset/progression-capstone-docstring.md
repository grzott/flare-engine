---
"@flare-engine/progression": patch
---

The `createCollectibleRegistry` JSDoc stated two contradicting capstone rules. It now states what the code does: the capstone unlocks automatically once every id in `ids` is unlocked, `unlock(capstoneId)` also unlocks it directly, and a capstone that is also listed in `ids` behaves as an ordinary member of the set. Documentation only; behaviour is unchanged.
