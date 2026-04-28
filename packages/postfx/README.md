# @flare-engine/postfx

Composable Skia RuntimeEffect pipeline — vignette, bloom, CRT, chromatic aberration, grayscale flash. `EffectChain` is an ordered list with `add` / `insert` / `move` / `setEnabled` / `setUniforms`. `createPostFxRuntime(skia)` compiles SkSL on first use and short-circuits to a passthrough on devices without `RuntimeEffect`. `createPostFxController` is a higher-level wrapper for hit-flash / palette swaps.

## Install

```sh
bun add @flare-engine/postfx
```

Peer dep: `@shopify/react-native-skia`.

## Usage

```ts
import { EffectChain, createVignette, createCrt, createPostFxRuntime } from '@flare-engine/postfx';

const chain = new EffectChain();
chain.add('vignette', createVignette({ intensity: 0.4 }));
chain.add('crt', createCrt({ scanlineStrength: 0.3 }));

const runtime = createPostFxRuntime(skia);
const passes = runtime.buildPass(chain, width, height);
// renderer composites passes into the scene
```

See [API spec](../../docs/design/api-specs.md#flare-enginepostfx--8kb-raw) and [skill reference](../../.github/skills/flare-postfx/SKILL.md).

## License

MIT
