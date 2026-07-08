---
"@flare-engine/share": minor
"@flare-engine/deep-links": minor
---

share + deep-links: platform-adapter correctness.

share: the native transport reported `dispatched` via `res.action !== 'dismissed'`, but React Native's `Share.share` resolves to `Share.sharedAction` (`'sharedAction'`) or `Share.dismissedAction` (`'dismissedAction'`) — never a bare `'dismissed'` — so an iOS Cancel was misreported as `dispatched: true`. Now checks `res.action === 'sharedAction'`.

deep-links: `createWebSource` added one shared `onPop` closure per subscriber, but the DOM dedupes identical `(type, listener, capture)` registrations, so the first `removeEventListener` killed `popstate` navigation for every remaining subscriber. The DOM listener is now ref-counted (added on the first subscriber, removed on the last). Both `onPop` and `notify` now snapshot the listener set (`[...listeners]`) before dispatching, so a handler that subscribes or unsubscribes mid-dispatch no longer changes who receives that dispatch.
