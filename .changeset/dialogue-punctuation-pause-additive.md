---
'@flare-engine/dialogue': patch
---

`updateTextReveal` now treats `punctuationDelay` as extra time: after a `.!?:;` the cursor holds
for that many seconds and then resumes at `speed`, so the gap after a full stop is
`1 / speed + punctuationDelay` as documented. Before, the gap was `punctuationDelay` on its own (a
speed override), which made the delay shorter than one character at the default 30 cps and made any
text slower than about 6.7 cps speed up after punctuation. `TextRevealState` gains an optional
internal `_pause` field; hand-built states without it keep working.
