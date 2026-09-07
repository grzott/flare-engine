---
'@flare-engine/cli': patch
---

PF-1a: `flare tiled-to-flare` now emits Tiled-shaped JSON, so `@flare-engine/tilemap`'s `parseTiled` — its only importer — actually accepts the file. Per ADR-0004.

`convertTiled` used to write layers as `{ kind: 'tile' | 'object' }` with no `type`, converted object `properties` to a `Record`, and dropped every tileset's `tiles[]` — the only place `solid`/`collision` flags live. `parseTiled` requires `type: 'tilelayer' | 'objectgroup'` and throws on anything else, so a consumer who followed the documented flow — run `flare tiled-to-flare`, then `parseTiled(require('./zone1.flare.json'))` — got `unsupported type "undefined"`, and even past that, every `solid` tile flag would have come out empty.

The fix is a pass-through of the original layer and tileset objects (group/image layers flattened/dropped, external tilesets inlined), not a re-projection through a narrower shape: beyond `type`, `properties` (kept as Tiled's `{name,type,value}[]`, not a `Record` — `parseTiled` has no length guard for a Record and throws on one) and tileset `tiles[]`, object `rotation`, layer `offsetx`/`offsety`, and per-layer/tileset `properties` all now survive.

`FlareMap` / `FlareTileLayer` / `FlareObjectLayer` / `FlareObject` / `FlareTileset` / `FlareLayer` are deleted from the cli barrel — there is no second published map format. `TiledResult` now returns Tiled-shaped `TiledLayer` / `TiledTileset` / `TiledMap` (plus `TiledObject`, `TiledTile`, `TiledProperty`), all newly exported.

`--no-embed-tilesets` keeps its existing behaviour (preserves the Tiled `source` reference) but is now documented, not silently broken: `parseTiled` rejects a tileset with `source` set, so that output is for a pipeline that resolves external tilesets itself, not a `parseTiled`-ready file.
