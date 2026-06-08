# Pan Tvardowski — Agent Guide

Game-specific rules for `apps/pan-tvardowski/`. Repo-wide conventions in [`../../AGENTS.md`](../../AGENTS.md). Roadmap in [`../../docs/plans/roadmap.md`](../../docs/plans/roadmap.md).

## Engine-first

If a presentation-layer feature requires engine support (postfx compositor, scene transition easing, periodic animation driver, custom shader, runtime API), **the engine session ships first** in `packages/**`; the PT-side wire follows. Never patch engine gaps with PT-local workarounds.

## Visual source of truth

The canonical visual source of truth is [`src/visual-spec/`](src/visual-spec/) — the ~40-file typed TypeScript spec covering palette, typography, shapes, zones, HUD, animations, and more. Read the relevant files there **before** editing presentation-layer code. If this guide and `src/visual-spec/` conflict, `src/visual-spec/` wins.

The 21 PNG folios at [`../../docs/references/pan-tvardowski/folios/`](../../docs/references/pan-tvardowski/folios/) are **historical design decks, not authoritative**. They predate the Kenney placeholder-sprite swap. Do not treat them as the source of truth for any value.

The following 5 brand principles were transcribed from historical folio III and remain valid design intent:

1. Darkness is the canvas (`#0E1A12` ink-black bg).
2. Crimson is ink, not paint (player trail / sigil / brand mark / final-hit flash only).
3. Recolor before redraw (frame shape + tint differentiates).
4. Diacritics are sacred (`ąćęłńóśźż` must render at every size and weight).
5. 60 fps is the gospel (≤ 1k draws · ≤ 512 particles · ≤ 3 postfx stages).

If this guide and code conflict, [`docs/visual-reference.md`](docs/visual-reference.md) is the arbiter; it documents deliberate deviations with rationale.

## Visual-spec workflow lock

All presentation-layer data lives in [`src/visual-spec/`](src/visual-spec/). Edit the typed schema there — never produce HTML/Figma/marketing decks as build input. Deprecated paths (`src/theme/`, `src/palette.ts`, `src/shape-catalogue.ts`, `src/shapes.ts`, `src/shapes-draw.ts`) were deleted across sessions #92–#114 and must not be reintroduced.

## Folio → code map

| Folio | Governs |
|---|---|
| IV — Palette | `src/visual-spec/theme.ts` (`UI_COLORS`) — 12-pigment palette + cb tokens |
| V — Typography | `src/visual-spec/theme.ts` (`TYPOGRAPHY`) — type-scale + font families |
| VI — Skia language | `@flare-engine/shapes` (engine package) |
| VIb — Explosions | `src/fx/explosions.ts` — 5 tiers (Chip/Pop/Burst/Detonation/Cataclysm) |
| IX — HUD | `src/visual-spec/hud.ts` (HUD_SPEC), `src/hud/Hud.tsx` |
| X — Frontmatter | `src/visual-spec/screens.ts`, `src/scenes/{boot,menu,save-select,settings,credits}.ts` |
| XI — Overlays | `src/visual-spec/overlays.ts`, `src/hud/*Overlay.tsx` |
| XII / XIIB — Zones | `src/visual-spec/zones-palette.ts`, `src/visual-spec/zone-{1..8}.ts` |
| XIII — Boss visual beats | `src/systems/boss/*.ts` — per-phase color shift + postfx swap |
| XIIIa — Ship anatomy | `src/visual-spec/shapes-catalogue.ts` — every ship = `hull + N rect weapons + 1 square engine` |
| XIIIb–XIIIf — Ship rosters | `src/visual-spec/shapes-catalogue.ts` (enemies / minibosses / players / bosses) |
| XIIID — Weapon specs | `src/visual-spec/weapons.ts`, `src/config/gameplay.ts` |
| XIV — Motion + a11y | `src/visual-spec/animations.ts`, `src/a11y/reduced-motion.ts` |
| XV — Frame budget | `src/fx/budget.ts` — fps watchdog + per-scene caps |

Textual cross-index: [`docs/visual-reference.md`](docs/visual-reference.md).

## Ship-anatomy 3-element rule (folio XIIIa)

Every ship in `src/visual-spec/shapes-catalogue.ts` — player, enemy, mini-boss, boss — must be exactly:

- 1× hull (variable shape carrying species identity)
- N× weapon rectangles (enemy 1–2, mini-boss 2–3, boss 2–4, player 2)
- 1× engine square (20×20 px) at hull rear

No ad-hoc decorative parts (eyes, horns, antennae) unless the folio shows them. The 3-element rule keeps the codex consistent at 60 fps under 1k draws.

## Art direction

PT v0.1.x is **shape-atlas only — no sprite art**. The presentation layer ends with shapes alone, demonstrating what the engine can do without raster assets. Do not propose, scaffold, or ship sprite-based rendering.

## Release discipline

- **No hardcoded asset paths** in `src/**`. Sprite, audio, and portrait paths come from manifests under `assets/`.
- **Localization-first.** Every user-facing string lives in `locales/en.json` + `locales/pl.json`. Use `t('key')` exclusively; key parity is scripted (`check:locales`).
- **IAP product IDs** live in `src/iap/catalog.ts`. Format: `pan_tvardowski.<product_id_snake>`.
- **Privacy registry.** Subsystems that can send data off-device are listed in `src/privacy/registry.ts` with their opt-in key.
- **Balance freeze.** `BALANCE_FROZEN_AT = '2026-04-28'` in `gameplay.ts` + `zones.ts`. `check:balance` enforces it.
