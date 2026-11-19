---
"@flare-engine/ecs": patch
"@flare-engine/testing": patch
---

Deprecations in `@flare-engine/ecs`. None of them changes behaviour in this release; 0.5.0 removes each one.

- `ComponentDef.id` and `ComponentDef.bit`. A `World` no longer keys storage by them. `id` comes from a module-global counter, so it depends on import order and must never be persisted, and `bit` is `1 << id`, which wraps once 0.5.0 lifts the cap of 32 component types. Use the definition object itself as the key, for example a `Map<ComponentDef<unknown>, …>`.
- `_resetComponentIds` (internal, test-only). Each `World` keys storage by the definition object, so isolating storage between tests needs no reset. It goes together with the global counter it resets.
- `Query.requiredMask`, `Query.excludedMask`, `Query.matches` and calling `new Query(requiredMask, excludedMask)` directly. 0.5.0 sizes masks per `World` and takes the mask representation out of the public API. Build queries with `World.query` or `World.queryBuilder`, and test membership with `Query.has`.

`@flare-engine/testing`: `serializeScene` cached its queries by `ComponentDef.id`, so two definitions sharing an `id` (two copies of `@flare-engine/ecs` in one process, or a hand-built definition) got the same query and entities holding only the second one were left out of the snapshot. It now caches by the definition object.
