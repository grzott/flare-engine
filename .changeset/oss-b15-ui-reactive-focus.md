---
"@flare-engine/ui": minor
---

Reactive focus: `FocusProvider` now publishes `{ manager, focusedId }` as context state so `Button` and other consumers re-render on focus moves (the old provider-only force-render never repainted focus rings). Adds the `useFocusedId` hook and `FocusContextValue` type; `useFocusManager()` is unchanged. `FocusContext`'s value generic widens from `FocusManager | null` to `FocusContextValue | null` (only affects code reading the context directly rather than via `FocusProvider`).
