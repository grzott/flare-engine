# Device Smoke Test — Pan Tvardowski

## Protocol

- Build type: **release** (`--configuration Release` / `--variant release`)
- Network: **airplane mode** (no IAP, no analytics)
- Save state: **fresh save** (delete app data or reinstall before each pass)
- Run each pass twice: once with **EN** locale, once with **PL** locale
- Record results in the table below before closing the session

## Devices

### Galaxy A54 (Android)

| # | Check | EN | PL |
|---|-------|----|----|
| 1 | App boots to menu without crash | | |
| 2 | Menu nav: Play → Save Select → Back → Settings → Back → Credits → tap-to-return | | |
| 3 | Zone 1 — enemies spawn, player shoots, bomb fires, HUD updates | | |
| 4 | Zone 2 — zone transition from z1, banner appears, miniboss spawns | | |
| 5 | Zone 3 — tilemap background scrolls, Wodnik boss fight starts | | |
| 6 | Settings persist — change language + volumes, close app, reopen, settings retained | | |
| 7 | Credits scroll — all 6 sections visible, text in selected locale | | |
| 8 | IAP gate at z4 — gate screen shown (airplane mode: no purchase, tap dismiss) | | |
| 9 | Codex overlay — opens, fresh-save banner shown, back returns to menu | | |
| 10 | Achievements overlay — opens, fresh-save banner shown, back returns to menu | | |
| 11 | Bomb FX — tier-1 explosion visible, screen shake occurs | | |
| 12 | Boss fight — boss HP bar visible, phase transition triggers detonation FX | | |
| 13 | Reduced-motion toggle — enable in settings, re-enter play, shake/postfx reduced | | |

### iPhone (iOS)

| # | Check | EN | PL |
|---|-------|----|----|
| 1 | App boots to menu without crash | | |
| 2 | Menu nav: Play → Save Select → Back → Settings → Back → Credits → tap-to-return | | |
| 3 | Zone 1 — enemies spawn, player shoots, bomb fires, HUD updates | | |
| 4 | Zone 2 — zone transition from z1, banner appears, miniboss spawns | | |
| 5 | Zone 3 — tilemap background scrolls, Wodnik boss fight starts | | |
| 6 | Settings persist — change language + volumes, close app, reopen, settings retained | | |
| 7 | Credits scroll — all 6 sections visible, text in selected locale | | |
| 8 | IAP gate at z4 — gate screen shown (airplane mode: no purchase, tap dismiss) | | |
| 9 | Codex overlay — opens, fresh-save banner shown, back returns to menu | | |
| 10 | Achievements overlay — opens, fresh-save banner shown, back returns to menu | | |
| 11 | Bomb FX — tier-1 explosion visible, screen shake occurs | | |
| 12 | Boss fight — boss HP bar visible, phase transition triggers detonation FX | | |
| 13 | Reduced-motion toggle — enable in settings, re-enter play, shake/postfx reduced | | |

## Results

Fill in each cell: **pass**, **fail**, or **skip** (with a reason).

Leave blank until the smoke run is complete.

## Run commands

```bash
# Android (Galaxy A54)
bun --cwd apps/pan-tvardowski run android

# iOS (iPhone)
bun --cwd apps/pan-tvardowski run ios
```

> This document is the gate artifact for the device-smoke step of session #50.
> The user runs these commands manually on physical devices.
> Do NOT mark the session closed until both device columns are filled.
