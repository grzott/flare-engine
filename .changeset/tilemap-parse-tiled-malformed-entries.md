---
'@flare-engine/tilemap': patch
---

`parseTiled` now throws `TilemapParseError` for two malformed inputs that used to escape as a raw
`TypeError` (#509). No exported symbol or signature changes.

- **`properties` that is not an array.** Tiled exports `properties` as an array of
  `{ name, type, value }` entries. Any other present value — the object form
  `"properties": { "solid": true }`, for one — on the map, a tile layer, an object layer, an object
  or a tileset tile is rejected, and the message names the owner: `map`, `layer "<name>"`,
  `layer "<name>" object <id>` or `tileset "<name>" tile <id>`. An absent or `null` `properties`
  still gives `{}`.
- **A `tilesets` or `layers` entry that is not an object.** A `null` entry threw a `TypeError`; it
  now throws `TilemapParseError` naming the index, e.g. `tilesets[1] is null`.

Three inputs that did not throw a `TypeError` before also change:

- A `properties` of `false`, `0` or `""` was read as empty; it is now rejected like any other
  non-array.
- A non-empty string `properties` was iterated character by character and produced a junk
  `undefined` key; it is now rejected.
- A primitive `tilesets` entry (a string or number) was accepted and produced a tileset with
  `undefined` fields; it is now rejected. A primitive `layers` entry already threw
  `TilemapParseError` as an unsupported layer type and now reports its index instead.

Entries inside a `properties` array, and the other fields of a tileset, layer, tile or object, are
not validated by this change.
