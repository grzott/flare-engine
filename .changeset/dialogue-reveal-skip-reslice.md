---
'@flare-engine/dialogue': patch
---

`updateTextReveal` no longer rebuilds `visibleText` when the revealed character count did not
change, so a frame shorter than one character creates no new string. A caller that overwrites
`visibleText` with another string of the same length now keeps it until the count changes.
