---
'@flare-engine/dynamics': patch
---

`stepUntil(world, dt, opts)` repeats `step(world, dt)` and, after each step, stops when `opts.done()`
returns true (`complete: true`), when `steps >= opts.maxSteps`, or when `now() - start >= opts.budgetMs`
(both `complete: false`), checked in that order; it always takes at least one step, so a zero budget
still makes progress. `opts.now` defaults to `performance.now` (falling back to `Date.now`) and can
be injected for deterministic tests. `stepUntilInto(world, dt, opts, out)` is the zero-alloc form that
writes `out` and returns it. A non-finite or non-positive `dt`, a negative or non-finite `budgetMs`,
or a `maxSteps` that is not an integer >= 1 throws a `RangeError` naming the argument.
`StepUntilOptions` and `StepUntilResult` are exported.
