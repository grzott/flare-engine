# @flare-engine/create

One-shot project scaffolder. Produces a runnable Expo + Flare app with a minimal scene + HUD in under 5 minutes on a clean machine. Three templates: `blank` (single centered sprite — smallest starting point), `topdown` (analog movement + tilemap collision + camera follow), `shmup` (auto-fire + spawner + HUD).

## Install

Run via your package manager's `create` shortcut — no install needed. npm, pnpm and yarn map a bare `@flare-engine` to this package:

```sh
npm create @flare-engine my-game -- --template shmup
# or
pnpm create @flare-engine my-game --template shmup
# or (bun create only resolves unscoped names)
bunx @flare-engine/create my-game --template shmup
```

`npm create flare-app` is **not** this package: `create-flare-app` on npm belongs to an unrelated project.

## Usage

```sh
flare-create my-game [--template blank|topdown|shmup] \
                     [--package-manager bun|npm|pnpm] \
                     [--skip-install]
```

`flare new` in [`@flare-engine/cli`](https://github.com/grzott/flare-engine/tree/main/packages/cli) runs the same scaffolder.

Programmatic API:

```ts
import { scaffoldApp } from '@flare-engine/create';

await scaffoldApp({ name: 'my-game', template: 'shmup', packageManager: 'bun' });
```

For full-scope showcases built on Flare, see [flareengine.dev](https://flareengine.dev).

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginecreate--35kb-raw-node-only).

## License

Apache-2.0
