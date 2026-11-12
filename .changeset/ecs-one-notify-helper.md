---
"@flare-engine/ecs": patch
---

Internal refactor: `World` now runs query notification for `add`, `remove` and `destroy` through one shared private helper. No behaviour or API change.
