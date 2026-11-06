---
'@flare-engine/ecs': patch
---

Fix `World` keying component storage and query masks by `ComponentDef.id` / `.bit`, which come from
a module-global counter. A second copy of `@flare-engine/ecs` in one process (the CJS and ESM builds
loaded together, or a duplicated install) runs its own counter from 0, so two unrelated components
shared an id and a bit and silently aliased each other's storage and query matches. Each `World` now
keeps its own registry keyed by the `ComponentDef` object: the first `add` or query naming a
definition assigns it a world-local slot, and that slot's bit is what archetypes, query masks and
store lookup use. `ComponentDef.id` / `.bit` / `.name` / `.create` keep their values. The 32-type
limit is now enforced per `World` at registration (a 33rd distinct definition throws from `add` or
query construction); `has` / `get` / `remove` on a definition never added read as absent and
register nothing. `QueryBuilder` gains an optional second constructor argument, the World's
definition-to-bit mapping, which `world.queryBuilder()` supplies.
