# Pan Tvardowski — Visual Reference (textual cross-index)

## §0 — Source of truth

The canonical visual source of truth for Pan Tvardowski is [`src/visual-spec/`](../src/visual-spec/) — approximately 40 typed TypeScript files covering palette, typography, shapes, zones, HUD, animations, and more. All presentation-layer data is encoded there. If this doc and `src/visual-spec/` conflict, `src/visual-spec/` wins.

The 21 PNG folios at [`docs/references/pan-tvardowski/folios/`](../../../docs/references/pan-tvardowski/folios/) are **retired historical design decks**. They predate the Kenney placeholder-sprite swap and are no longer authoritative. They are kept only as a historical archive in the engine monorepo root and are not carried into the standalone PT repo. Do not treat them as the source of truth for any value.

This document is a textual cross-index: each section maps design intent to live code symbols and tracks open migrations.

Historical folio cross-index (archive reference only — folios are retired):

| Folio | Section | Topic |
|---|---|---|
| [I](../../../docs/references/pan-tvardowski/folios/folio-01-cover.png) | — | Brand voice |
| [II](../../../docs/references/pan-tvardowski/folios/folio-02-index.png) | — | Deck chapter map |
| [III](../../../docs/references/pan-tvardowski/folios/folio-03-brand-principles.png) | §0.1 | The 5 brand principles |
| [IV](../../../docs/references/pan-tvardowski/folios/folio-04-palette.png) | §1 | Twelve-pigment palette |
| [V](../../../docs/references/pan-tvardowski/folios/folio-05-typography.png) | §2 | Typography |
| [VI](../../../docs/references/pan-tvardowski/folios/folio-06-skia-language.png) + [XIIIa](../../../docs/references/pan-tvardowski/folios/folio-13a-ship-anatomy.png) | §3 | Skia language + ship anatomy |
| [VIb](../../../docs/references/pan-tvardowski/folios/folio-06b-explosions.png) | §6 | Explosion tiers |
| [IX](../../../docs/references/pan-tvardowski/folios/folio-09-hud-play-frame.png) | §7 | HUD anatomy |
| [XII](../../../docs/references/pan-tvardowski/folios/folio-12-zones.png) / [XIIB](../../../docs/references/pan-tvardowski/folios/folio-12b-zone-specs.png) | §9 | Zone specs |
| [XIII](../../../docs/references/pan-tvardowski/folios/folio-13-boss-visual-beats.png) / [XIIIf](../../../docs/references/pan-tvardowski/folios/folio-13f-boss-ships.png) | §10 | Boss specs |
| [XIV](../../../docs/references/pan-tvardowski/folios/folio-14-motion-accessibility.png) | §11 | Motion + accessibility |
| [XV](../../../docs/references/pan-tvardowski/folios/folio-15-frame-budget.png) | §12 | Frame budget |

### §0.1 — The 5 brand principles (folio III)

These override taste. When in doubt, fall back to them.

1. **Darkness is the canvas.** Backgrounds default to ink-black `#0E1A12`. Light is reserved for the player ship, gold UI, and crimson sigils.
2. **Crimson is ink, not paint.** Player trail, sigil, brand mark, final-hit flash. Never decoration; if it's red and not flashing, it's wrong.
3. **Recolor before redraw.** Icons repeat across entities — frame shape + tint differentiates. The grimoire is supposed to feel hand-stamped.
4. **Diacritics are sacred.** `ąćęłńóśźż` must render at every size and weight. If a font breaks them, the font does not ship.
5. **60 fps is the gospel.** ≤ 1k draws · ≤ 512 particles · ≤ 3 postfx stages. Beauty inside the budget.

---

## §1 — Palette

Folio reference: [folio-04-palette.png](../../../docs/references/pan-tvardowski/folios/folio-04-palette.png).

### 12-pigment system — done at session #67

| Token | Folio IV hex | Code symbol | File:line | Status |
|---|---|---|---|---|
| `gold` | `#C9A24A` | `UI_COLORS.gold` / `UI_COLORS.primary` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `crimson` | `#D4213D` | `UI_COLORS.crimson` / `UI_COLORS.secondary` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `hazard` | `#E84B2A` | `UI_COLORS.hazard` / `UI_COLORS.hazardOrange` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `ink-black` | `#0E1A12` | `UI_COLORS.inkBlack` / `UI_COLORS.bodyBg` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `parchment` | `#E8DCC4` | `UI_COLORS.parchment` / `UI_COLORS.neutralLight` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `bog-green` | `#1A2E1F` | `UI_COLORS.bogGreen` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `moss` | `#243A29` | `UI_COLORS.moss` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `verdigris` | `#4A7A6A` | `UI_COLORS.verdigris` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `bone` | `#C7B89A` | `UI_COLORS.bone` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `rust` | `#8B3A1F` | `UI_COLORS.rust` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `terracotta` | `#B05A3C` | `UI_COLORS.terracotta` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `void` | `#050A07` | `UI_COLORS.void` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `parchment-2` | `#D9C9A8` | `UI_COLORS.parchment2` / `UI_COLORS.neutralMid` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `parchment-dim` | `#A8997A` | `UI_COLORS.parchmentDim` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `gold-deep` | `#8E6F2C` | `UI_COLORS.goldDeep` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `crimson-deep` | `#7A1322` | `UI_COLORS.crimsonDeep` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |
| `safe` | `#6FA66B` | `UI_COLORS.safe` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — #67 |

All tokens in [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) (`UI_COLORS`) — done at session #67; migrated to `visual-spec/` at session #114.

### HP-bar anchor disambiguation

Two distinct values; do not conflate:

