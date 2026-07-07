---
"@flare-engine/tilemap": minor
---

tilemap: Tiled GID flip bits + correct LDtk pipeline.

**Tiled flip bits.** Add `GID_FLIP_MASK` (`0x1fffffff`), `stripGidFlags(gid)`, `decodeGidFlags(gid): TileFlipFlags`. Every GID consumer now masks the high flip bits before resolving: `getTilesetForGid` and `getTileSourceRect`, plus the collider and renderer local-id lookups. Flipped tiles previously resolved to the *last* tileset and lost their solid flags; they now resolve the correct tileset and keep colliders. `TileCollider.gid` stores the masked (real) global id. Render-time flip *transforms* remain a documented limitation (post-launch).

**LDtk pipeline.** `parseLDtk` resolves each tile through its layer's tileset (`__tilesetDefUid` → `firstGid`) instead of assuming the first tileset; `firstGid`s are assigned deterministically by sorting tileset uids ascending. IntGrid layers now populate `solidTiles` (value `> 0` is solid by default) so `extractColliders` returns correct, non-empty colliders for LDtk maps. New `parseLDtk(json, options?)` with `ParseLDtkOptions.intGridSolid` predicate.

**Parser honesty.** New `TilemapParseError`. `parseTiled` throws actionable errors on infinite, base64/compressed/chunked, external-tileset, and non-orthogonal maps instead of silently producing wrong data; `parseLDtk` throws on non-project input and `externalLevels` projects.
