---
'@flare-engine/share': patch
---

Exports `WebNavigatorLike`, the navigator shape `createWebShareTransport` and
`createWebClipboardTransport` take, and `FileCtorLike`, the optional File-constructor shape
`createWebShareTransport` attaches screenshots with, so a consumer can name them. Nothing else
changes.
