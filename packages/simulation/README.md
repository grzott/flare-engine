# @flare-engine/simulation

Continuous-time dynamics: n-body gravity with Plummer softening, Verlet / leapfrog integration, and wave-packet ripple pools.

## Install

```sh
bun add @flare-engine/simulation
```

## Usage

```ts
import { createNBodySystem, leapfrogInto, createRipplePool } from '@flare-engine/simulation';

const nb = createNBodySystem(16);
nb.add(0, 0, 0, 0, 1000);
nb.add(100, 0, 0, 3.16, 1);
nb.step(0.016, 1, 2);

const rp = createRipplePool(32);
rp.emit(0, 0, 0, 20, 100, 30, 2);
const h = rp.heightAt(100, 0, 1);
```

See [API spec](../../docs/design/api-specs.md#flare-enginesimulation).

## License

MIT
