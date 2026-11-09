---
'@flare-engine/share': patch
---

`createNativeShareTransport` now passes a `screenshot` to RN `Share` as a
`data:image/<format>;base64,…` `url` when the payload sets no `url`, so iOS attaches it as the
image and a screenshot-only payload no longer trips RN's "URL or message" check; an explicit `url`
still wins. Android's RN `Share` forwards only `title` and `message`, which the docs now say, and
the README example puts the link in `message` so the image actually attaches.
