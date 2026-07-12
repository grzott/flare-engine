---
"@flare-engine/math": minor
---

docs: OSS-D5 design-docs honesty pass — correct the easing-function count to 35 and drop the stale hard-coded count from the `easings.ts` header comment.

No runtime or API change to `@flare-engine/math`. This changeset exists because the header-comment edit touches `packages/math/src/`, and covers the wider design-docs truth pass (architecture.md + api-specs.md re-derived against `src/index.ts`: planck/rbush/flow-fields moved to a Post-launch roadmap, `@flare-engine/shapes` documented, stale api-specs sections for animation/dialogue/errors/testing/devtools/iap corrected, and stale `0.2.0` forward-promises swept).
