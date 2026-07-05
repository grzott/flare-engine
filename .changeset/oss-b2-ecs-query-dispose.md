---
"@flare-engine/ecs": minor
"@flare-engine/testing": patch
"@flare-engine/devtools": patch
---

ecs: add `World.removeQuery`, `World.forEachEntity`, and `World.entityCount` — query disposal plus zero-alloc entity iteration, so consumers no longer need a private-field cast to enumerate entities.

testing: `serializeScene` now memoizes its per-component queries per world (`WeakMap`) instead of registering N+1 permanent queries on every call, and drops the redundant all-components query.

devtools: `useEntityInspector` enumerates entities through `World.forEachEntity` instead of casting the world to a private `nextId` and scanning the id range.
