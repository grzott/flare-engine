---
'@flare-engine/react': patch
---

`GameView` on native no longer calls `buildPostFxPasses` each frame while no postfx chain is bound;
it checks `hasPostFxBinding` first, as the web path already did. With a chain bound, the per-frame
uniform comparison no longer builds a key array for each pass. The pass descriptor list itself is
still built once per frame while a chain is bound. One visible difference: a runtime bound on native
with `supported` set but no `buildPass` no longer logs the one-time "buildPass absent" warning,
matching web.
