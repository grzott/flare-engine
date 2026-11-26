---
'@flare-engine/ecs': patch
---

The package description on npm and the README now describe the storage the way `World` implements it (#514): numeric entities, components in a `Map` per `ComponentDef`, and queries matched by a bitmask per entity. The old wording, "archetype queries" and "Archetype-bitmask ECS", suggested archetype-table storage, which the package does not use. No code changes.
