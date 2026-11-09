---
'@flare-engine/ui': patch
---

`Button` no longer unregisters and re-registers its focus node when a parent re-render passes a new
`onPress` identity or changes `disabled` / `tabIndex`, so keyboard focus and tab order survive
re-renders. `FocusManager.register` of an already-registered id now updates that node in place
(same tab-order position, focus unchanged), `activate()` skips a disabled focused node, and the
disposer returned by `register` no longer depends on `this`, so it works destructured.
