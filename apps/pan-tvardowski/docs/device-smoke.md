# Device Smoke Test — Pan Tvardowski

> **Primary path: automation.** See [smoke-automation.md](./smoke-automation.md). Run
> `bun --cwd apps/pan-tvardowski run smoke:cloud` (TestingBot, OSS free tier) or
> `bun run smoke:local` (Android Studio AVD). This file documents the manual
> 13-row checklist as the **fallback** for ad-hoc checks and as the canonical
> definition of what each Maestro flow row covers.

## Protocol

- Build type: **release** (`--configuration Release` / `--variant release`)
- Network: **airplane mode** (no IAP, no analytics)
- Save state: **fresh save** (delete app data or reinstall before each pass)
- Run each pass twice: once with **EN** locale, once with **PL** locale
- Capture cold-start TTI per device via `[boot-trace]` adb logcat lines (see "Capturing cold-start TTI" below)
- Record results in the tables below before closing the session

## Devices

### Pixel 10 (Android — TestingBot canonical)

| # | Check | Maestro flow | EN | PL |
|---|-------|--------------|----|----|
| 1 | App boots to menu without crash | smoke.yaml + cold-start-tti.yaml | **blocked** — smoke functional flow fails on `assertVisible: "Play"` on Pixel 10 via TestingBot — likely boot→menu scene transition stall; tracked in #156 PT-Smoke-Diagnose | **blocked** — same as EN |
| 2 | Menu nav: Play → Save Select → Back → Settings → Back → Credits → tap-to-return | smoke.yaml | **blocked** — smoke functional flow fails on `assertVisible: "Play"` on Pixel 10 via TestingBot — likely boot→menu scene transition stall; tracked in #156 PT-Smoke-Diagnose | **blocked** — same as EN |
| 3 | Zone 1 — enemies spawn, player shoots, bomb fires, HUD updates | boss-fight.yaml (skeleton) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 4 | Zone 2 — zone transition from z1, banner appears, miniboss spawns | boss-fight.yaml (skeleton) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 5 | Zone 3 — water + fog shader bg renders, Wodnik boss fight starts | boss-fight.yaml (skeleton) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 6 | Settings persist — change language + volumes, close app, reopen, settings retained | smoke.yaml | **blocked** — smoke functional flow fails on `assertVisible: "Play"` on Pixel 10 via TestingBot — likely boot→menu scene transition stall; tracked in #156 PT-Smoke-Diagnose | **blocked** — same as EN |
| 7 | Credits scroll — all 6 sections visible, text in selected locale | smoke.yaml | **blocked** — smoke functional flow fails on `assertVisible: "Play"` on Pixel 10 via TestingBot — likely boot→menu scene transition stall; tracked in #156 PT-Smoke-Diagnose | **blocked** — same as EN |
| 8 | IAP gate at z4 — gate screen shown (airplane mode: no purchase, tap dismiss) | manual (debug HUD pending) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 9 | Codex overlay — opens, fresh-save banner shown, back returns to menu | smoke.yaml | **skip** — deep-link only — no main-menu button; tracked in #156 | **skip** — deep-link only — no main-menu button; tracked in #156 |
| 10 | Achievements overlay — opens, fresh-save banner shown, back returns to menu | smoke.yaml | **skip** — deep-link only — no main-menu button; tracked in #156 | **skip** — deep-link only — no main-menu button; tracked in #156 |
| 11 | Bomb FX — tier-1 explosion visible, screen shake occurs | manual (debug HUD pending) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 12 | Boss fight — boss HP bar visible, phase transition triggers detonation FX | manual (debug HUD pending) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) | **skip** — debug HUD pending (existing skeleton state, unchanged this session) |
| 13 | Reduced-motion toggle — enable in settings, re-enter play, shake/postfx reduced | smoke.yaml | **blocked** — smoke functional flow fails on `assertVisible: "Play"` on Pixel 10 via TestingBot — likely boot→menu scene transition stall; tracked in #156 PT-Smoke-Diagnose | **blocked** — same as EN |

Cold-start TTI (boot-start → first-frame, three runs, take median):

| Run | TTI (ms) |
|-----|----------|
| 1   | **pass** — gate < 3000ms |
| 2   | **pass** — gate < 3000ms |
| 3   | **pass** — gate < 3000ms |
| **median** | **pass** — TTI gate passed (< 3000ms, all 3 iterations); exact median pending re-capture in #156 |

