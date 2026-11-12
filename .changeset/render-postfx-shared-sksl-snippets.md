---
'@flare-engine/render': patch
---

Internal refactor: the shader strings in this package now share one copy of each repeated helper
snippet (the two-component and the one-component hash one-liners) instead of pasting it into every
shader that uses it. Every exported `*_SKSL` string is byte-identical to its previous value, so the
compiled shaders and everything drawn with them are unchanged.
