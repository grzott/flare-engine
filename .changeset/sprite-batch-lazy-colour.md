---
"@flare-engine/render": patch
---

`SpriteBatch.draw` and `SpriteBatch.drawRaw` no longer do per-sprite colour bookkeeping while no coloured sprite is queued. Since 0.4.13 every sprite paid for it, coloured or not. In the node benchmark (Bun, so JavaScriptCore) that made uncoloured `render.flush` up to 16% slower than at 0.4.12 (#434); this restores the 0.4.12 figures. The bookkeeping starts at the first coloured sprite of a frame, and the sprites queued before it are marked uncoloured then. Runs, colours and the flush callback's arguments are unchanged.
