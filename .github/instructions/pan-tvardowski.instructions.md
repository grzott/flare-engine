---
description: "Pan Tvardowski presentation-layer rules. Applied when working on apps/pan-tvardowski/**."
applyTo: "apps/pan-tvardowski/**"
---

# Pan Tvardowski — presentation-layer rules

## Engine-first

If a presentation-layer feature requires engine support (postfx compositor, scene transition easing, periodic animation driver, custom shader, runtime API), **the engine session ships first** in `packages/**`; the PT-side wire follows in the next session. Game-builder never patches engine gaps with PT-local workarounds.

Boundary: `game-builder` modifies `apps/pan-tvardowski/**`; `engine-builder` modifies `packages/**`. Cross-cutting work is split into a `[mixed]` session pair (engine + PT wire) per the engine-first rule.

## Visual source of truth

The 21 PNG folios at [`docs/references/pan-tvardowski/folios/`](../../docs/references/pan-tvardowski/folios/) are canonical. Read the relevant folio **before** editing presentation-layer code.

Folio III (5 brand principles, [`folio-03-brand-principles.png`](../../docs/references/pan-tvardowski/folios/folio-03-brand-principles.png)) overrides taste:

1. Darkness is the canvas (`#0E1A12` ink-black bg).
2. Crimson is ink, not paint (player trail / sigil / brand mark / final-hit flash only).
3. Recolor before redraw (frame shape + tint differentiates).
4. Diacritics are sacred (`ąćęłńóśźż` must render at every size and weight).
5. 60 fps is the gospel (≤ 1k draws · ≤ 512 particles · ≤ 3 postfx stages).

If folio and code conflict, folio wins unless `apps/pan-tvardowski/docs/visual-reference.md` documents a deliberate deviation with rationale.

## Visual-spec workflow lock (since session #116)

All presentation-layer data lives in [`apps/pan-tvardowski/src/visual-spec/`](../../apps/pan-tvardowski/src/visual-spec/). When authoring new visual work, edit the typed schema there — never produce HTML/Figma/marketing decks as build input. Runtime consumers read from `visual-spec/` exports; deprecated paths (`src/theme/`, `src/palette.ts`, `src/shape-catalogue.ts`, `src/shapes.ts`, `src/shapes-draw.ts`) were deleted across sessions #92–#114 and must not be reintroduced.

## Folio → code map

| Folio | Governs |
|---|---|
| [IV — Palette](../../docs/references/pan-tvardowski/folios/folio-04-palette.png) | `src/visual-spec/theme.ts` (`UI_COLORS`) — 12-pigment palette + cb tokens |
| [V — Typography](../../docs/references/pan-tvardowski/folios/folio-05-typography.png) | `src/visual-spec/theme.ts` (`TYPOGRAPHY`) — type-scale + font families |
| [VI — Skia language](../../docs/references/pan-tvardowski/folios/folio-06-skia-language.png) | `@flare-engine/shapes` (engine package) — primitives + draw helpers |
| [VIb — Explosions](../../docs/references/pan-tvardowski/folios/folio-06b-explosions.png) | `src/fx/explosions.ts` — 5 tiers (Chip / Pop / Burst / Detonation / Cataclysm) |
| [IX — HUD](../../docs/references/pan-tvardowski/folios/folio-09-hud-play-frame.png) | `src/visual-spec/hud.ts` (HUD_SPEC), `src/hud/Hud.tsx`, `src/hud/Hud.styles.ts` |
| [X — Frontmatter](../../docs/references/pan-tvardowski/folios/folio-10-frontmatter-screens.png) | `src/visual-spec/screens.ts`, `src/scenes/{boot,menu,save-select,settings,credits}.ts` |
| [XI — Overlays](../../docs/references/pan-tvardowski/folios/folio-11-overlays.png) | `src/visual-spec/overlays.ts`, `src/hud/{Inventory,Codex,Dialogue,Shop,Paywall,Achievements,Pause}Overlay.tsx` |
| [XII / XIIB — Zones](../../docs/references/pan-tvardowski/folios/folio-12-zones.png) | `src/visual-spec/zones-palette.ts`, `src/visual-spec/zone-{1..8}.ts`, `src/config/zones.ts` |
| [XIII — Boss visual beats](../../docs/references/pan-tvardowski/folios/folio-13-boss-visual-beats.png) | `src/systems/boss/*.ts` — per-phase color shift + postfx swap + particle burst |
| [XIIIa — Ship anatomy](../../docs/references/pan-tvardowski/folios/folio-13a-ship-anatomy.png) | `src/visual-spec/shapes-catalogue.ts` — every ship = `hull + N rect weapons + 1 square engine` |
| [XIIIb / XIIIb+ / XIIIc / XIIIf — Ship rosters](../../docs/references/pan-tvardowski/folios/folio-13b-enemy-ships.png) | `src/visual-spec/shapes-catalogue.ts` (enemies / minibosses / players + pickups / bosses) |
| [XIIID — Weapon specs](../../docs/references/pan-tvardowski/folios/folio-13d-weapon-specs.png) | `src/visual-spec/weapons.ts`, `src/config/gameplay.ts` — projectile silhouette + balance |
| [XIV — Motion + a11y](../../docs/references/pan-tvardowski/folios/folio-14-motion-accessibility.png) | `src/visual-spec/animations.ts`, `src/a11y/reduced-motion.ts`, `src/visual-spec/theme.ts` (`UI_COLORS.cb`) |
| [XV — Frame budget](../../docs/references/pan-tvardowski/folios/folio-15-frame-budget.png) | `src/fx/budget.ts` — fps watchdog + per-scene caps (≤1k draws / ≤512 particles / ≤3 postfx / 60 fps) |

Textual cross-index: [`apps/pan-tvardowski/docs/visual-reference.md`](../../apps/pan-tvardowski/docs/visual-reference.md). Closed-session history: [`SESSION_LOG.md`](../../SESSION_LOG.md) (Pan Tvardowski appendix).

## Ship-anatomy 3-element rule (folio XIIIa)

Every ship in `src/visual-spec/shapes-catalogue.ts` — player, enemy, mini-boss, boss — must be exactly:

- 1× hull (variable shape carrying species identity)
- N× weapon rectangles (enemy 1–2, mini-boss 2–3, boss 2–4, player 2)
- 1× engine square (20×20 px) at hull rear

Do not add ad-hoc decorative parts (eyes, horns, antennae) unless the folio shows them. The 3-element rule keeps the codex visually consistent at 60 fps under 1k draws.

## Art direction

Pan Tvardowski v0.1.x is **shape-atlas only — no sprite art**. The presentation layer ends with shapes alone, demonstrating what the engine can do without raster assets. Do not propose, scaffold, or ship sprite-based rendering. If a future scope decision flips this (post-launch), the build plan must change first.
