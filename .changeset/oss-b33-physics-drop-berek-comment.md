---
"@flare-engine/physics": minor
---

physics: remove a private-project reference from the `moveAndSlideInto` docstring.

The `solid-grid.ts` axis-slide docstring named a private sibling game ("byte-identical to Berek"), which shipped into the published `@flare-engine/physics` `dist` `.js`/`.mjs`/`.d.ts`/`.d.mts` and sourcemaps — surfaced by the OSS-F3 tarball audit as the one HEAD leak. The parenthetical is dropped; the behavioral note ("the y-check uses the already-updated x position") is kept. Comment-only, zero behavior change; all physics tests remain green.
