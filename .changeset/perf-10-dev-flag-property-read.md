---
"@flare-engine/core": minor
"@flare-engine/render": minor
---

perf-10: stop evaluating an unresolvable global in the per-item hot loops.

JSC has no inline cache for an unresolvable global identifier, so `typeof __DEV__ !== 'undefined' && __DEV__` costs ~270 ns **per evaluation** wherever `__DEV__` is undeclared. Measured on one machine over 1e6 evaluations: undeclared 272.5 ns, declared-false 0.7 ns, declared-true 1.2 ns, and a `globalThis` property read of an absent property 0.46 ns.

Two hot sites now read `globalThis.__DEV__` as a property instead:

`createFrameRenderer` — `fillXforms` evaluated the guard once per sprite per transform pass, nine times over under an outline effect. `render.flush 1000 sprites / 1 atlas` in the undeclared configuration measured 412-450 µs before and 56-88 µs after, which is the same band the declared configuration occupies.

`Pool.release()` — once per released object, so roughly 300 evaluations a frame in a particle-heavy scene. The `Pool` **constructor** keeps the identifier form deliberately: it runs once per pool, and it is the site a bundler can constant-fold for dead-code elimination.

React Native always defines `__DEV__`, so **RN apps were never affected and see no change**. This is a win for web/CanvasKit bundles and for any Node or Bun consumer. Runtime toggling of `globalThis.__DEV__` behaves exactly as before, and the guards remain truthiness checks, so no value that enabled a dev check before disables one now. The one behavioural difference: a bundler `define` that substitutes a bare `__DEV__` identifier no longer reaches these two sites — set `globalThis.__DEV__`, which is the contract api-specs already documents for non-RN runtimes.

No public API, signature, or type changed.
