# @flare-engine/deep-links

URL → scene + params routing with pluggable platform sources. `DeepLinkRouter` supports literal segments, `:param` captures, and a trailing `*` wildcard binding the rest into `params.rest`. `DeepLinkManager` wires a `DeepLinkSource` (web `popstate` / native `Linking` / in-memory) to a router; first-match wins.

## Install

```sh
bun add @flare-engine/deep-links
```

## Usage

```ts
import { Linking } from 'react-native';
import { DeepLinkRouter, DeepLinkManager, createNativeSource, parseUrl } from '@flare-engine/deep-links';

declare const sceneManager: { go(scene: string, params: Record<string, string>): void };

const router = new DeepLinkRouter()
  .register('/zone/:id', 'play')
  .register('/shop', 'shop');

const manager = new DeepLinkManager({ router, source: createNativeSource(Linking) });
manager.onMatch.add((m) => sceneManager.go(m.scene, m.params));
manager.start();

// or stateless:
parseUrl('flare://zone/4?from=shop');
// { scheme: 'flare', host: '', segments: ['zone', '4'], query: { from: 'shop' } }
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedeep-links--6kb-raw).

## License

Apache-2.0
