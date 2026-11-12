---
"@flare-engine/assets": patch
---

`parseAseprite` now names the frames of an Aseprite hash export (`--format json-hash`, where `frames` is an object keyed by frame name) after their keys, so `getFrame(sheet, name)` and `sheet.frameMap` resolve them. Before, the parser read the name from a `filename` field that hash-export values do not carry: every `SpriteFrame.name` was `undefined`, `frameMap` held a single `undefined` key, and `getFrame` returned `undefined` for every frame name. Frame rectangles, frame order and tag animations were unaffected, since they are index-based. A hash value that does carry `filename` keeps that as its name, and array exports (`--format json-array`) are unchanged.
