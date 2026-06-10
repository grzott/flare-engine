# create-flare-app

One-shot project scaffolder. Resolved by `npm create flare-app@latest <name>` per npm convention (unscoped name). Produces a runnable Expo + Flare app with a minimal scene + HUD in under 5 minutes on a clean machine. Three templates: `blank` (empty scene), `topdown` (4-direction movement + tilemap), `shmup` (auto-fire + spawner + HUD).

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

For the full-scope showcase, see [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) — the canonical Flare game in its own repo, consuming the engine from npm.

See [API spec](../../docs/design/api-specs.md#create-flare-app--30kb-raw-node-only-standalone-npm-package) and [skill reference](../../.github/skills/create-flare-app/SKILL.md).

## License

MIT
