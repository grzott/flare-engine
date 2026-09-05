---
'@flare-engine/engine': patch
'@flare-engine/react': patch
---

Qualify the old-architecture support claim in both shipped READMEs. The `react-native-reanimated
>=3.19.1` and `react-native >=0.79` floors are chosen to keep old-architecture apps viable and
nothing is known to break, but Flare has never been run on one: no scaffolder template can produce
it, since all three pin Expo 57 / RN 0.86 which force `newArchEnabled=true`, and `expo prebuild`
silently overrides an `app.json` opt-out. The READMEs now say "intended but not verified" and link
ADR-0001, which already recorded this — previously the honest version existed only in the ADR,
which does not ship to npm, while the unqualified claim shipped in both READMEs.
