# @flare/physics — package-specific rules

Layer 2. Depends on `@flare/math` and `@flare/events`. Do not import from other `@flare/*` packages.

## Collision model

- `CollisionWorld` tracks active pairs across frames using string keys of the form `"minId:maxId"`. **Never rebuild the internal pair Set mid-lifecycle** — you will lose enter/stay/exit continuity and the next `step()` will re-emit enter events for pairs already in contact.
- `onCollisionStart` / `onCollisionEnd` / `onTriggerEnter` / `onTriggerExit` signals are fired **during** `step()`, not on collider add/remove. Listeners must be attached before the first `step()` call or enter events will be missed.
- `isTrigger` colliders emit trigger signals but generate no physical response. Do not gate physical resolution code on trigger signals.

## Spatial index

- `SpatialIndex` is a brute-force broadphase designed for **<1000 dynamic entities**. If you need more, write a new implementation (quadtree/grid) as a sibling module — do not retrofit this one.
- `SpatialIndex` uses swap-remove: **insertion order is not preserved**. Only safe for broadphase queries where order does not matter.
- `queryBuf` is reused across calls. Consumers must drain or copy the result before the next `query()` / `step()`, otherwise previous results will be overwritten.

## Tests

- Tests live in `tests/`, one file per source module. Signal-driven tests collect fired events into arrays and assert against the state machine (enter → stay → exit). No fake clock needed — `step()` is deterministic.
