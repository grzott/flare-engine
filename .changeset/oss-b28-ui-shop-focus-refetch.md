---
"@flare-engine/ui": minor
"@flare-engine/ui-shop": minor
---

ui + ui-shop: remove the focus auto-select side-effect and refetch the shop on provider change.

**ui — `FocusManager.register()` no longer focuses.** Registering a node used to auto-focus
the first enabled registrant, so on a touch-first tree the first `Button` painted a permanent
focus ring with no input, and it picked mount order over the documented tab order. `register()`
is now side-effect-free; `focusedId` stays `null` until a driver acts. Initial focus is opt-in:
a new `FocusManager.focusFirst()` selects the tab-order first node, and `FocusProvider` gains an
`autoFocus?: boolean` prop that calls it once children register. Both additions are additive.

**ui-shop — `ShopScreen` refetches when the catalog or IAP provider identity changes.** A
once-for-life `fetched` ref meant a Noop→concrete provider swap never refetched products. The
fetch effect is now keyed to `[catalog, provider]` (resetting to the loading state and dropping
a stale in-flight response via a cancelled flag); `onError` is read through a latest-ref so a
fresh inline callback identity cannot trigger a refetch.
