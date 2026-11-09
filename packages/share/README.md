# @flare-engine/share

Cross-platform screenshot capture (Skia `makeImageSnapshot`) + share-sheet orchestration with pluggable transports. `captureScreenshot(source, opts?)` returns `{ bytes, base64, format, width, height }`. `ShareManager` cascades through registered transports — first one whose `canShare(payload)` returns true wins. Built-in transports cover Web Share API, Web Clipboard fallback, and native RN `Share`. `createScreenshotScene` wires a one-shot capture scene for store-asset workflows.

## Install

```sh
bun add @flare-engine/share
```

## Usage

```ts
import { Share } from 'react-native';
import { captureScreenshot, ShareManager, createNativeShareTransport,
         createWebShareTransport, createWebClipboardTransport } from '@flare-engine/share';
import type { CaptureSource } from '@flare-engine/share';

declare const source: CaptureSource;

const shot = captureScreenshot(source, { format: 'png' });

const share = new ShareManager()
  .register(createNativeShareTransport(Share))
  .register(createWebShareTransport(navigator, File))
  .register(createWebClipboardTransport(navigator));

if (shot) {
  await share.share({ message: 'New high score! https://example.com', screenshot: shot });
}
```

Platform notes:

- `createWebShareTransport` attaches the screenshot as a `File` when the browser's
  `navigator.canShare({ files })` accepts it.
- `createNativeShareTransport` attaches it on iOS as a `data:image/<format>;base64,…` URL, only
  when `url` is unset — an explicit `url` wins and no image is attached then. Android's RN `Share`
  forwards only `title` and `message`, so put a link in `message`; the image is not attached there.
- `createWebClipboardTransport` copies `message` and `url` text only.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineshare--5kb-raw).

## License

Apache-2.0
