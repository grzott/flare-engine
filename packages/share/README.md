# @flare-engine/share

Cross-platform screenshot capture (Skia `makeImageSnapshot`) + share-sheet orchestration with pluggable transports. `captureScreenshot(source, opts?)` returns `{ bytes, base64, format, width, height }`. `ShareManager` cascades through registered transports — first one whose `canShare(payload)` returns true wins. Built-in transports cover Web Share API, Web Clipboard fallback, and native RN `Share`. `createScreenshotScene` wires a one-shot capture scene for store-asset workflows.

## Install

```sh
bun add @flare-engine/share
```

## Usage

```ts
import { captureScreenshot, ShareManager, createNativeShareTransport,
         createWebShareTransport, createWebClipboardTransport } from '@flare-engine/share';

const shot = captureScreenshot(skiaCanvasRef.current, { format: 'png' });

const share = new ShareManager()
  .register(createNativeShareTransport(Share))
  .register(createWebShareTransport(navigator, File))
  .register(createWebClipboardTransport(navigator));

if (shot) {
  await share.share({ message: 'New high score!', url: 'https://example.com', screenshot: shot });
}
```

See [API spec](../../docs/design/api-specs.md#flare-engineshare--5kb-raw).

## License

MIT
