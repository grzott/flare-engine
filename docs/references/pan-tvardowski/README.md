# Pan Tvardowski — Reference Material

The 21 PNG folios in [`folios/`](folios/) are the **canonical visual source of truth** for Pan Tvardowski's presentation layer. Every pixel value, layout decision, palette token, ship silhouette, HUD position, particle tier, and boss phase color shown there is the design target.

The textual cross-index at [`apps/pan-tvardowski/docs/visual-reference.md`](../../../apps/pan-tvardowski/docs/visual-reference.md) maps each folio to live code symbols (file:line) and tracks open migrations. **If a value in that doc conflicts with a folio, the folio wins** unless the doc explicitly documents a deliberate deviation with a rationale.

## Folio index

| Folio | Topic | Governs |
|---|---|---|
| [I](folios/folio-01-cover.png) | Cover | Brand voice (alchemist's reference, crimson 213D, Garamond italic) |
| [II](folios/folio-02-index.png) | Book in ten parts | Chapter map for the deck — orientation only |
| [III](folios/folio-03-brand-principles.png) | Brand principles | The 5 principles: darkness is the canvas, crimson is ink not paint, recolor before redraw, diacritics are sacred, 60 fps is the gospel |
| [IV](folios/folio-04-palette.png) | The Twelve Pigments | `apps/pan-tvardowski/src/theme/colors.ts` |
| [V](folios/folio-05-typography.png) | Typography (3 voices) | `apps/pan-tvardowski/src/theme/typography.ts` |
| [VI](folios/folio-06-skia-language.png) | Skia language — no sprites, only shapes | `apps/pan-tvardowski/src/shapes-draw.ts`, `src/fx/postfx.ts` |
| [VIb](folios/folio-06b-explosions.png) | Explosions 5-tier | `apps/pan-tvardowski/src/fx/explosions.ts` |
| [IX](folios/folio-09-hud-play-frame.png) | HUD live-game frame | `apps/pan-tvardowski/src/hud/Hud.tsx` + `Hud.styles.ts` |
| [X](folios/folio-10-frontmatter-screens.png) | Boot / menu / save-select / settings / credits | `apps/pan-tvardowski/src/scenes/*.ts` frontmatter |
| [XI](folios/folio-11-overlays.png) | Inventory / Codex / Dialogue / Shop / Paywall overlays | `apps/pan-tvardowski/src/hud/*Overlay.tsx` |
| [XII](folios/folio-12-zones.png) | 8 zones — palette + parallax + ambience | `apps/pan-tvardowski/src/palette.ts`, `src/config/zones.ts` |
| [XIIB](folios/folio-12b-zone-specs.png) | Zone specs canonical table | engine source-of-truth for `ZONE_SPECS` |
| [XIII](folios/folio-13-boss-visual-beats.png) | Boss visual beats (per-phase color + postfx + particle) | `apps/pan-tvardowski/src/systems/boss/*.ts` |
| [**XIIIa**](folios/folio-13a-ship-anatomy.png) | **Ship anatomy 3-element rule** | **every ship in `src/shape-catalogue.ts`** |
| [XIIIb](folios/folio-13b-enemy-ships.png) | Enemy ships (14 vessels) | `apps/pan-tvardowski/src/shape-catalogue.ts` enemy section |
| [XIIIb+](folios/folio-13b-plus-mini-bosses.png) | Mini-bosses (4 frigates) | `apps/pan-tvardowski/src/shape-catalogue.ts` mini-boss section |
| [XIIIc](folios/folio-13c-weapons-artifacts-ships.png) | Weapons / artifacts / 3 player ships | `apps/pan-tvardowski/src/shape-catalogue.ts` weapon + upgrade + ship sections |
| [XIIID](folios/folio-13d-weapon-specs.png) | Weapon specs canonical table | `apps/pan-tvardowski/src/config/weapons.ts` |
| [XIIIf](folios/folio-13f-boss-ships.png) | Bosses (8 capital ships) | `apps/pan-tvardowski/src/shape-catalogue.ts` boss section |
| [XIV](folios/folio-14-motion-accessibility.png) | Motion easings + reduced-motion + color-blind | `apps/pan-tvardowski/src/a11y/reduced-motion.ts`, `src/theme/colors.ts` |
| [XV](folios/folio-15-frame-budget.png) | Frame budget per scene | FPS watchdog thresholds |

## The single most consequential rule

**Folio XIIIa — ship anatomy 3-element rule.** Every ship in the codex (player, enemy, mini-boss, boss — 29 in total) is constructed from exactly three primitive parts:

- 1× **hull** — variable shape carrying species identity (triangle, ellipse, step, drop, pie, moon, star, xor, or, pointed_oval, delay, dataStorage, offPageConnector, merge_or_storage)
- N× **weapon rectangles** mounted on the hull silhouette — count by tier: enemy 1–2, mini-boss 2–3, boss 2–4, player 2
- 1× **engine square** mounted at hull rear, 20×20 px, drives the crimson-flame trail particle

Hue families are tier-tagged: enemies span the rainbow (per species), mini-bosses sit in the crimson family, bosses in the violet family, players carry their own brand color (Kogut = gold, Twardoń = green, Bazyl = blue).

## The 5 brand principles (folio III)

1. **Darkness is the canvas.** Backgrounds default to ink-black `#0E1A12`. Light is reserved for the player ship, gold UI, and crimson sigils.
2. **Crimson is ink, not paint.** Player trail, sigil, brand mark, final-hit flash. Never decoration; if it's red and not flashing, it's wrong.
3. **Recolor before redraw.** Icons repeat across entities — frame shape + tint differentiates. The grimoire is supposed to feel hand-stamped.
4. **Diacritics are sacred.** `ąćęłńóśźż` — if a font breaks them, the font does not ship.
5. **60 fps is the gospel.** ≤ 1k draws · ≤ 512 particles · ≤ 3 postfx stages. Beauty inside the budget.

These principles override taste. When in doubt, fall back to them.
