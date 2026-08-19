# create-flare-app

One-shot project scaffolder. Resolved by `npm create flare-app@latest <name>` per npm convention (unscoped name). Produces a runnable Expo + Flare app with a minimal scene + HUD in under 5 minutes on a clean machine. Three templates: `blank` (single centered sprite — smallest starting point), `topdown` (analog movement + tilemap collision + camera follow), `shmup` (auto-fire + spawner + HUD).

## Install

Run via your package manager's `create` shortcut — no install needed:

```sh
npm create flare-app@latest my-game -- --template shmup
# or
bun create flare-app my-game --template shmup
```

## Usage

```sh
create-flare-app my-game [--template blank|topdown|shmup] \
                         [--package-manager bun|npm|pnpm] \
                         [--skip-install]
```

Programmatic API:

```ts
import { scaffoldApp } from 'create-flare-app';

await scaffoldApp({ name: 'my-game', template: 'shmup', packageManager: 'bun' });
```

For full-scope showcases built on Flare, see [flareengine.dev](https://flareengine.dev).

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#create-flare-app--30kb-raw-node-only-standalone-npm-package).

## License

Apache-2.0
