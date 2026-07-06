---
"@flare-engine/share": patch
---

share: fix screenshot format codes. `FORMAT_CODES` now matches RN-Skia's `ImageFormat` enum (`{ png: 4, jpeg: 3 }`) — the old `{ png: 3, jpeg: 2 }` made `png` silently emit JPEG bytes and `jpeg` emit nothing (an invalid code). Locked by a contract test that reads the installed `@shopify/react-native-skia` type declaration. `canShare` now derives the shared filename's extension from the screenshot format instead of always using `.png`, matching `share()`.
