# create-flare-app

## 0.4.11

### Patch Changes

- e5b58a8: Moves the `blank`, `topdown` and `shmup` templates from Expo SDK 57 to Expo SDK 58: React Native
  0.88.1, React 19.3.0, `@shopify/react-native-skia` 2.14.0, Reanimated 4.7.1 with worklets 0.13.0,
  `react-native-safe-area-context` ~5.11.1 and `react-native-web` ~0.21.4, as listed in
  `expo@58`'s `bundledNativeModules.json`. Every `@flare-engine/*` peer floor is satisfied by the
  new set; `canvaskit-wasm` stays at 0.41.0, the version RN-Skia 2.14.0 pins.
- 0b60e18: Internal refactor: the CLI's `--template` parser now validates through `isTemplateId` and builds its error message and help text from the keys of `TEMPLATES`, so the template ids are listed in one place. No behaviour or API change.

## 0.4.10

### Patch Changes

- 0d2a3d0: Fix the `flare-create` next-step hint hard-coding `bun run start` regardless of the detected
  package manager. Every template manifest carried `postInstall: 'bun run start'` and the CLI printed
  it verbatim, so an npm or pnpm user was told to run a `bun` command, and even with Bun `start` is
  the Expo Go path that every template README warns red-screens on the native Skia module. The
  manifests now carry `run android` without a manager prefix and the CLI prints
  `next: cd <name> && <pm> run android (or: <pm> run ios)` from the detected manager; the
  `--skip-install` line carries the same next step after `<pm> install` instead of only the install
  command. The topdown and shmup READMEs now tell npm/pnpm users that the template tests run on
  Bun's runner and how to get it.
- 89cc4cc: The shmup template registers systems with `sys.worldFn` instead of the deprecated `sys._worldFn`.

## 0.4.9

## 0.4.8

## 0.4.7

## 0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

### Patch Changes

- 0d8afc9: The scaffolder ships as `@flare-engine/create` (bin `flare-create`), published with the rest of the
  scope. Per ADR-0007.

  The unscoped name it was developed under, `create-flare-app`, was never published by this project
  and has belonged to an unrelated npm package since 2026-09-11, so `npm create flare-app` runs that
  package instead. Scaffold with `npm create @flare-engine my-game` (npm, pnpm and yarn map a bare
  `@flare-engine` to `@flare-engine/create`) or `bunx @flare-engine/create my-game`; programmatic use
  imports `scaffoldApp` from `@flare-engine/create`. Templates and options are unchanged.

  `flare new` previously ran `npx create-flare-app`, which now resolves to the other package. It now
  runs `@flare-engine/create` pinned to the CLI's own version, which lockstep versioning guarantees
  exists, so it can never pick up an unscoped package of the same name.

## 0.3.1

## 0.3.0

## 0.2.1

Initial published changelog. Versions before this were cut in lockstep with `@flare-engine/*`
without a per-package changelog entry.
