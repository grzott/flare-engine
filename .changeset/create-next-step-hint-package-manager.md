---
'@flare-engine/create': patch
---

Fix the `flare-create` next-step hint hard-coding `bun run start` regardless of the detected
package manager. Every template manifest carried `postInstall: 'bun run start'` and the CLI printed
it verbatim, so an npm or pnpm user was told to run a `bun` command, and even with Bun `start` is
the Expo Go path that every template README warns red-screens on the native Skia module. The
manifests now carry `run android` without a manager prefix and the CLI prints
`next: cd <name> && <pm> run android (or: <pm> run ios)` from the detected manager; the
`--skip-install` line carries the same next step after `<pm> install` instead of only the install
command. The topdown and shmup READMEs now tell npm/pnpm users that the template tests run on
Bun's runner and how to get it.
