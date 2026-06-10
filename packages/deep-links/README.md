# @flare-engine/deep-links

URL → scene + params routing with pluggable platform sources. `DeepLinkRouter` supports literal segments, `:param` captures, and a trailing `*` wildcard binding the rest into `params.rest`. `DeepLinkManager` wires a `DeepLinkSource` (web `popstate` / native `Linking` / in-memory) to a router; first-match wins.

## Install

```sh
bun add @flare-engine/deep-links
```

## Usage

```ts
import { DeepLinkRouter, DeepLinkManager, createNativeSource, parseUrl } from '@flare-engine/deep-links';

const router = new DeepLinkRouter()
  .register('/zone/:id', 'play')
  .register('/shop', 'shop');

const manager = new DeepLinkManager(router, createNativeSource(Linking));
manager.onMatch.add((m) => sceneManager.go(m.scene, m.params));
manager.start();

// or stateless:
parseUrl('flare://game/zone/4?from=shop');
```

See [API spec](../../docs/design/api-specs.md#flare-enginedeep-links--6kb-raw).

## License

MIT
