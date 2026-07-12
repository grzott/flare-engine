---
"@flare-engine/ui": minor
"@flare-engine/ui-shop": minor
"@flare-engine/react": minor
"@flare-engine/engine": minor
"@flare-engine/devtools": minor
"@flare-engine/testing": minor
"@flare-engine/cli": minor
"@flare-engine/achievements": minor
"@flare-engine/iap": minor
---

README truth pass (ui / integration / tooling tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme` — all 41 packages green) and api-specs links are absolute.

- Snippets corrected to the real API: `ui` `Button` takes `label` (not children); `react` `<VirtualJoystick onStateChange={…}>` inside a component (the empty-arrow parse error is gone); `devtools` `DevtoolsProvider` requires `snapshot`/`world`/`loop` and `useEntityInspector` exposes `entities` (not `components`); `testing` demonstrates the utility without the unavailable `expect` global; `ui-shop`/`iap`/`achievements` declare their context/store/gate placeholders with the real exported types (`NoopIAPProvider`, `AchievementsStore`, `canAccessContent`).
- `create-flare-app` (private) had its showcase link pointed at flareengine.dev.

(Root `README.md`/`CONTRIBUTING.md` also updated — status block to the 0.3.0 lockstep/October public flip, restricted-npm section removed, lockstep versioning story, flarerpg.org disambiguation, stub→shipping honesty for the tier-2 + haptics rows — but those are repo-root docs, not shipped in any tarball.)
