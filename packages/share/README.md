# @flare-engine/share

Cross-platform screenshot capture (Skia `makeImageSnapshot`) + share-sheet orchestration with pluggable transports. `captureScreenshot(source, opts?)` returns `{ bytes, base64, format, width, height }`. `ShareManager` cascades through registered transports — first one whose `canShare(payload)` returns true wins. Built-in transports cover Web Share API, Web Clipboard fallback, native RN `Share`, and `expo-sharing` (image files, for Android screenshots). `createScreenshotScene` wires a one-shot capture scene for store-asset workflows.

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
  forwards only `title` and `message`, so put a link in `message`; the image is not attached there,
  and a payload with a screenshot but no `message` opens an empty sheet that still reports
  `dispatched: true`.
- `createWebClipboardTransport` copies `message` and `url` text only.
- `createExpoShareTransport` shares the screenshot as an image file; see below.

## Android screenshots

RN's `Share` cannot attach an image on Android. `createExpoShareTransport(sharing, files)` writes
the screenshot to a file and hands its URI to `expo-sharing`. Register it **before** the RN
transport: its `canShare` is true only when the payload has a `screenshot`, so screenshot payloads
reach `expo-sharing` and text-only payloads fall through to RN `Share`.

```ts no-check
import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { createExpoShareTransport, createNativeShareTransport, ShareManager } from '@flare-engine/share';
import type { ShareFileWriterLike } from '@flare-engine/share';

const files: ShareFileWriterLike = {
  async writeBase64File(name, base64) {
    const f = new File(Paths.cache, name);
    await f.write(base64, { encoding: 'base64' });
    return f.uri;
  },
};

const share = new ShareManager()
  .register(createExpoShareTransport(Sharing, files))
  .register(createNativeShareTransport(Share));
```

`files` is one callback that writes base64 data to a file and resolves to its URI. The adapter
above uses the `File` API of `expo-file-system` 58, where `write` creates the file or overwrites
it. With the `expo-file-system/legacy` entry, write it this way instead:

```ts no-check
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import type { ShareFileWriterLike } from '@flare-engine/share';

const files: ShareFileWriterLike = {
  async writeBase64File(name, base64) {
    const uri = `${cacheDirectory}${name}`;
    await writeAsStringAsync(uri, base64, { encoding: 'base64' });
    return uri;
  },
};
```

Limits:

- `expo-sharing` shares one file and no text. The screenshot goes out alone: `message` and `url`
  are dropped, and `title` becomes the chooser's `dialogTitle`.
- The file is always named `screenshot.<format>`, so each share overwrites the previous one.
- The result is `{ dispatched: true, via: 'native' }` once the sheet has opened; `expo-sharing`
  does not say whether the user finished the share. When `isAvailableAsync()` resolves false,
  nothing is written and the result is `{ dispatched: false, via: 'native' }`. A failed write or a
  rejected `shareAsync` rejects the `share()` promise.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineshare--5kb-raw).

## License

Apache-2.0
