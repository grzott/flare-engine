---
"@flare-engine/pathfinding": patch
---

OSS-B18: grow the open-set heap instead of corrupting it past 4096 entries.

Both `findPath` and `findPathJPS` allocated the heap at `min(width * height, 4096)` and pushed without a capacity check. A typed-array out-of-range write is silently dropped, so beyond the cap the heap kept incrementing `size`, stored nothing, and read `undefined` in later comparisons — the search lost its ordering guarantee and returned a valid-looking, contiguous, non-optimal path with no error and no NaN. The heap now doubles on demand (amortized O(1), allocation only at growth).

Also documents that `findPath` and `findPathJPS` disagree about corner cutting — A* refuses a diagonal whose two shared cardinal neighbours are blocked, JPS permits it — and labels the package "beta — no production consumer yet".
