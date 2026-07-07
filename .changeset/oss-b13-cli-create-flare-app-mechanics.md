---
"@flare-engine/cli": minor
---

both CLIs report their real version read from their own package.json at build time (no more hardcoded 0.0.0); Windows spawn uses shell:isWin with a validated app-name guard against injection; tiled-to-flare default out path now writes beside the input instead of a double-prepended absolute path that ENOENT'd without -o; --no-embed-tilesets preserves the external tileset source reference instead of emitting an empty zero stub.
