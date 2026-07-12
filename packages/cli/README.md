# @flare-engine/cli

Node-only dev tool. Three commands: `flare pack-atlas` (sprite folder → TexturePacker-compatible JSON + atlas PNG), `flare tiled-to-flare` (Tiled `.tmj` → normalized runtime JSON for `@flare-engine/tilemap`), and `flare new` (alias for `create-flare-app`). Programmatic equivalents (`packAtlas`, `convertTiled`) are exported so CI and integration tests can call them without shelling out.

## Install

```sh
bun add -d @flare-engine/cli
```

Requires Node 20+; uses `sharp` for image work and `commander` for arg parsing.

## Usage

```sh
flare pack-atlas ./sprites --out ./assets --padding 2 --max-size 2048 --format png
flare tiled-to-flare ./maps/zone1.tmj --out ./assets/zone1.json          # embeds tilesets (default)
flare tiled-to-flare ./maps/zone1.tmj --out ./assets/zone1.json --no-embed-tilesets  # keep external refs
flare new my-game --template shmup --package-manager bun
```

Or programmatically:

```ts
import { packAtlas, convertTiled } from '@flare-engine/cli';

await packAtlas({ input: './sprites', out: './assets', padding: 2 });
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginecli--15kb-raw-node-only).

## License

Apache-2.0
