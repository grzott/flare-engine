---
description: "Pan Tvardowski presentation-layer rules. Applied when working on apps/pan-tvardowski/**."
applyTo: "apps/pan-tvardowski/**"
---

# Pan Tvardowski — presentation-layer rules

## Visual source of truth

The canonical visual reference is the 21 PNG folios at [`docs/references/pan-tvardowski/folios/`](../../docs/references/pan-tvardowski/folios/). Read the relevant folio **before** editing presentation-layer code. The textual cross-index lives at [`apps/pan-tvardowski/docs/visual-reference.md`](../../apps/pan-tvardowski/docs/visual-reference.md).

When in doubt, fall back to **folio III — the 5 brand principles** ([`folio-03-brand-principles.png`](../../docs/references/pan-tvardowski/folios/folio-03-brand-principles.png)): darkness is the canvas, crimson is ink not paint, recolor before redraw, diacritics are sacred, 60 fps is the gospel.

If a value in the textual doc conflicts with a folio, the folio wins unless the doc documents a deliberate deviation.

## Folio → code map (read folio first, then edit)

| Folio | Governs |
|---|---|
| [IV — Palette](../../docs/references/pan-tvardowski/folios/folio-04-palette.png) | `src/theme/colors.ts` — 12-pigment palette + cb tokens |
| [V — Typography](../../docs/references/pan-tvardowski/folios/folio-05-typography.png) | `src/theme/typography.ts` — 11 first-class type-scale keys |
| [VI — Skia language](../../docs/references/pan-tvardowski/folios/folio-06-skia-language.png) | `src/shapes-draw.ts`, `src/fx/postfx.ts` — shape primitives, glow recipes, postfx chain ≤ 3 stages |
| [VIb — Explosions](../../docs/references/pan-tvardowski/folios/folio-06b-explosions.png) | `src/fx/explosions.ts` — 5 tiers Chip / Pop / Burst / Detonation / Cataclysm |
| [IX — HUD](../../docs/references/pan-tvardowski/folios/folio-09-hud-play-frame.png) | `src/hud/Hud.tsx`, `src/hud/Hud.styles.ts` — score, combo, zone banner, bombs, HP gradient, weapon meter, boss bar |
| [XI — Overlays](../../docs/references/pan-tvardowski/folios/folio-11-overlays.png) | `src/hud/{Inventory,Codex,Dialogue,Shop,Paywall,Achievements}Overlay.tsx` |
| [XII / XIIB — Zones](../../docs/references/pan-tvardowski/folios/folio-12-zones.png) | `src/palette.ts`, `src/config/zones.ts` — per-zone palette tokens + parallax + ambience + roster |
| [XIII — Boss visual beats](../../docs/references/pan-tvardowski/folios/folio-13-boss-visual-beats.png) | `src/systems/boss/*.ts` — per-phase color shift + postfx swap + particle burst |
| [**XIIIa — Ship anatomy**](../../docs/references/pan-tvardowski/folios/folio-13a-ship-anatomy.png) | **`src/shape-catalogue.ts` — every ship = `hull` + `N rect weapons` + `1 square engine`** |
| [XIIIb — Enemy ships](../../docs/references/pan-tvardowski/folios/folio-13b-enemy-ships.png) | `src/shape-catalogue.ts` enemy section (14 vessels) |
| [XIIIb+ — Mini-bosses](../../docs/references/pan-tvardowski/folios/folio-13b-plus-mini-bosses.png) | `src/shape-catalogue.ts` mini-boss section (4 frigates) |
| [XIIIc — Weapons / artifacts / players](../../docs/references/pan-tvardowski/folios/folio-13c-weapons-artifacts-ships.png) | `src/shape-catalogue.ts` weapon + upgrade + player-ship sections |
| [XIIID — Weapon specs](../../docs/references/pan-tvardowski/folios/folio-13d-weapon-specs.png) | `src/config/weapons.ts` |
| [XIIIf — Boss ships](../../docs/references/pan-tvardowski/folios/folio-13f-boss-ships.png) | `src/shape-catalogue.ts` boss section (8 capital ships) |
| [XIV — Motion + a11y](../../docs/references/pan-tvardowski/folios/folio-14-motion-accessibility.png) | `src/a11y/reduced-motion.ts`, `src/theme/colors.ts` cb tokens |
| [XV — Frame budget](../../docs/references/pan-tvardowski/folios/folio-15-frame-budget.png) | FPS watchdog thresholds — ≤ 1k draws / ≤ 512 particles / ≤ 3 postfx / 60 fps |

## Ship-anatomy 3-element rule (folio XIIIa)

**Every** ship in `src/shape-catalogue.ts` — player, enemy, mini-boss, boss — must be exactly:

- 1× hull (variable shape carrying species identity)
- N× weapon rectangles, mounted on hull silhouette: enemy 1–2, mini-boss 2–3, boss 2–4, player 2
- 1× engine square (20×20 px) at hull rear

Do not add ad-hoc decorative parts (eyes, horns, antennae) unless the folio shows them. The 3-element rule is what makes the codex visually consistent at 60 fps under 1k draws.

## Art direction is intentional

Pan Tvardowski v0.1.x is **shape-atlas only — no sprite art**. The goal is to end the presentation layer with shapes alone, demonstrating what the engine can do without raster assets. Do not propose, scaffold, or ship sprite-based rendering. If a future scope decision flips this (post-launch), the build plan must change first.

## Boundary

`game-builder` modifies `apps/pan-tvardowski/**` only. Do not touch `packages/**` to fix presentation gaps — escalate engine-side gaps (per-trigger postfx decay, `state.timeScale`, Perlin shake, etc.) to `engine-builder` via a session entry.
