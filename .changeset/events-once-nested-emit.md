---
"@flare-engine/events": patch
---

A handler registered with `Signal.once` or `EventEmitter.once` now runs at most once when the same signal or event is emitted again from inside the emit that fires it. Before, the handler's removal was deferred until the outermost emit finished, so it was still subscribed during the nested emit: another handler that emitted once more made the `once` handler run twice, whichever of the two was registered first, and a `once` handler that emitted the same signal or event itself recursed until it threw `RangeError`. Handlers removed with `remove` or `off` during an emit are unchanged — they still run for that emit and any nested emit.
