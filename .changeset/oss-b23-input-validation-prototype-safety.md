---
"@flare-engine/animation": minor
"@flare-engine/audio": minor
"@flare-engine/core": minor
"@flare-engine/dialogue": minor
"@flare-engine/localization": minor
---

input-validation + prototype-safety hardening: hang guards (throw on non-positive frameDuration/maxPolyphony/fixedDt), Object.hasOwn prototype-safe lookups in dialogue graph/runner and localization manager/format, re-entrancy fixes for clock tickSchedules (splice-by-indexOf), coroutine update (undefined guard), and AppLifecycle background idempotency.
