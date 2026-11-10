---
'@flare-engine/animation': patch
---

`tween()` without an `easing` argument now defaults to `linear` from `@flare-engine/math` instead of a module-private copy of the same function, so `tween(0, 1, 1).easing === linear` holds. Values are unchanged. The `chainTween` JSDoc now states that only `TweenManager` / `updateTweens` follows the chain and `updateTween` does not, and the `updateTween` JSDoc no longer claims to advance to a chained tween; that behaviour is unchanged.
