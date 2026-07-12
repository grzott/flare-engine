# @flare-engine/postfx

Composable Skia RuntimeEffect pipeline — vignette, bloom, CRT, chromatic aberration, grayscale flash. `EffectChain` is an ordered list with `add` / `insert` / `move` / `setEnabled` / `setUniforms`. `createPostFxRuntime(skia)` compiles SkSL on first use and short-circuits to a passthrough on devices without `RuntimeEffect`. `createPostFxController` is a higher-level wrapper for hit-flash / palette swaps.

## Install

```sh
bun add @flare-engine/postfx
```

Peer dep: `@shopify/react-native-skia`.

## Usage

```ts
import {
  EffectChain,
  createVignette,
  createCrt,
  createPostFxRuntime,
} from '@flare-engine/postfx';
import type { SkiaPostFxModuleLike } from '@flare-engine/postfx';

declare const skia: SkiaPostFxModuleLike;
declare const width: number;
declare const height: number;

const chain = new EffectChain();
chain.add(createVignette('vignette', { intensity: 0.4 }));
chain.add(createCrt('crt', { scanlineIntensity: 0.3 }));

const runtime = createPostFxRuntime(skia);
const passes = runtime.buildPass(chain, width, height);
// renderer composites passes into the scene
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginepostfx--8kb-raw).

## License

Apache-2.0
