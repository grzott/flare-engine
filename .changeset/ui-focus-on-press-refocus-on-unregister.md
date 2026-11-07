---
'@flare-engine/ui': patch
---

Two focus side effects can now be turned off; both defaults are unchanged.

- `Button` gains `focusOnPress?: boolean` (default `true`). With `false`, a press no longer moves
  focus to the button, so a tap on a touch-first screen leaves no focus ring; `onPress` still fires.
- `createFocusManager(opts?)` takes `FocusManagerOptions` with `refocusOnUnregister?: boolean`
  (default `true`). With `false`, unregistering the focused node clears focus to `null` instead of
  moving it to the first node in tab order. Subscribers are notified exactly as before, and a later
  `next()` / `prev()` starts from the first / last node. `FocusManagerOptions` is exported from `.`
  and `./focus`.
