---
'@flare-engine/ecs': patch
'@flare-engine/render': patch
---

PF-2a: settle three `ecs` contracts before the freeze.

`Query.entities` is the zero-alloc walk — the live `readonly number[]` of matching ids, for an
indexed loop. The built-in systems and the render system now use it; `for...of` stays as the
convenience form, which allocates an iterator per loop and, on Hermes, a result object per entity.

`QueryBuilder` takes the World's registration hook as a required constructor argument, so a bare
`new QueryBuilder()` no longer compiles and `build()` always returns a query the world keeps
populated. `world.queryBuilder()` is unchanged. The internal `_WorldQueryBuilder` subclass and
`World._registerQuery` are gone.

`definePrefab` documents that plain-object data is stored by reference and shared by every spawn
(pass `() => T` for per-entity mutable state), and `Prefab.spawn(world)` drops the `overrides`
parameter it never read.