- **`#2a0810`** — HP-bar gradient empty-anchor (leftmost stop when bar is depleted). Used only in the HP-bar fill gradient (session #71).
- **`#7A1322`** — brand `crimson-deep`. Used for text, borders, UI chrome — everything except the HP-bar anchor.

### Void and color-blind tokens

| Token | Hex | Purpose |
|---|---|---|
| `void` | `#050A07` | Deepest background (boot screen, black borders) |
| `cb.player` | `#FF8C42` | Player ship in color-blind mode |
| `cb.hazard` | `#FFD23F` | Enemy bullets + hazards in color-blind mode |
| `cb.safe` | `#4FC3F7` | Safe zones + pickups in color-blind mode |

Color-blind tokens land at session #74.

---

## §2 — Typography

Updated 2026-04-29 (session #68): all three font families loaded via `@expo-google-fonts/*` + `useFonts` in `App.tsx`; type scale rewritten with 11 first-class keys + 6 deprecated aliases. `mono.hud` corrected to 13 px (was listed as 18 px in earlier draft). Migrated to [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) (`TYPOGRAPHY`) at session #114; deprecated aliases deleted.

### Font families

| Family | Role | Size range | Status |
|---|---|---|---|
| EB Garamond (serif) | Titles, zone banners, boss names | 56–132 px | loaded — session #68 |
| Source Sans 3 (sans-serif) | Dialogue, codex, UI labels | 14–22 px | loaded — session #68 |
| JetBrains Mono (monospace) | HUD numerics, debug overlay | 11–13 px | loaded — session #68 |

All three families are loaded via `@expo-google-fonts/*` packages and wired via `useFonts` in `App.tsx`.

### Type-scale

| Role | Deck name | Deck size | Code today | Code file:line | Status |
|---|---|---|---|---|---|
| Display XL | `display-xl` | 132 px | `TYPOGRAPHY.displayXl fontSize:132` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |
| Display L | `display-l` | 72 px | `TYPOGRAPHY.displayL fontSize:72` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |
| Display M | `display-m` | 56 px | `TYPOGRAPHY.displayM fontSize:56` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |
| Heading 1 | `h1` | 28 px | deprecated alias `h1` — deleted at session #114 | — | deleted — #114 |
| Heading 2 | `h2` | 26 px | deprecated alias `h2` — deleted at session #114 | — | deleted — #114 |
| Heading 3 | `h3` | 20 px | deprecated alias `h3` — deleted at session #114 | — | deleted — #114 |
| Body | `body` | 14 px | deprecated alias `body` — deleted at session #114 | — | deleted — #114 |
| Label | `label` | 14 px | `TYPOGRAPHY.label fontSize:14` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |
| Caption | `caption` | 12 px | deprecated alias `caption` — deleted at session #114 | — | deleted — #114 |
| Mono HUD | `mono-hud` | 13 px | `TYPOGRAPHY.monoHud fontSize:13` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |
| Mono debug | `mono-debug` | 11 px | `TYPOGRAPHY.monoDebug fontSize:11` | [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) | done — session #68 |

### PL diacritics

The following characters must render correctly at all sizes and font weights:
**ą ć ę ł ń ó ś ź ż**. Font files must include full Polish Latin Extended coverage.

---

## §3 — Shape vocabulary

Folio references: [folio-06-skia-language.png](../../../docs/references/pan-tvardowski/folios/folio-06-skia-language.png), [folio-13a-ship-anatomy.png](../../../docs/references/pan-tvardowski/folios/folio-13a-ship-anatomy.png).

### §3.0 — Ship-anatomy 3-element rule (folio XIIIa) — most consequential constraint

**Every ship in the codex** — player, enemy, mini-boss, boss (29 total) — is constructed from exactly three primitive parts:

- 1× **hull** — variable shape carrying species identity (triangle, ellipse, step, drop, pie, moon, star, xor, or, pointed_oval, delay, dataStorage, offPageConnector, merge_or_storage)
- N× **weapon rectangles** mounted on hull silhouette: enemy 1–2, mini-boss 2–3, boss 2–4, player 2 (count by tier)
- 1× **engine square** (20×20 px) at hull rear; drives the crimson-flame trail particle

Hue families: enemies span the rainbow per species (folio XIIIb), mini-bosses crimson family (folio XIIIb+), bosses violet family (folio XIIIf), player ships brand-tagged (Kogut = gold, Twardoń = green, Bazyl = blue per folio XIIIc).

Live `src/visual-spec/shapes-catalogue.ts` fully implements this rule across all 29 ships. Migration completed across sessions #76–#78. Pickups (`weaponPickups`, `upgradePickups`) intentionally remain `ShapeSpec[]` — they are items, not ships, and are not subject to this rule.

### 6 Skia primitives (folio VI)

| Primitive | Deck use | Size/spec | Stroke |
|---|---|---|---|
| Hex (`ngon n:6`) | Enemy frame | 64×64 | — |
| Diamond (`ngon n:4`) | Pickup | 64×64 | — |
| Circle ring (`ring`) | Upgrade aura | dual concentric strokes | 2 px |
| Pentagram (`star points:5 + star points:8`) | Player sigil | 5-point + 8-star cardinal | — |
| Cross (`polyline`) | Weapon salt | — | 2 px |
| Bolt (`polyline`) | Projectile piorun | — | 1.5 px |

Stroke-width constants: [`src/visual-spec/shapes.ts:1`](../src/visual-spec/shapes.ts#L1)
`thin=1 / medium=1.5 / thick=2 / veryThick=3`

Collision radii: [`src/visual-spec/shapes.ts:3`](../src/visual-spec/shapes.ts#L3)

### Game-entity shapes table (44 entities)

All shapes defined in [`src/visual-spec/shapes-catalogue.ts`](../src/visual-spec/shapes-catalogue.ts).

#### Enemies (14) — ShipSpec: hull + 1–2 rect weapons + square engine (sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `skrzat` | triangle size=14 | 1 rect | ORANGE | [48](../src/visual-spec/shapes-catalogue.ts#L48) |
| `latawiec` | triangle size=20 | 2 rects | RED | [54](../src/visual-spec/shapes-catalogue.ts#L54) |
| `czart` | ngon n=5 r=14 | 2 rects | BLACK | [63](../src/visual-spec/shapes-catalogue.ts#L63) |
| `bies` | ngon n=6 r=14 | 2 rects | DARK_RED | [72](../src/visual-spec/shapes-catalogue.ts#L72) |
| `licho` | star points=5 rOuter=16 rInner=7 | 1 rect | PURPLE | [81](../src/visual-spec/shapes-catalogue.ts#L81) |
| `strzyga` | triangle size=16 | 2 rects | PALE | [87](../src/visual-spec/shapes-catalogue.ts#L87) |
| `topielec` | circle r=14 | 2 rects | BLUE_GREEN | [96](../src/visual-spec/shapes-catalogue.ts#L96) |
| `mamuna` | ngon n=8 r=14 | 2 rects | GREEN | [105](../src/visual-spec/shapes-catalogue.ts#L105) |
| `nocnica` | circle r=10 | 1 rect | BLACK | [114](../src/visual-spec/shapes-catalogue.ts#L114) |
| `poludnica` | triangle size=18 | 2 rects | YELLOW_WHITE | [120](../src/visual-spec/shapes-catalogue.ts#L120) |
| `wapierz` | ngon n=8 r=18 stroked | 2 rects | DARK_RED | [129](../src/visual-spec/shapes-catalogue.ts#L129) |
| `hound` | circle r=11 | 2 rects | BLACK | [138](../src/visual-spec/shapes-catalogue.ts#L138) |
| `dziwozona` | ngon n=5 r=16 | 2 rects | TEAL | [147](../src/visual-spec/shapes-catalogue.ts#L147) |
| `moon-wraith` | triangle size=14 | 1 rect | `0xff2b2d5a` | [156](../src/visual-spec/shapes-catalogue.ts#L156) |

#### Mini-bosses (4) — ShipSpec: hull + 2–3 rect weapons + square engine (crimson family, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `rokita` | ngon n=6 r=30 | 2 rects | CRIMSON | [168](../src/visual-spec/shapes-catalogue.ts#L168) |
| `leszy` | ngon n=4 r=32 stroked | 3 rects | CRIMSON_DARK | [177](../src/visual-spec/shapes-catalogue.ts#L177) |
| `nocny-lowca` | ngon n=5 r=30 | 3 rects | CRIMSON_RUST | [187](../src/visual-spec/shapes-catalogue.ts#L187) |
| `madej` | triangle size=34 stroked | 2 rects | CRIMSON_RUST | [197](../src/visual-spec/shapes-catalogue.ts#L197) |

#### Bosses (8) — ShipSpec: hull + 2–4 rect weapons + square engine (violet family, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `smok-krzemionkowski` | ngon n=6 r=48 | 2 rects | VIOLET_DARK | [215](../src/visual-spec/shapes-catalogue.ts#L215) |
| `borowy-krol` | ngon n=5 r=52 | 3 rects | VIOLET_DEEP | [224](../src/visual-spec/shapes-catalogue.ts#L224) |
| `wodnik-wislanny` | circle r=44 stroked | 2 rects | VIOLET_MID | [234](../src/visual-spec/shapes-catalogue.ts#L234) |
| `boruta` | ngon n=8 r=50 stroked | 4 rects | `0xff4a1270` | [243](../src/visual-spec/shapes-catalogue.ts#L243) |
| `baba-jaga` | ngon n=3 r=48 | 2 rects | `0xff6a28a8` | [255](../src/visual-spec/shapes-catalogue.ts#L255) |
| `bazyliszek-warszawski` | ngon n=6 r=52 | 4 rects | `0xff9d3dff` | [265](../src/visual-spec/shapes-catalogue.ts#L265) |
| `mefistofeles` | star points=6 rOuter=50 rInner=20 | 3 rects | `0xff2a0840` | [277](../src/visual-spec/shapes-catalogue.ts#L277) |
| `lucyper-ksiezycowy` | star points=8 rOuter=54 rInner=22 | 4 rects | `0xff7020b8` | [288](../src/visual-spec/shapes-catalogue.ts#L288) |

#### Ships / players (3) — ShipSpec: hull + 2 rect weapons + square engine (brand-tagged, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `kogut-zloty` | triangle size=28 | 2 rects | GOLD | [306](../src/visual-spec/shapes-catalogue.ts#L306) |
| `alembik` | ngon n=6 r=22 stroked | 2 rects | BOG_GREEN | [316](../src/visual-spec/shapes-catalogue.ts#L316) |
| `zwierciadlo` | ngon n=4 r=24 stroked | 2 rects | DEEP_BLUE | [326](../src/visual-spec/shapes-catalogue.ts#L326) |

#### Weapon pickups (4) — lines 341–360

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `iskry` | 3 circles | ORANGE | [342](../src/visual-spec/shapes-catalogue.ts#L342) |
| `piorun` | polyline bolt | EYE_YELLOW | [347](../src/visual-spec/shapes-catalogue.ts#L347) |
| `sol-swiecona` | ring | MIRROR | [356](../src/visual-spec/shapes-catalogue.ts#L356) |
| `znak-pentagramu` | star-5 | PURPLE | [357](../src/visual-spec/shapes-catalogue.ts#L357) |

#### Upgrade pickups (6) — lines 391–434

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `czarna-ksiega` | rect stroked | BLACK + GOLD | [392](../src/visual-spec/shapes-catalogue.ts#L392) |
| `siedmiomilowe-buty` | 2 rects | BROWN | [395](../src/visual-spec/shapes-catalogue.ts#L395) |
| `amulet-wegrowski` | ring + circle | GOLD + HELLFIRE | [399](../src/visual-spec/shapes-catalogue.ts#L399) |
| `koguci-pioro` | polyline | GOLD | [403](../src/visual-spec/shapes-catalogue.ts#L403) |
| `srebrna-tarcza` | ngon-6 stroked | MIRROR + BLACK | [412](../src/visual-spec/shapes-catalogue.ts#L412) |
| `kamien-filozoficzny` | ngon-8 stroked | PURPLE + GOLD | [423](../src/visual-spec/shapes-catalogue.ts#L423) |

### Color constant summary

Inline constants at [`src/visual-spec/shapes-catalogue.ts:15–43`](../src/visual-spec/shapes-catalogue.ts#L15):
`BLACK=0xff111111 / ORANGE=0xffff9944 / RED=0xffe84b2a / DARK_RED=0xff7a1a1a /
PURPLE=0xff8844ff / BLUE_GREEN=0xff3aa08c / GREEN=0xff5cae6e / PALE=0xffe6dcc8 /
YELLOW_WHITE=0xfff7f3a6 / TEAL=0xff3ac4b4 / BROWN=0xff6b4423 / GOLD=0xffc9a24a /
MIRROR=0xffc8cdd4 / HELLFIRE=0xffff2b2b / EYE_YELLOW=0xffffdd55`

Migrated to canonical deck hexes at session #67 (`GOLD 0xfff3c262→0xffc9a24a`, `RED 0xffc0392b→0xffe84b2a`); `COPPER` constant removed at session #77. Additional crimson-family constants (`CRIMSON`, `CRIMSON_DARK`, `CRIMSON_RUST`, lines 29–31) and violet-family constants (`VIOLET_DARK`, `VIOLET_DEEP`, `VIOLET_MID`, lines 34–36) added for mini-boss and boss hue families.

---

## §4 — Icon system

Deck Chapters 02–03 catalogue 30 icon stamps intended for MaterialCommunityIcons. These are **aspirational only** and will not be implemented. Pan Tvardowski uses Skia shapes exclusively (§3). No `react-native-vector-icons` dependency will be added. This is an intentional architectural decision that keeps the binary size minimal and the rendering path uniform.

---

## §5 — Glow & post-FX recipes

### Friendly rim-light (safe entities, zone banners)

Radial gradient centered on the entity: inner `safe #6FA66B` at 0%, transparent at 50%.
Soft bloom pass (threshold 0.72, intensity 0.5).

### Hazard chromatic edge (enemy bullets, boss phases)

Multi-stroke technique: 0.5 px inner stroke in `hazard #E84B2A` + chromatic-ab effect enabled.
Flicker: two strokes alternate at ~8 Hz.

### Player-hit grayscale-flash

Duration: 80 ms deck spec. Envelope: white frame 20% opacity → transparent 100%.
Implemented via `createGrayscaleFlash('grayscale-flash', { intensity: 0 })` with auto-decay (4.2/s ≈ 238 ms).
Current wiring at [`src/fx/postfx.ts:35`](../src/fx/postfx.ts#L35). Flash triggered on `player-hit` (existing), bomb detonation, and boss defeat — done at session #69.

Per-trigger decay override wired at session #94: `triggerHitFlash(decayRate?)` accepts an explicit decay rate — 12.5/s (80 ms) player-hit, 5/s (200 ms) bomb, 0.833/s (1200 ms) boss-defeat. All three call sites in `play.ts` pass the correct rate.

PostFx controller: [`src/fx/postfx.ts`](../src/fx/postfx.ts). `skiaPostFx` wired as `Skia` in
[`src/scene-registry.ts:68`](../src/scene-registry.ts#L68) (session #69). Closed (session #176 PT-PostFx-Visible): visible pixel compositing shipped; `play.ts` postfx hook flipped from `source: null` to real scene texture; vignette, bloom, CRT, chromatic-ab, and grayscale-flash all produce visible framebuffer pixels.

### Always-on chain

| Effect | Params | Purpose | Status |
|---|---|---|---|
| `vignette` | intensity 0.35, radius 0.82 | Darkness canvas framing | done — session #69 |
| `bloom` | threshold 0.72, intensity 0.5 | Luminosity lift on bright shapes | done — session #69 |

Both in [`src/fx/postfx.ts:33–34`](../src/fx/postfx.ts#L33).

### Situational effects

| Effect | Trigger | Status |
|---|---|---|
| Chromatic-aberration | Boss phase-break, elite death | done — session #70 |
| CRT scanlines | Z8 Księżyc only (Lucyper) | done — session #70 |
| Grayscale-flash | Player hit, bomb detonation, boss defeat | done — session #69 |

### Sequenced postfx cascade — done at session #188

Per-tier `flash → grayscale-hold → bloom-pulse` cascade wired in [`src/fx/explosions.ts:163–178`](../src/fx/explosions.ts#L163). New methods on `PanPostFxController` at [`src/fx/postfx.ts:18–19`](../src/fx/postfx.ts#L18): `triggerGrayscaleHold(durationMs)` at [`src/fx/postfx.ts:73`](../src/fx/postfx.ts#L73), `triggerBloomPulse(durationMs)` at [`src/fx/postfx.ts:76`](../src/fx/postfx.ts#L76).

| Tier | flash | grayscale-hold | bloom-pulse |
|---|---|---|---|
| I (chip) | — | — | — |
| II (pop) | yes | — | — |
| III (burst) | yes | 400 ms | — |
| IV (detonation) | yes | 600 ms | 300 ms |
| V (cataclysm) | yes (0.833/s) | 900 ms | 500 ms |

### Glow recipes

| Kind | Color | Alpha | Technique | Status |
|---|---|---|---|---|
| Friendly rim | `safe #6FA66B` | 0.25 (0x40) | oversized stroked ring at `r+4`, width 3 | done — session #69 |
| Hazard edge | `hazardOrange #E84B2A` | 0.6 (0x99) | inner 0.5 px stroke on `enemy-bullet-b` atlas frame; 8 Hz alternation with `enemy-bullet-a` in play-scene | done — session #69 (glow helper) + #151 (bullet flicker) |

Glow helpers: [`@flare-engine/shapes`](../../../packages/shapes/src/draw.ts) — `friendlyGlowArgb()`, `hazardGlowArgb()`, `applyFriendlyGlow()`, `applyHazardGlow()`. Migrated from deleted `src/shapes-draw.ts` at session #92.
Glow field: [`@flare-engine/shapes`](../../../packages/shapes/src/types.ts) — `BaseSpec.glow?: 'friendly' | 'hazard'`. Migrated from deleted `src/shapes.ts` at session #92.
11 entities tagged friendly: `kogut-zloty` (player), `iskry`/`piorun`/`sol-swiecona`/`znak-pentagramu` (weapon pickups), `czarna-ksiega`/`siedmiomilowe-buty`/`amulet-wegrowski`/`koguci-pioro`/`srebrna-tarcza`/`kamien-filozoficzny` (upgrade pickups).
Flicker animation (enemy bullets): done — session #151. Two atlas frames (`enemy-bullet-a` / `enemy-bullet-b`), 8 Hz phase swap in play-scene `onUpdate`, static frame-a under `reducedMotion`.

### Degradation rule

Drop chromatic-aberration if avg fps < 55 over 3 consecutive seconds. See §12.

---

## §6 — Explosion tiers

Updated 2026-04-29 (session #70): 5-tier preset system live in [`src/fx/explosions.ts`](../src/fx/explosions.ts). `burstExplosion` in [`src/particles.ts`](../src/particles.ts) is now a thin Tier-II wrapper.

### 5-tier table

| Tier | Name | Particles | Life | Shake | PostFX | +Draws | Use | Status |
|---|---|---|---|---|---|---|---|---|
| I | Chip | 8 spark | 120 ms | — | — | +0 | bullet hit | live — #70 |
| II | Pop | 24 spark+smoke | 280 ms | 2 px·80 ms sinusoidal | flash | +12 | grunt death | live — #70 |
| III | Burst | 64 spark+smoke | 520 ms | 5 px·180 ms sinusoidal | flash | +38 | elite/mini-boss | live — #70 |
| IV | Detonation | 128 spark+smoke | 900 ms | 10 px·320 ms Perlin | flash | +86 | boss phase-break | live — #171 |
| V | Cataclysm | 256 spark+debris | 1600 ms | 14 px·900 ms Perlin | flash | +220 | boss final, once/zone | live — #171 |

Public API: [`src/fx/explosions.ts`](../src/fx/explosions.ts) — `triggerExplosion`, `resetCataclysmGate`, `EXPLOSION_PRESETS`.
Preset type: `ExplosionTier = 'chip' | 'pop' | 'burst' | 'detonation' | 'cataclysm'`.

### Engine gaps deferred from #70

- **`clock.timescale` slow-mo** — closed at #173; Tier-V cataclysm ramps `clock.timescale` 1.0→0.3 over 800 ms (easeInCubic) then 0.3→1.0 over 400 ms (easeOutCubic); ticks on `rawDt`; skipped under reducedMotion.
- **Sequenced postfx chain** — closed at session #188; per-tier `flash→grayscale-hold→bloom-pulse` cascade wired in [`src/fx/explosions.ts:163–178`](../src/fx/explosions.ts#L163).

### Concurrent caps — done at session #70

| Tier | Cap |
|---|---|
| I–II | unlimited |
| III | ≤ 4 active |
| IV | ≤ 1 active |
| V | 1 per zone (overflow degrades to next-lower tier) |

### Camera shake taxonomy

| Name | Amplitude | Duration | Motion | Trigger | Status |
|---|---|---|---|---|---|
| Tap | 2 px | 80 ms | perpendicular | bullet hit | live — #70 |
| Jolt | 5 px | 180 ms | radial | grunt death | live — #70 |
| Slam | 10 px | 320 ms | radial + rotation | mini-boss death | live — #70 |
| Quake | 14 px | 900 ms | Perlin noise | boss phase-break / Cataclysm | live — #171 |

---

## §7 — HUD anatomy

Folio reference: [folio-09-hud-play-frame.png](../../../docs/references/pan-tvardowski/folios/folio-09-hud-play-frame.png) (historical).

HUD component: [`src/hud/Hud.tsx`](../src/hud/Hud.tsx).
Styles: [`src/hud/Hud.styles.ts`](../src/hud/Hud.styles.ts).
Spacing tokens: [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) (`THEME_SPEC.spacing`).

### Folio IX target layout (mobile portrait 9:16) — done at sessions #71, #79

| Slot | Position | Token | Type | Notes |
|---|---|---|---|---|
| Score | top-left | `mono.hud` parchment | 3-digit groups, e.g. `012 480` | done — #71 |
| Combo | below score | `mono.hud` crimson | `×N` pulses on hit, scale from `comboPulseScale` | done — #71; scale-driven — #85 |
| Zone banner | top-center | `display.m` italic + gold rule | Roman numeral + zone name (e.g. `— I — Dachy Krakowa`) | done — #71 |
| Bombs | top-right | `stamp.bomb` crimson | filled / outline pip dots | done — #71 |
| HP bar | bottom (above boss bar) | `HUDBar` crimson gradient | `#2a0810 → #D4213D` left-to-right | done — #71 |
| Weapon meter | bottom-right (above boss bar) | 5-segment crimson | weapon-level + cooldown indicator | done — #71 |
| Boss bar | top (positioned via safe-area inset) | `display.m` + bar | gold border `#C9A24A`; `opacity: bossBarOpacity` (easeOutExpo 600 ms) | done — #71; opacity-tween — #85 |

### Live code state

HUD aligns with folio IX visually. HP gradient anchor `#2a0810` is intentional and distinct from brand `crimson-deep #7A1322` — see §13.

**Closed (session #164):** slot positions in [`src/hud/Hud.tsx:102-107`](../src/hud/Hud.tsx#L102) are now read from `HUD_SPEC.slots` via the module-level `SLOT` map (line 16); hardcoded literals removed. `Inset.dx`/`dy` widened to `number | \`${number}%\`` in [`src/visual-spec/types.ts`](../src/visual-spec/types.ts); `zone-banner` slot gained `inset: { dx: 0, dy: '38%' }` in [`src/visual-spec/hud.ts`](../src/visual-spec/hud.ts).

### HP-bar gradient spec

HP bar fill horizontal gradient: `#2a0810` (depleted/left) → `#D4213D` (full/right). Done at session #71.
`#2a0810` is the gradient anchor only — see §1 disambiguation note.

### Weapon meter spec

5-segment strip, crimson fill `#D4213D`. Done at session #71.

### Boss bar spec

Gold border `#C9A24A` around the boss bar background. Fill color `hazard #E84B2A`. Done at session #71.
Fade-in opacity (`bossBarOpacity`) driven by `easeOutExpo` 600 ms tween in `src/scenes/play.ts`. Done at session #85.

---

## §8 — Scene catalogue

Scene registry: [`src/scene-registry.ts`](../src/scene-registry.ts).

| Scene | Type | Registry key | Status | Line |
|---|---|---|---|---|
| Boot | frontmatter | `boot` | done | [78](../src/scene-registry.ts#L78) |
| Menu | frontmatter | `menu` | done | [96](../src/scene-registry.ts#L96) |
| Save-select | frontmatter | `save-select` | done | [97](../src/scene-registry.ts#L97) |
| Settings | frontmatter | `settings` | done | [98](../src/scene-registry.ts#L98) |
| Credits | frontmatter | `credits` | done | [99](../src/scene-registry.ts#L99) |
| Play | gameplay | `play` | done | [105](../src/scene-registry.ts#L105) |
| Inventory | overlay | `inventory` | done | [100](../src/scene-registry.ts#L100) |
| Codex-shards | overlay | `codex-shards` | done | [101](../src/scene-registry.ts#L101) |
| Achievements | overlay | `achievements` | done | [102](../src/scene-registry.ts#L102) |
| Shop | overlay | `shop` | done | [103](../src/scene-registry.ts#L103) |
| Game-over | end | `game-over` | done | [120](../src/scene-registry.ts#L120) |
| Victory | end | `victory` | done | [121](../src/scene-registry.ts#L121) |
| Capture | util | `capture` | done — #78 | not registered in scene-registry (runs as a standalone harness) |

Chrome layers not in SCENE_KEYS: `privacy`, `pause`, `dialogue` (rendered as overlay components).

---

## §9 — Zone specs

Zone configs: [`src/config/zones.ts:68`](../src/config/zones.ts#L68).
ARGB palette integers: [`src/visual-spec/zones-palette.ts:52`](../src/visual-spec/zones-palette.ts#L52).

| Zone | Name (PL) | Deck sky token | Deck ground token | Deck accent token | Deck hazard token | Current ARGB (primary) | Ambience | Boss | Miniboss |
|---|---|---|---|---|---|---|---|---|---|
| Z1 | Dachy Krakowa | terracotta `#B05A3C` | rust `#8B3A1F` | ink `#0E1A12` | gold `#C9A24A` | `0xffb5651d` | ember 32p | Smok Krzemionkowski | — |
| Z2 | Puszcza Mazowiecka | moss `#243A29` | bog `#1A2E1F` | verdigris `#4A7A6A` | bone `#C7B89A` | `0xff1f4d2e` | pollen 80p | Borowy Król | rokita |
| Z3 | Wisła | verdigris `#4A7A6A` | grey-green `#2A4A4A` | gold-deep `#8E6F2C` | bone `#C7B89A` | `0xff2f5f7a` | spray 48p | Wodnik Wiślany | — |
| Z4 | Łęczyckie Błota | moss `#243A29` | olive `#5A6A2A` | gold-deep `#8E6F2C` | hazard `#E84B2A` | `0xff5a4a2b` | ember 96p | Boruta | leszy |
| Z5 | Łysa Góra | crimson-deep `#7A1322` | crimson `#D4213D` | ink `#0E0810` | gold `#C9A24A` | `0xff2a1b3d` | ash 128p | Baba Jaga | — |
| Z6 | Katakumby | ink `#1A1410` | bone `#C7B89A` | gold-deep `#8E6F2C` | crimson-deep `#7A1322` | `0xff3e3a37` | dust 24p | Bazyliszek Warszawski | nocny-lowca |
| Z7 | Karczma "Rzym" | rust `#8B3A1F` | gold `#C9A24A` | crimson-deep `#7A1322` | parchment `#E8DCC4` | `0xff6b4423` | smoke 16p | Mefistofeles | madej |
| Z8 | Księżyc | bone `#C7B89A` | parchment `#E8DCC4` | ink `#1A1F2A` | crimson `#D4213D` | `0xffc8cdd4` | float 64p | Lucyper Księżycowy | — |

Zone ARGB palettes aligned with deck tokens at session #72. Z8 silver-UI implemented at #72.

### Shader backgrounds

Two fullscreen-stretched ECS `Sprite` entities per zone (z=-100 layer 1, z=-90 layer 2). Both static in world space; shaders animate autonomously via `beginFrame(w, h, time)`. Pattern established at session #121 (Z3), extended across all 8 zones by sessions #174, #175, #183.

| Zone | Layer 1 (z=-100) | Layer 2 (z=-90) | Atlas frame | Source | Session |
|---|---|---|---|---|---|
| Z1 | `FireEffect` (ember glow) | `FogEffect` (chimney smoke) | `tile-fire` | [`src/bg/zone1-bg.ts`](../src/bg/zone1-bg.ts) | #174 |
| Z2 | `FogEffect` (pine mist) | `FogEffect` (pollen haze) | `tile-water` | [`src/bg/zone2-bg.ts`](../src/bg/zone2-bg.ts) | #183 |
| Z3 | `WaterEffect` (Vistula surface) | `FogEffect` (hovering mist) | `tile-water` | [`src/bg/zone3-bg.ts`](../src/bg/zone3-bg.ts) | #121 |
| Z4 | `WaterEffect` (swamp gas ripple) | `FogEffect` (bog vapour) | `tile-water` | [`src/bg/zone4-bg.ts`](../src/bg/zone4-bg.ts) | #183 |
| Z5 | `FireEffect` (volcanic ember glow) | `FogEffect` (ash fog) | `tile-fire` | [`src/bg/zone5-bg.ts`](../src/bg/zone5-bg.ts) | #175 |
| Z6 | `FireEffect` (torch flicker) | `FogEffect` (dust haze) | `tile-fire` | [`src/bg/zone6-bg.ts`](../src/bg/zone6-bg.ts) | #183 |
| Z7 | `FireEffect` (hearth glow) | `FogEffect` (smoke haze) | `tile-fire` | [`src/bg/zone7-bg.ts`](../src/bg/zone7-bg.ts) | #183 |
| Z8 | `WaterEffect` (lunar surface shimmer) | `FogEffect` (lunar fog) | `tile-water` | [`src/bg/zone8-bg.ts`](../src/bg/zone8-bg.ts) | #175 |

---

## §10 — Boss specs

Boss HP constants: [`src/config/gameplay.ts:133–271`](../src/config/gameplay.ts#L133).
Boss FSMs: `src/systems/boss/{smok,borowy,wodnik,boruta,baba-jaga,bazyliszek,mefistofeles,lucyper}.ts`

| Boss | Zone | HP total | Phases | Phase 1 | Phase 2 | Phase 3 | Particles | PostFX chain |
|---|---|---|---|---|---|---|---|---|
| Smok Krzemionkowski | Z1 | 800 | 2 | terracotta cone-fire sweeps | rust dive-loops | — | ember 128p | bloom+chrom |
| Borowy Król | Z2 | 1000 | 2 | moss rolling boulders | verdigris root-maze | — | pollen 96p | bloom+vignette |
| Wodnik Wiślany | Z3 | 1200 | 2 | verdigris water-spouts | grey-green bubble-shield | — | spray 64p | bloom+chrom |
| Boruta | Z4 | 1400 | 2 | hazard whip-chains | crimson mud-geysers + summons | — | ember 128p | bloom+flash |
| Baba Jaga | Z5 | 1500 | 3 | crimson-smoke cauldrons | crimson+gold mortar flight | white-out broom sweep | ash 256p | bloom+chrom+flash |
| Bazyliszek Warszawski | Z6 | 1800 | 3 | bone gaze-cone | ink venom puddles | crimson gaze-beam maze | dust 32p | bloom+vignette |
| Mefistofeles | Z7 | 2100 | 3 | warm gold contracts | terracotta fire-pits | crimson mirror-twin | smoke 64p | bloom+chrom |
| Lucyper Księżycowy | Z8 | 2400 | 3 | silver cosmic-rain | ink+silver eclipse | crimson shattered-mirrors | float 64p | bloom+flash+CRT |

### Phase gate thresholds

- 2-phase bosses: phase2 triggers at HP/2 (50%).
- 3-phase bosses: phase2 at 2/3 HP (`THREE_PHASE_P2_RATIO`), phase3 at 1/3 HP (`PHASE3_HP_RATIO`).
  Constants at [`src/config/gameplay.ts:200–203`](../src/config/gameplay.ts#L200).

### Per-phase palette shift — closed #177

Each phase entry **emits** an `onPaletteShift(phase, accent)` callback in [`src/systems/boss/types.ts:36`](../src/systems/boss/types.ts#L36) (and `onPhasePostFx`); all 8 boss FSMs invoke them at session #73. Closed (session #177 PT-Boss-PaletteShift-Wire): `play.ts` `updateBoss()` now provides `onPaletteShift` + `onPhasePostFx` callbacks; `onPhasePostFx` applies the boss postfx chain per phase; `onPaletteShift` is structurally wired (vignette-tint engine gap deferred to #187).

---

## §11 — Motion & accessibility

### Easing assignments — done at session #85

| Element | Easing | Duration | Status |
|---|---|---|---|
| Menu enter | cubicOut | 320 ms | done — #170; `fadeTransition(0.32, easeOutCubic)` in `scene-registry.ts` |
| Overlay open | expoOut | 240 ms | done — #170; `Animated.timing` + `Easing.out(Easing.exp)` 240 ms in `Hud.tsx` |
| Overlay close | expoIn | 180 ms | done — #170; `Animated.timing` + `Easing.in(Easing.exp)` 180 ms in `Hud.tsx` |
| Sigil pulse | sineInOut | 2400 ms loop | done — #172; `periodicTween(0.4, 1.0, 2.4)` on player `Sprite.alpha`; reduce-motion static 0.7 |
| Combo pulse | backOut(1.4) | 120 ms | done — #85; scale via `comboPulseScale` in state + play-scene tween |
| Boss intro | expoOut | 600 ms | done — #85; `bossBarOpacity` tween in play-scene |
| Player-hit flash | linear | 80 ms | done — #94; per-trigger decay rates (12.5/5/0.833 /s) wired in `play.ts` |
| Game-over | cubicIn | 1200 ms | done — #85 (`gameOverOpacity` tween in play-scene); scene-level transition wire added at #170 (`fadeTransition(1.2, easeInCubic)` in `onPlayerDown`) |
| Zone banner | quartOut | 800 ms | done — #85; `createZoneBannerState` in `src/hud/zone-banner.ts` |

Engine gaps surfaced at #85:
- `fadeTransition` easing param — closed at #170; `fadeTransition(duration, easingFn)` shipped in engine session #168.
- Overlay open/close easing — closed at #170; `Animated.timing` with `Easing.out/in(Easing.exp)` in `Hud.tsx` (React-Native path; no scene-level API needed).
- No sigil-pulse driver — closed at #172; `periodicTween` shipped in `@flare-engine/animation` (session #169-P2); `periodicTween(0.4, 1.0, 2.4)` wired on player `Sprite.alpha` in `play.ts`.
- Per-trigger flash decay — resolved at session #94; `triggerHitFlash(decayRate?)` accepts per-call rate (12.5/5/0.833 /s for 80/200/1200 ms).

### Reduce-motion policy (5 rules) — done at sessions #74, #84, #85

When `reducedMotion = true` (flag lives in `gameState.settings.reducedMotion` mirrored from `@flare-engine/a11y` bridge at [`src/scene-registry.ts:70`](../src/scene-registry.ts#L70)):

1. **Parallax** → static (no layer offset update) — done at #74; `getParallaxVelocity` in [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts).
2. **Sigil pulse** → dim 70%, no animation — done at #74; `sigilOpacity` in [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts).
3. **Combo pulse** → color shift only (no scale animation) — done at #85; `comboPulseScale` held at 1 when `reducedMotion=true` in play-scene `onEnemyKilled`.
4. **Boss intro** → snap to final value immediately (no tween) — done at #85; `bossBarOpacity = 1` snap in play-scene boss-spawn branch.
5. **Screen shake** → 1-frame red flash instead — done at #71; `applyShake` in [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts).

### Color-blind tokens — done at session #74

| Token | Hex | Replaces |
|---|---|---|
| `cb.player` | `#FF8C42` | ship fill in all palettes |
| `cb.hazard` | `#FFD23F` | enemy bullet + hazard fill |
| `cb.safe` | `#4FC3F7` | pickups + safe-zone markers |

Tokens in [`src/visual-spec/theme.ts`](../src/visual-spec/theme.ts) (`UI_COLORS.cb`) — done at session #74; migrated to `visual-spec/` at session #114.

### Contrast floor

Parchment `#E8DCC4` on ink-black `#0E1A12`: **14.2:1** (WCAG AAA).
All UI text must satisfy this minimum.

---

## §12 — Frame budget

Per-scene worst-case caps. Degradation triggers implemented at session #75.

| Scene | Draws | Sprites | Particles | PostFX |
|---|---|---|---|---|
| boot | ~40 | ~12 | 0 | CRT+vignette |
| menu | ~180 | ~60 | 32 | bloom+vignette |
| save-select | ~90 | ~40 | 0 | vignette |
| settings | ~70 | ~30 | 0 | vignette |
| credits | ~60 | ~24 | 0 | vignette |
| play·Z1 | ~580 | ~200 | 160 | bloom+vignette |
| play·Z5 peak | ~740 | ~240 | 320 | bloom+vignette+chrom |
| play·boss·Baba | ~920 | ~280 | 480 | bloom+chrom+flash |
| inventory | ~110 | ~50 | 0 | vignette |
| codex-shards | ~140 | ~60 | 0 | vignette |
| achievements | ~120 | ~48 | 0 | vignette |
| shop | ~130 | ~55 | 16 smoke | bloom+vignette |
| victory | ~200 | ~80 | 128 gold-rays | bloom+vignette |
| game-over | ~60 | ~18 | 0 | flash+grayscale |

Worst-case: Boss Z5 — 920 draws / 480 particles / 3 postfx. Headroom ≥8% on iPhone 12.

### Degradation policy

Drop chromatic-aberration if average fps < 55 sustained over 3 seconds.
FPS watchdog: done at session #75. Perf baseline instrumentation:
[`src/perf/cold-start.ts:22`](../src/perf/cold-start.ts#L22) (`markBootStart`).

---

## §13 — Intentional deviations

### HP-bar gradient anchor

Folio IX uses `#2a0810` as the HP-bar gradient empty-anchor, while the brand token `crimson-deep` is `#7A1322`. These are not the same value and serve different roles:

- `#2a0810` — HP-bar gradient empty-anchor (darkest stop when bar is depleted).
- `#7A1322` — brand `crimson-deep` for text, borders, UI chrome.

Both values are correct and intentional. Do not unify them.

---

## §14 — Open questions

| Question | Deferred to | Notes |
|---|---|---|
| Z8 silver-UI override: does "inverts to silver-on-black" mean the gold UI token is swapped at scene-context level, or is there a parallel palette object? | #72 | Affects ZONE_PALETTES shape — need to confirm before implementation |
| Per-phase palette wiring: `PhaseScript` carries no color fields; does wiring land in the FSM or as a separate palette-shift system? | #73 | Impacts boss FSM interface in `src/systems/boss/types.ts` |
| Font loading order: does EB Garamond need to load before first frame, or is a FOUT acceptable for the boot sigil? | #68 | Affects `App.tsx` render gate logic |

---

## §15 — History

- Punch-list of folio-vs-code gaps (formerly §15) lived here through 2026-05-09; all 15 rows closed across sessions #67–#151. Removed 2026-05-10 (session #103 doc-refactor) — open visual work tracks in [`docs/plans/sessions.md`](../../../docs/plans/sessions.md) under tier P0/P1.
- M1 folio-vs-code audit (formerly §16, dated 2026-05-07) ran on 21 PNG folios; verdict 14 ✓ + 2 ⚠ + 0 ✗ + 4 n/a (device-smoke-gate). Removed 2026-05-10 — running state is captured in per-row "done — #N" annotations throughout §1–§14. Re-audit if rebrand changes folios.
- Doc change log (formerly §17, single VS-S8 arc entry) covered by SESSION_LOG.md per-session blocks.
- Divergences M2 punch-list table removed 2026-05-10 — every row was `done` and one row falsely claimed "boss per-phase palette wired in all boss FSMs" (callbacks emit but no consumer; closed by #163).
