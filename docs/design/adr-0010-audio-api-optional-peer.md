# ADR-0010: `react-native-audio-api` is an optional peer, so apps stop installing and compiling it by default

- **Status**: Accepted <!-- owner, 2026-10-23 -->
- **Date**: 2026-10-23
- **Consumer impact**: behaviour-change
- **Release level**: patch

## Context

Verified at HEAD b1a854d on 2026-10-23, against the working tree before this row's diff.

`@flare-engine/audio` (`packages/audio/package.json:39-41`) and `@flare-engine/engine`
(`packages/engine/package.json:68-76`) declare `react-native-audio-api` `>=0.3.0` as a peer, with no
peerDependenciesMeta, so it is a required peer. No file under `packages/*/src` imports it.
`audio-manager.ts:1-4` types the audio context structurally and the app passes one in, which is why
the peer-completeness gate already carried an exception saying `@flare-engine/react` need not
re-declare it.

npm (7 and later) and bun install required peers. Every app that depends on `@flare-engine/engine`
therefore gets the package, all three starter templates included, although none of them plays a
sound. A fresh topdown scaffold on 2026-10-23 had it at `0.13.6` under bun: the newest release, since
the range is open-ended. Expo autolinks every native module it finds, so the package is compiled into
every Android build.

On Windows that compile cannot finish. The manual-test protocol's §1 runner built the topdown
template (`0.4.2`, npm, project at `C:\Users\user\fr-d8Pl\android\my-topdown`, 40 characters) and
failed in the audio package's arm64-v8a native build. Ninja could not create its object directory
("No such file or directory"), after CMake warned that the object directory alone was 186
characters against a 250 maximum. The package compiles sources from outside its CMake source tree, so
CMake mirrors their absolute path inside the object directory and the project path counts twice. For
the file CMake named, the full object path is about twice the project path plus 255 characters. That
is past Windows' 260 for any project path with the SDK's stock CMake 3.22.1. Pan Tvardowski hit the
same failure locally and skips its native audio there; it declares `react-native-audio-api` itself,
as does every app that plays audio.

The same experiment without the package: a topdown scaffold (`0.4.2`, bun) at
`C:\Users\user\fr-verify0\android\my-topdown`, 42 characters, longer than the failing one, with
`node_modules/react-native-audio-api` deleted before prebuild. Its arm64-v8a release build succeeded
on 2026-10-23: a 41.8 MB APK, with Skia, Reanimated and Worklets compiled natively. That is what an
install looks like once the peer is optional.

## Decision

Mark `react-native-audio-api` optional in the peerDependenciesMeta of both `@flare-engine/audio` and
`@flare-engine/engine`, keeping the `>=0.3.0` range as the documented pairing. Package managers then
stop installing it unasked, and an app that plays audio on native adds it itself, as the audio README
already implies. The gate exception for `@flare-engine/react` goes, because an optional peer is
skipped before the exception list is read.

## Consumer impact

- **Who breaks.** An app that plays audio on native through `@flare-engine/audio` but never listed
  `react-native-audio-api` in its own dependencies, relying on the automatic install. Of the known
  consumers, none: Pan Tvardowski declares it (`^0.11.7`), flare-engine-page is web-only and uses the
  browser's audio context, and the templates play no audio.
- **What they see.** On the next fresh install the package is absent, and their own import of it
  fails at bundle time with "Unable to resolve module react-native-audio-api". It is loud, not
  silent: nothing in the engine imports it, so nothing changes at runtime for an app that bundles.
- **Migration.** `bun add react-native-audio-api`, or `npx expo install react-native-audio-api` in an
  Expo app.
- **Everyone else.** Their installs lose an unused native module: a smaller APK, a shorter native
  build, and a Windows Android build that can complete.
- **Why now.** §1 of the manual-test protocol is the launch-critical first-run funnel, and every
  template README leads with `bun run android`. As shipped in `0.4.2`, that command fails for every
  Windows user, and the flip is 2026-10-26.

## Alternatives considered

- **A `react-native.config.js` in each template that switches off autolinking for the package.**
  Fixes the three templates only; every other app still installs and compiles it. It also needs a
  release, since the templates ship inside `@flare-engine/create`.
- **Document "build Android with EAS or WSL on Windows".** Leaves the command every README leads with
  broken for Windows strangers.
- **Drop the peer entirely.** Loses the version pairing that the audio README and the peer gate rely
  on; optional keeps it.
- **Narrow the range.** It would stop the newest-release drift but not the install or the compile.

## What would reverse this

- `@flare-engine/audio` starts importing `react-native-audio-api` directly. A native app would then
  need it, and the peer would have to be required again, or the import made lazy.
- A future Expo or React Native toolchain on Windows builds the package from a normal project path.
  The optional peer would still be right on its merits, but the urgency would be gone.
