---
'@flare-engine/dialogue': patch
---

The `ActionHandler` JSDoc now states that the runner ignores the handler's return value: a returned promise is not awaited, the runner continues to the action node's `next` before it settles, and nothing handles its rejection, so an async handler must catch its own errors. Documentation only; the type and the runner's behaviour are unchanged.