### iPhone 16 Pro (iOS — TestingBot canonical)

| # | Check | Maestro flow | EN | PL |
|---|-------|--------------|----|----|
| 1 | App boots to menu without crash | smoke.yaml + cold-start-tti.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 2 | Menu nav: Play → Save Select → Back → Settings → Back → Credits → tap-to-return | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 3 | Zone 1 — enemies spawn, player shoots, bomb fires, HUD updates | boss-fight.yaml (skeleton) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 4 | Zone 2 — zone transition from z1, banner appears, miniboss spawns | boss-fight.yaml (skeleton) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 5 | Zone 3 — water + fog shader bg renders, Wodnik boss fight starts | boss-fight.yaml (skeleton) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 6 | Settings persist — change language + volumes, close app, reopen, settings retained | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 7 | Credits scroll — all 6 sections visible, text in selected locale | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 8 | IAP gate at z4 — gate screen shown (airplane mode: no purchase, tap dismiss) | manual (debug HUD pending) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 9 | Codex overlay — opens, fresh-save banner shown, back returns to menu | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 10 | Achievements overlay — opens, fresh-save banner shown, back returns to menu | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 11 | Bomb FX — tier-1 explosion visible, screen shake occurs | manual (debug HUD pending) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 12 | Boss fight — boss HP bar visible, phase transition triggers detonation FX | manual (debug HUD pending) | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |
| 13 | Reduced-motion toggle — enable in settings, re-enter play, shake/postfx reduced | smoke.yaml | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating | **deferred** — Apple Developer account pending (#137); revisit after #137 + #155-style Apple ToS gating |

Cold-start TTI (boot-start → first-frame, three runs, take median):

| Run | TTI (ms) |
|-----|----------|
| 1   | **deferred** — Apple Developer account pending (#137) |
| 2   | **deferred** — Apple Developer account pending (#137) |
| 3   | **deferred** — Apple Developer account pending (#137) |
| **median** | **deferred** — Apple Developer account pending (#137) |

## Results

Fill in each cell: **pass**, **fail**, or **skip** (with a reason).

Leave blank until the smoke run is complete.

## Run commands

```bash
# Preferred: Maestro automation (see smoke-automation.md)
APK_PATH=./build.apk bun --cwd apps/pan-tvardowski run smoke:local       # local AVD or attached device
APK_PATH=./build.apk bun --cwd apps/pan-tvardowski run smoke:cloud       # TestingBot real devices

# Fallback: native run (manual interaction required)
bun --cwd apps/pan-tvardowski run android -- --variant=release
```

## Capturing cold-start TTI (manual fallback)

After `markBootMilestone('first-frame')`, `App.tsx` calls `dumpBootTrace()` which prints one
line via `console.log`. In a release build this surfaces through Expo's `RNLog` bridge to
`logcat` under tag `ReactNativeJS`.

```bash
# Clear logcat, launch the app, capture the boot-trace line.
adb -s <device-serial> logcat -c
adb -s <device-serial> shell monkey -p dev.flare.pantvardowski -c android.intent.category.LAUNCHER 1
adb -s <device-serial> logcat -s ReactNativeJS:* | grep "\[boot-trace\]" | head -1
```

Expected output shape:

```
ReactNativeJS: [boot-trace] total=2480.5ms boot-start->providers-mounted=312.4ms providers-mounted->save-loaded=48.7ms save-loaded->audio-ready=210.9ms audio-ready->first-frame=1908.5ms
```

The `total=` field is the cold-start TTI. Run three cold launches per device (kill app between
runs), take the median, write it into the per-device table above, and forward to the session
owner for the `perf-baseline.md` update commit. The automation harness
(`scripts/run-smoke-local.sh` + `scripts/run-smoke-cloud.sh`) does the loop + median + gate
assertion automatically.

If `total > 3000ms` on either device, the row's `cold-start TTI < 3 s` gate fails — do not
mark the session done; open a perf-investigation follow-up row and report the breakdown.

> Document version: session #154 (automation primary, manual fallback).
> Supersedes session #50 / #59 / #107 manual-only versions.
> Updated session #107 follow-up (2026-05-09): TestingBot single Android + single iOS gate, see smoke-automation.md.
> Do NOT mark the session closed until both device columns + median TTI cells are filled.
