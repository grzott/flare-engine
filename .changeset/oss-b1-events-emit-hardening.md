---
"@flare-engine/events": patch
---

events: harden `emit()`. A depth counter plus `try/finally` replace the boolean re-entrancy flag, so a throwing handler no longer wedges deferred removal, a nested/re-entrant `emit()` no longer flushes the outer emit's pending removals early, and `EventEmitter.removeAll(event)` mid-emit no longer drops other events' deferred removals. Live-set iteration (added-during-emit runs the same emit) and the `emit` signatures are unchanged; the semantics are now documented on both classes and in the README.
