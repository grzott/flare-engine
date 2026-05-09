# Smoke Automation — Pan Tvardowski

Cloud + local Maestro automation for the device-smoke gate. Replaces the manual
13-row checklist as the **primary** path; the manual checklist
([device-smoke.md](./device-smoke.md)) remains as fallback for ad-hoc checks.

## Tool stack

| Layer | Tool | Why |
|---|---|---|
| Flow authoring | [Maestro](https://maestro.dev) (open-source) | Declarative YAML, framework-agnostic, Expo-endorsed for RN |
| Local runner | Maestro CLI + Android Studio AVD | Free fast iteration, validates flows before paying for cloud minutes |
| Cloud runner | [TestingBot](https://testingbot.com) (free for OSS) | First-class Maestro support, real Android + iOS devices, OSS free tier covers Flare |
| Cold-start TTI | `dumpBootTrace()` in `App.tsx` + `parse-boot-trace.ts` | One `[boot-trace]` line per cold launch; harness parses + asserts `< 3000ms` median |

## Flows

| File | Status | Covers (rows from [device-smoke.md](./device-smoke.md)) |
|---|---|---|
| `.maestro/smoke.yaml` | live | 1, 2, 6, 7, 9, 10, 13 — boot, menu nav, settings persist, credits, codex, achievements, reduced-motion |
| `.maestro/cold-start-tti.yaml` | live | 1 + cold-start TTI capture (driven N times by harness) |
| `.maestro/boss-fight.yaml` | skeleton | 3, 4, 5, 8, 11, 12 — Zone 1-3 progression + boss + bomb FX. **Blocked on debug HUD** that exposes game state as readable text. |

## Device tier matrix

The TTI gate passes only if every device's median is `< 3000ms`. Functional smoke
must pass on both primary devices.

### Primary gate (canonical real-hardware path)

| Platform | TestingBot device | OS | Role |
|---|---|---|---|
| Android | Pixel 10 | 16 | Android flagship; latest API; new-OS regressions |
| iOS | iPhone 16 Pro | 18 | iOS flagship; first real-device iOS coverage |

Both devices run in sequence via `bun run smoke:cloud` (no-arg default). Each
device runs `cold-start-tti.yaml` once + `smoke.yaml` once. TTI median gate
applies to both.

### Future expansion (optional, not part of the release gate)

The 3-tier Android matrix below is retained for extended coverage but is not
required for release sign-off:

| Tier | TestingBot device | OS | Why |
|---|---|---|---|
| Low | Galaxy A12 | 11 | Older mid-range; catches stale-API + slow-storage regressions |
| Mid | Galaxy A55 | 14 | Mainstream Android |
| High | Pixel 10 | 16 | Already in primary gate; included here for parity |

Run individual tiers via `bun run smoke:cloud:low`, `smoke:cloud:mid`,
`smoke:cloud:high`. These are power-user paths; they do not block release.

## Setup — first run

### 1. Maestro CLI

```bash
curl -Ls https://get.maestro.mobile.dev | bash
maestro --version   # expect >= 2.5.1
```

Windows alternative: download the latest installer from the Maestro releases page.

### 2. TestingBot OSS free tier

1. Sign up at [testingbot.com](https://testingbot.com).
2. Go to your dashboard → submit a "convert to open-source" request, citing the
   Flare engine repo (MIT-licensed).
3. Once approved, copy your API key + secret from the user settings page.
4. Add to your local shell profile (do **not** commit):

   ```bash
   export TESTINGBOT_KEY="..."
   export TESTINGBOT_SECRET="..."
   ```

5. Install the CLI:

   ```bash
   npm install -g @testingbot/cli
   ```

The OSS tier includes unlimited testing + 2 concurrent sessions across the full
device catalog. Paid tier is $20/mo if OSS is rejected.

### 3. Local Android Studio AVD (for fast iteration)

1. Install Android Studio.
2. AVD Manager → create a Pixel AVD (any Pixel 6+ image, API 34/35, with Google APIs) — a Pixel 7 or Pixel 8 is ideal for local iteration before promoting to the Pixel 10 cloud run.
3. Boot it before invoking `bun run smoke:local`.

## Daily run

### Local (no cost, fast)

```bash
# Start an emulator first (Android Studio AVD or any attached device).
APK_PATH=./build.apk bun --cwd apps/pan-tvardowski run smoke:local
# Or skip APK_PATH if the app is already installed.
```

The script:
1. Detects the connected device or emulator.
2. Installs the APK if `APK_PATH` is set.
3. Runs `smoke.yaml` (functional flow).
4. Runs `cold-start-tti.yaml` 3× and parses each `[boot-trace]` line; asserts
   median `< 3000ms`.

### Cloud (real devices, OSS free tier)

```bash
# Build release artifacts first (Android + iOS).
eas build --profile preview --platform android --local
eas build --profile preview --platform ios --local
# Run the canonical gate: Pixel 10 (Android) then iPhone 16 Pro (iOS).
APK_PATH=./build-*.apk IPA_PATH=./build-*.ipa bun --cwd apps/pan-tvardowski run smoke:cloud
# Or one platform at a time:
APK_PATH=./build-*.apk bun --cwd apps/pan-tvardowski run smoke:cloud:android
IPA_PATH=./build-*.ipa bun --cwd apps/pan-tvardowski run smoke:cloud:ios
```

Each device runs `cold-start-tti.yaml` once + `smoke.yaml` once. Artifact logs
(including logcat) are downloaded; the TTI gate parses the `[boot-trace]` line
from each.

## Result schema

`scripts/parse-boot-trace.ts` and `scripts/tti-gate.ts` emit JSON to stdout:

```json
{
  "device": "Pixel 10 (android)",
  "runs": [
    { "label": "boot-trace", "totalMs": 2480.5, "deltas": { "boot-start->providers-mounted": 312.4, ... } },
    { "label": "boot-trace", "totalMs": 2390.0, "deltas": { ... } },
    { "label": "boot-trace", "totalMs": 2410.0, "deltas": { ... } }
  ],
  "medianTotalMs": 2410.0,
  "threshold": 3000,
  "passed": true
}
```

Pipe into `jq '.medianTotalMs'` or fold into `docs/perf-baseline.md` post-run.

## When a flow fails

1. Maestro flow assertion failure — re-run with `--verbose` (CLI) or check the
   TestingBot session video. Fix the flow YAML or the failing UI.
2. TTI gate breach (`passed: false`) — open a perf-investigation row in
   `docs/plans/sessions.md`. Don't paper over with a higher threshold without
   architect sign-off.
3. No `[boot-trace]` line captured — verify `dumpBootTrace()` is still wired in
   `App.tsx:424` immediately after `markBootMilestone('first-frame')`. Verify
   metro config isn't stripping `console.log` in release builds.

## When to update flows

- **Locale string change** — `smoke.yaml` matches against EN strings; update the
  `tapOn:` matchers when `locales/en.json` changes button text. PL parity is
  enforced by `bun run check:locales`; PL strings differ visually but Maestro's
  EN-only matchers are unaffected.
- **New menu / overlay button** — add a row in `smoke.yaml` mirroring the
  matching row in `device-smoke.md`.
- **Game state assertion (rows 3-5, 8, 11, 12)** — blocked on a debug HUD that
  exposes `aliveEnemies`, `bossHp`, `currentZone` as readable text. Tracked as a
  follow-up row in `docs/plans/sessions.md`.

## Cost expectation

| Path | Cost | Cadence |
|---|---|---|
| Local (smoke:local) | $0 | Every PR / per-commit if you want |
| Cloud (smoke:cloud, OSS free) | $0 | Every release branch, every PR if approved for OSS tier |
| Cloud (smoke:cloud, paid) | ~$20/mo | Same; only relevant if OSS request rejected |
| Cloud (smoke:cloud:low/mid/high, OSS) | $0 | Optional; future 3-tier expansion path |
