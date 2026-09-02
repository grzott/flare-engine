---
"@flare-engine/deep-links": patch
"@flare-engine/input": patch
---

OSS-B23b: harden URL and input parsing against inherited keys and non-finite values.

`deep-links` builds its three URL-derived `Params` objects with `Object.create(null)`, so a link that never carried a `constructor` / `toString` key no longer answers those reads with an inherited value.

`input` corrects out-of-contract configuration instead of propagating it: `updateJoystick` guards a zero distance and a `maxRadius` equal to `deadZone` (both divided by zero and wrote NaN into the reused state, which never recovered), and `applyDeadZone` clamps a dead zone outside `[0, 1)`. Invalid values are clamped and reported once via a `__DEV__`-only warning rather than throwing, since both run in the per-frame input path.
