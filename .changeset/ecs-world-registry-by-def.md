---
"@flare-engine/ecs": patch
---

`World` now keys component storage by the `ComponentDef` object instead of by its `id` and `bit`. A second copy of the package in one process (the CJS and ESM builds loaded together, or a duplicated install) numbers its definitions from 0 again, so its components used to share storage and query matches with the first copy's, with no error. They no longer do.

Query masks for definitions from one copy are unchanged: `Query.requiredMask` and `excludedMask` are still the OR of each definition's `bit`. Only a definition whose `bit` another definition already holds in that `World` gets a different, free bit.

Behaviour change, only where two definitions share an `id`: in practice two copies of the package, but also a hand-built `ComponentDef` or one defined after the internal `_resetComponentIds`. Built-in components from two copies (for example `Position` from each) are now separate components in one `World`. Code that relied on them sharing storage by accident will see two.

Each `World` holds at most 32 component types and throws `A World holds at most 32 component types (registering "<name>")` on the 33rd. A definition takes a slot the first time it is passed to `add`, `query`, or a builder's `with` / `without`; `has`, `get` and `remove` never take one. A `query(...)`, `with(...)` or `without(...)` call that does not fit throws without taking any slot. `defineComponent` still allows 32 definitions per copy of the package.

`World.destroy` now deletes only from the stores of the components the entity has, instead of from every store in the `World`.
