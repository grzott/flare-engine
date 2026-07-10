---
"@flare-engine/tilemap": minor
---

Add `parseLDtkEntities(map)` + `LDtkEntity` — flatten LDtk object layers into spawn-ready `{ id, x, y, width, height, fields }` for the LDtk-entity → ECS spawn convention; `id` is the entity identifier. Authoring-pipeline docs added to api-specs.md; cli flag-drift corrected (`--embed-tilesets` → `--no-embed-tilesets` in README and api-specs).
