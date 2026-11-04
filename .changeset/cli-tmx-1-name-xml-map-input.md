---
'@flare-engine/cli': patch
---

CLI-TMX-1: `flare tiled-to-flare` now names a TMX (XML) input instead of failing inside the JSON
parser. Tiled takes the format from "Save as type", not from the file extension, so a map saved
with that list left on TMX is XML under a `.tmj` name, and the command printed the raw
`Unexpected token '<', "<?xml vers"... is not valid JSON`. The converter now checks for a leading
`<` (after an optional BOM and whitespace) before parsing and fails with a message that names the
file and says to re-save it in Tiled as `JSON map files (*.tmj *.json)`. JSON stays the only
supported input; no XML is parsed, and no exported name, signature or type changes.
