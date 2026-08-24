---
"@flare-engine/react": minor
---

Move web scene capture from a passive effect into the frame callback.

**The bug.** `onPreRender` called `setPicture(pic)` → React re-rendered →
`useEffect` keyed on `[picture]` fired → `capture()` ran → `setImage` →
React re-rendered again. That setState-in-a-passive-effect cascade trips
React's `NESTED_PASSIVE_UPDATE_LIMIT` (50) and logs
`Maximum update depth exceeded` in the browser console on every web page
load containing a `<GameView>`. It also cost two React renders per frame
and delayed the captured scene image by one extra hop before it was painted.

**The fix.** `useWebSceneTexture` is now imperative: it returns a
`capture(picture, width, height)` callback instead of subscribing to a
picture prop through a reactive effect. `GameView`'s `onPreRender` handler
calls `captureWebScene(pic, w * pd, h * pd)` directly — `GameLoop` schedules
via `requestAnimationFrame`, so this is an ordinary root update that never
touches the passive-update counter. This halves the React renders per web
frame and removes one hop of latency between capture and paint.

Native is unchanged: the `else` branch of the new platform split still calls
`setPicture(pic)`, and the `usePictureAsTexture` + `useWebSceneTexture` hook
pair continues to run unconditionally on both platforms so hook order never
varies.
