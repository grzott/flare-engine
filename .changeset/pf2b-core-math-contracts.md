---
'@flare-engine/core': patch
'@flare-engine/math': patch
---

PF-2b: settle the `core` coroutine contract and the `math` zero-alloc names before the freeze. Per
ADR-0004.

A coroutine now ends exactly one of three ways, and `CoroutineHandle` says which: completed,
`cancelled`, or `failed` (all imply `done`; `cancelled` and `failed` are mutually exclusive).
`cancel()` and `clear()` both set `cancelled` and close the generator, so a coroutine's `finally`
blocks run on cancel and on scene teardown — `clear()` is a cancel from every coroutine's point of
view — instead of leaking whatever they guard. A cancel issued from inside the running body is
applied, and reports the same `cancelled` state, once the body next suspends. A rejected
`yield Promise` is thrown into the generator: catch it and the coroutine keeps running, with the
next yield dispatched as usual; let it propagate and the coroutine ends with the new
`CoroutineHandle.failed` set and `CoroutineHandle.error` holding what the generator threw. Before,
a rejection silently flipped `done` and dropped the reason, so asset and network failures inside
coroutines vanished, and a cancelled coroutine was indistinguishable from a completed one. Failures
are never re-raised as unhandled rejections; the handle is the channel.

`Vec2.normalizeOut(dx, dy, speed, out)` is renamed `Vec2.scaleToLengthInto(dx, dy, length, out)` —
it was the repo's only `…Out` zero-alloc name against nineteen `…Into` siblings, and it scales to
`length` rather than normalising. `Vec2.turnVelocityToward` becomes `Vec2.turnVelocityTowardInto`
for the same reason. Neither body changed: a bit-level sweep of 1.22M inputs (denormals, the 1e-6
guard boundary, overflow magnitudes) shows zero mismatches against the old names, so `atan2`
consumers see identical angles.
