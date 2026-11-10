---
'@flare-engine/share': patch
---

`createNativeShareTransport` now passes a `screenshot` to RN `Share` as a
`data:image/<format>;base64,…` `url` when the payload sets no `url`, so iOS attaches it as the
image; an explicit `url` still wins. A screenshot-only payload no longer trips RN's "URL or
message" check, so it shares the image on iOS, but on Android, where RN's `Share` forwards only
`title` and `message`, it now opens an empty sheet that reports `dispatched: true` instead of
rejecting. The docs say so, and the README example puts the link in `message`.

<!-- symbols-ok: Share -->
