---
"@flare-engine/share": patch
---

New transport `createExpoShareTransport(sharing, files)` and new exported interface `ShareFileWriterLike` (`{ writeBase64File(name, base64): Promise<string> }`): Android screenshot shares now work through `expo-sharing`. The transport takes an `ExpoSharingLike` module and an app-supplied writer, writes the screenshot as `screenshot.<format>`, and passes the returned file URI to `shareAsync` with `mimeType: 'image/<format>'`. Its `canShare` is true only when the payload has a `screenshot`, so register it before `createNativeShareTransport` and text-only payloads fall through. `expo-sharing` shares one file and no text, so `message` and `url` are dropped and `title` becomes the `dialogTitle`. It reports `via: 'native'`; `dispatched` is true once the sheet has opened and false when `isAvailableAsync()` resolves false. Existing transports are unchanged.
