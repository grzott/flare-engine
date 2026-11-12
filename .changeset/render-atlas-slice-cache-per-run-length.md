---
"@flare-engine/render": patch
---

The frame renderer's internal cache of atlas source-rect and transform slices is now keyed by run length instead of remembering only the most recent length, so a sprite run reuses the arrays built for an earlier run of the same length. Runs longer than 256 sprites keep a single most-recent-length slice, so the cache stays bounded. Cached entries are always copies of the pool, never the pool array itself. No API change.
