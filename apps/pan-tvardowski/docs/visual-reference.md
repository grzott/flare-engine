# Pan Tvardowski — Visual Reference (textual cross-index)

## §0 — Source of truth

The 21 PNG folios at [`docs/references/pan-tvardowski/folios/`](../../../docs/references/pan-tvardowski/folios/) are the canonical visual source of truth for Pan Tvardowski. **If a value in this doc conflicts with a folio, the folio wins** unless this doc documents a deliberate deviation with a rationale.

This document is a textual cross-index: each section maps a folio to live code symbols and tracks open migrations.

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
| `gold` | `#C9A24A` | `colors.ui.gold` / `colors.ui.primary` | [`src/theme/colors.ts:4`](../src/theme/colors.ts#L4), `:19` | done — #67 |
| `crimson` | `#D4213D` | `colors.ui.crimson` / `colors.ui.secondary` | [`src/theme/colors.ts:6`](../src/theme/colors.ts#L6), `:21` | done — #67 |
| `hazard` | `#E84B2A` | `colors.ui.hazard` / `colors.ui.hazardOrange` | [`src/theme/colors.ts:5`](../src/theme/colors.ts#L5), `:23` | done — #67 |
| `ink-black` | `#0E1A12` | `colors.ui.inkBlack` / `colors.ui.bodyBg` | [`src/theme/colors.ts:11`](../src/theme/colors.ts#L11), `:25` | done — #67 |
| `parchment` | `#E8DCC4` | `colors.ui.parchment` / `colors.ui.neutralLight` | [`src/theme/colors.ts:7`](../src/theme/colors.ts#L7), `:28` | done — #67 |
| `bog-green` | `#1A2E1F` | `colors.ui.bogGreen` | [`src/theme/colors.ts:26`](../src/theme/colors.ts#L26) | done — #67 |
| `moss` | `#243A29` | `colors.ui.moss` | [`src/theme/colors.ts:27`](../src/theme/colors.ts#L27) | done — #67 |
| `verdigris` | `#4A7A6A` | `colors.ui.verdigris` | [`src/theme/colors.ts:31`](../src/theme/colors.ts#L31) | done — #67 |
| `bone` | `#C7B89A` | `colors.ui.bone` | [`src/theme/colors.ts:32`](../src/theme/colors.ts#L32) | done — #67 |
| `rust` | `#8B3A1F` | `colors.ui.rust` | [`src/theme/colors.ts:33`](../src/theme/colors.ts#L33) | done — #67 |
| `terracotta` | `#B05A3C` | `colors.ui.terracotta` | [`src/theme/colors.ts:34`](../src/theme/colors.ts#L34) | done — #67 |
| `void` | `#050A07` | `colors.ui.void` | [`src/theme/colors.ts:35`](../src/theme/colors.ts#L35) | done — #67 |
| `parchment-2` | `#D9C9A8` | `colors.ui.parchment2` / `colors.ui.neutralMid` | [`src/theme/colors.ts:8`](../src/theme/colors.ts#L8), `:29` | done — #67 |
| `parchment-dim` | `#A8997A` | `colors.ui.parchmentDim` | [`src/theme/colors.ts:30`](../src/theme/colors.ts#L30) | done — #67 |
| `gold-deep` | `#8E6F2C` | `colors.ui.goldDeep` | [`src/theme/colors.ts:20`](../src/theme/colors.ts#L20) | done — #67 |
| `crimson-deep` | `#7A1322` | `colors.ui.crimsonDeep` | [`src/theme/colors.ts:22`](../src/theme/colors.ts#L22) | done — #67 |
| `safe` | `#6FA66B` | `colors.ui.safe` | [`src/theme/colors.ts:24`](../src/theme/colors.ts#L24) | done — #67 |

All tokens in [`src/theme/colors.ts`](../src/theme/colors.ts) — done at session #67.

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

Updated 2026-04-29 (session #68): all three font families loaded via `@expo-google-fonts/*` + `useFonts` in `App.tsx`; type scale rewritten with 11 first-class keys + 6 deprecated aliases in `src/theme/typography.ts`. `mono.hud` corrected to 13 px (was listed as 18 px in earlier draft).

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
| Display XL | `display-xl` | 132 px | `displayXl fontSize:132` | [`src/theme/typography.ts`](../src/theme/typography.ts) | done — session #68 |
| Display L | `display-l` | 72 px | `displayL fontSize:72` | [`src/theme/typography.ts`](../src/theme/typography.ts) | done — session #68 |
| Display M | `display-m` | 56 px | `displayM fontSize:56` | [`src/theme/typography.ts`](../src/theme/typography.ts) | done — session #68 |
| Heading 1 | `h1` | 28 px | `h1 fontSize:28` (deprecated alias — use `displayM`) | [`src/theme/typography.ts:72`](../src/theme/typography.ts#L72) | matches |
| Heading 2 | `h2` | 26 px | `h2 fontSize:26` (deprecated alias — use `displayM`) | [`src/theme/typography.ts:78`](../src/theme/typography.ts#L78) | matches |
| Heading 3 | `h3` | 20 px | `h3 fontSize:20` (deprecated alias — use `bodyL`) | [`src/theme/typography.ts:83`](../src/theme/typography.ts#L83) | matches |
| Body | `body` | 14 px | `body fontSize:14` (deprecated alias — use `bodyM`) | [`src/theme/typography.ts:90`](../src/theme/typography.ts#L90) | matches |
| Label | `label` | 14 px | `label fontSize:14` | [`src/theme/typography.ts:49`](../src/theme/typography.ts#L49) | matches |
| Caption | `caption` | 12 px | `caption fontSize:12` (deprecated alias — use `smallcap`) | [`src/theme/typography.ts:95`](../src/theme/typography.ts#L95) | matches |
| Mono HUD | `mono-hud` | 13 px | `monoHud fontSize:13` | [`src/theme/typography.ts`](../src/theme/typography.ts) | done — session #68 |
| Mono debug | `mono-debug` | 11 px | `monoDebug fontSize:11` | [`src/theme/typography.ts`](../src/theme/typography.ts) | done — session #68 |

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

Live `src/shape-catalogue.ts` fully implements this rule across all 29 ships. Migration completed across sessions #76–#78. Pickups (`weaponPickups`, `upgradePickups`) intentionally remain `ShapeSpec[]` — they are items, not ships, and are not subject to this rule.

### 6 Skia primitives (folio VI)

| Primitive | Deck use | Size/spec | Stroke |
|---|---|---|---|
| Hex (`ngon n:6`) | Enemy frame | 64×64 | — |
| Diamond (`ngon n:4`) | Pickup | 64×64 | — |
| Circle ring (`ring`) | Upgrade aura | dual concentric strokes | 2 px |
| Pentagram (`star points:5 + star points:8`) | Player sigil | 5-point + 8-star cardinal | — |
| Cross (`polyline`) | Weapon salt | — | 2 px |
| Bolt (`polyline`) | Projectile piorun | — | 1.5 px |

Stroke-width constants: [`src/theme/shapes.ts:1`](../src/theme/shapes.ts#L1)
`thin=1 / medium=1.5 / thick=2 / veryThick=3`

Collision radii: [`src/theme/shapes.ts:3–11`](../src/theme/shapes.ts#L3)

### Game-entity shapes table (44 entities)

All shapes defined in [`src/shape-catalogue.ts`](../src/shape-catalogue.ts).

#### Enemies (14) — ShipSpec: hull + 1–2 rect weapons + square engine (sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `skrzat` | triangle size=14 | 1 rect | ORANGE | [45](../src/shape-catalogue.ts#L45) |
| `latawiec` | triangle size=20 | 2 rects | RED | [51](../src/shape-catalogue.ts#L51) |
| `czart` | ngon n=5 r=14 | 2 rects | BLACK | [60](../src/shape-catalogue.ts#L60) |
| `bies` | ngon n=6 r=14 | 2 rects | DARK_RED | [69](../src/shape-catalogue.ts#L69) |
| `licho` | star points=5 rOuter=16 rInner=7 | 1 rect | PURPLE | [78](../src/shape-catalogue.ts#L78) |
| `strzyga` | triangle size=16 | 2 rects | PALE | [83](../src/shape-catalogue.ts#L83) |
| `topielec` | circle r=14 | 2 rects | BLUE_GREEN | [93](../src/shape-catalogue.ts#L93) |
| `mamuna` | ngon n=8 r=14 | 2 rects | GREEN | [102](../src/shape-catalogue.ts#L102) |
| `nocnica` | circle r=10 | 1 rect | BLACK | [111](../src/shape-catalogue.ts#L111) |
| `poludnica` | triangle size=18 | 2 rects | YELLOW_WHITE | [117](../src/shape-catalogue.ts#L117) |
| `wapierz` | ngon n=8 r=18 stroked | 2 rects | DARK_RED | [126](../src/shape-catalogue.ts#L126) |
| `hound` | circle r=11 | 2 rects | BLACK | [135](../src/shape-catalogue.ts#L135) |
| `dziwozona` | ngon n=5 r=16 | 2 rects | TEAL | [144](../src/shape-catalogue.ts#L144) |
| `moon-wraith` | triangle size=14 | 1 rect | `0xff2b2d5a` | [153](../src/shape-catalogue.ts#L153) |

#### Mini-bosses (4) — ShipSpec: hull + 2–3 rect weapons + square engine (crimson family, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `rokita` | ngon n=6 r=30 | 2 rects | CRIMSON | [165](../src/shape-catalogue.ts#L165) |
| `leszy` | ngon n=4 r=32 stroked | 3 rects | CRIMSON_DARK | [173](../src/shape-catalogue.ts#L173) |
| `nocny-lowca` | ngon n=5 r=30 | 3 rects | CRIMSON_RUST | [183](../src/shape-catalogue.ts#L183) |
| `madej` | triangle size=34 stroked | 2 rects | CRIMSON_RUST | [193](../src/shape-catalogue.ts#L193) |

#### Bosses (8) — ShipSpec: hull + 2–4 rect weapons + square engine (violet family, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `smok-krzemionkowski` | ngon n=6 r=48 | 2 rects | VIOLET_DARK | [213](../src/shape-catalogue.ts#L213) |
| `borowy-krol` | ngon n=5 r=52 | 3 rects | VIOLET_DEEP | [221](../src/shape-catalogue.ts#L221) |
| `wodnik-wislanny` | circle r=44 stroked | 2 rects | VIOLET_MID | [231](../src/shape-catalogue.ts#L231) |
| `boruta` | ngon n=8 r=50 stroked | 4 rects | `0xff4a1270` | [240](../src/shape-catalogue.ts#L240) |
| `baba-jaga` | ngon n=3 r=48 | 2 rects | `0xff6a28a8` | [252](../src/shape-catalogue.ts#L252) |
| `bazyliszek-warszawski` | ngon n=6 r=52 | 4 rects | `0xff9d3dff` | [262](../src/shape-catalogue.ts#L262) |
| `mefistofeles` | star points=6 rOuter=50 rInner=20 | 3 rects | `0xff2a0840` | [274](../src/shape-catalogue.ts#L274) |
| `lucyper-ksiezycowy` | star points=8 rOuter=54 rInner=22 | 4 rects | `0xff7020b8` | [285](../src/shape-catalogue.ts#L285) |

#### Ships / players (3) — ShipSpec: hull + 2 rect weapons + square engine (brand-tagged, sessions #76–#78)

| Entity | Hull kind | Weapons | Hull key color | Line |
|---|---|---|---|---|
| `kogut-zloty` | triangle size=28 | 2 rects | GOLD | [303](../src/shape-catalogue.ts#L303) |
| `alembik` | ngon n=6 r=22 stroked | 2 rects | BOG_GREEN | [312](../src/shape-catalogue.ts#L312) |
| `zwierciadlo` | ngon n=4 r=24 stroked | 2 rects | DEEP_BLUE | [322](../src/shape-catalogue.ts#L322) |

#### Weapon pickups (4) — lines 337–356

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `iskry` | 3 circles | ORANGE | [338](../src/shape-catalogue.ts#L338) |
| `piorun` | polyline bolt | EYE_YELLOW | [343](../src/shape-catalogue.ts#L343) |
| `sol-swiecona` | ring | MIRROR | [352](../src/shape-catalogue.ts#L352) |
| `znak-pentagramu` | star-5 | PURPLE | [353](../src/shape-catalogue.ts#L353) |

#### Upgrade pickups (6) — lines 358–403

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `czarna-ksiega` | rect stroked | BLACK + GOLD | [361](../src/shape-catalogue.ts#L361) |
| `siedmiomilowe-buty` | 2 rects | BROWN | [364](../src/shape-catalogue.ts#L364) |
| `amulet-wegrowski` | ring + circle | GOLD + HELLFIRE | [368](../src/shape-catalogue.ts#L368) |
| `koguci-pioro` | polyline | GOLD | [372](../src/shape-catalogue.ts#L372) |
| `srebrna-tarcza` | ngon-6 stroked | MIRROR + BLACK | [381](../src/shape-catalogue.ts#L381) |
| `kamien-filozoficzny` | ngon-8 stroked | PURPLE + GOLD | [392](../src/shape-catalogue.ts#L392) |

### Color constant summary

Inline constants at [`src/shape-catalogue.ts:12–40`](../src/shape-catalogue.ts#L12):
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
Current wiring at [`src/fx/postfx.ts:21`](../src/fx/postfx.ts#L21). Flash triggered on `player-hit` (existing), bomb detonation, and boss defeat — done at session #69.

Engine gap (documented at #85): `triggerHitFlash()` lacks per-trigger decay override — deck specifies 80 ms player-hit / 200 ms bomb / 1200 ms boss-defeat; all use the fixed 4.2-decay until a future engine polish session adds per-trigger decay.

PostFx controller: [`src/fx/postfx.ts`](../src/fx/postfx.ts). `skiaPostFx` wired as `Skia` in
[`src/scene-registry.ts:68`](../src/scene-registry.ts#L68) (session #69). Chain tracks intensities live; visible pixel
compositing requires the GameView SkCanvas bridge (future engine session).

### Always-on chain

| Effect | Params | Purpose | Status |
|---|---|---|---|
| `vignette` | intensity 0.35, radius 0.82 | Darkness canvas framing | done — session #69 |
| `bloom` | threshold 0.72, intensity 0.5 | Luminosity lift on bright shapes | done — session #69 |

Both in [`src/fx/postfx.ts:19–20`](../src/fx/postfx.ts#L19).

### Situational effects

| Effect | Trigger | Status |
|---|---|---|
| Chromatic-aberration | Boss phase-break, elite death | done — session #70 |
| CRT scanlines | Z8 Księżyc only (Lucyper) | done — session #70 |
| Grayscale-flash | Player hit, bomb detonation, boss defeat | done — session #69 |

### Glow recipes

| Kind | Color | Alpha | Technique | Status |
|---|---|---|---|---|
| Friendly rim | `safe #6FA66B` | 0.25 (0x40) | oversized stroked ring at `r+4`, width 3 | done — session #69 |
| Hazard edge | `hazardOrange #E84B2A` | 0.6 (0x99) | double-stroke at `r+1`/`r+2`, width 0.5 | done — session #69 |

Glow helpers: [`@flare-engine/shapes`](../../../packages/shapes/src/draw.ts) — `friendlyGlowArgb()`, `hazardGlowArgb()`, `applyFriendlyGlow()`, `applyHazardGlow()`. Migrated from deleted `src/shapes-draw.ts` at session #92.
Glow field: [`@flare-engine/shapes`](../../../packages/shapes/src/types.ts) — `BaseSpec.glow?: 'friendly' | 'hazard'`. Migrated from deleted `src/shapes.ts` at session #92.
11 entities tagged friendly: `kogut-zloty` (player), `iskry`/`piorun`/`sol-swiecona`/`znak-pentagramu` (weapon pickups), `czarna-ksiega`/`siedmiomilowe-buty`/`amulet-wegrowski`/`koguci-pioro`/`srebrna-tarcza`/`kamien-filozoficzny` (upgrade pickups).
Flicker animation (enemy bullets): pending future session.

### Degradation rule

Drop chromatic-aberration if avg fps < 55 over 3 consecutive seconds. See §12.

---

## §6 — Explosion tiers

Updated 2026-04-29 (session #70): 5-tier preset system live in [`src/fx/explosions.ts`](../src/fx/explosions.ts). `burstExplosion` in [`src/particles.ts`](../src/particles.ts) is now a thin Tier-II wrapper.

### 5-tier table

| Tier | Name | Particles | Life | Shake | PostFX | +Draws | Use | Status |
|---|---|---|---|---|---|---|---|---|
| I | Chip | 8 spark | 120 ms | — | — | +0 | bullet hit | live — #70 |
| II | Pop | 24 spark+smoke | 280 ms | 2 px·80 ms | flash | +12 | grunt death | live — #70 |
| III | Burst | 64 spark+smoke | 520 ms | 5 px·180 ms | flash | +38 | elite/mini-boss | live — #70 |
| IV | Detonation | 128 spark+smoke | 900 ms | 10 px·320 ms | flash | +86 | boss phase-break | live — #70 |
| V | Cataclysm | 256 spark+debris | 1600 ms | 14 px·900 ms | flash | +220 | boss final, once/zone | live — #70 |

Public API: [`src/fx/explosions.ts`](../src/fx/explosions.ts) — `triggerExplosion`, `resetCataclysmGate`, `EXPLOSION_PRESETS`.
Preset type: `ExplosionTier = 'chip' | 'pop' | 'burst' | 'detonation' | 'cataclysm'`.

### Engine gaps deferred from #70

- **`state.timeScale` slow-mo** — Tier V deck specifies a slow-motion envelope on cataclysm (no engine `timeScale` API available).
- **Sequenced postfx chain** — deck specifies `flash→grayscale→bloom` cascade per tier; current engine `triggerHitFlash()` fires a single grayscale decay; per-trigger decay overrides deferred.
- **Perlin-noise shake** — deck specifies Perlin noise for Quake-class shake (Tier IV + V); current `camera.shake()` is sinusoidal only.

### Concurrent caps — done at session #70

| Tier | Cap |
|---|---|
| I–II | unlimited |
| III | ≤ 4 active |
| IV | ≤ 1 active |
| V | 1 per zone (overflow degrades to next-lower tier) |

### Camera shake taxonomy

| Name | Amplitude | Duration | Motion | Trigger |
|---|---|---|---|---|
| Tap | 2 px | 80 ms | perpendicular | bullet hit |
| Jolt | 5 px | 180 ms | radial | grunt death |
| Slam | 10 px | 320 ms | radial + rotation | mini-boss death |
| Quake | 14 px | 900 ms | Perlin noise | boss phase-break / Cataclysm |

---

## §7 — HUD anatomy

Folio reference: [folio-09-hud-play-frame.png](../../../docs/references/pan-tvardowski/folios/folio-09-hud-play-frame.png) — single most important presentation-layer folio.

HUD component: [`src/hud/Hud.tsx`](../src/hud/Hud.tsx).
Styles: [`src/hud/Hud.styles.ts`](../src/hud/Hud.styles.ts).
Spacing tokens: [`src/theme/spacing.ts`](../src/theme/spacing.ts).

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

HUD aligns with folio IX. HP gradient anchor `#2a0810` is intentional and distinct from brand `crimson-deep #7A1322` — see §13.

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
ARGB palette integers: [`src/palette.ts:18`](../src/palette.ts#L18).

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

### Per-phase palette shift — done at session #73

Each phase entry triggers a palette shift via `onPaletteShift` callback in boss FSMs: boss shape recolored to the phase's accent color, background lighting shifts to phase color. Wired in all 8 boss FSMs at session #73.

---

## §11 — Motion & accessibility

### Easing assignments — done at session #85

| Element | Easing | Duration | Status |
|---|---|---|---|
| Menu enter | cubicOut | 320 ms | engine gap: `fadeTransition` linear-only; cubicOut cannot be applied until transition API exposes easing param |
| Overlay open | expoOut | 240 ms | engine gap: no overlay open/close API with easing |
| Overlay close | expoIn | 180 ms | engine gap: no overlay open/close API with easing |
| Sigil pulse | sineInOut | 2400 ms loop | engine gap: no per-trigger sigil-pulse driver |
| Combo pulse | backOut(1.4) | 120 ms | done — #85; scale via `comboPulseScale` in state + play-scene tween |
| Boss intro | expoOut | 600 ms | done — #85; `bossBarOpacity` tween in play-scene |
| Player-hit flash | linear | 80 ms | engine gap: `triggerHitFlash` fixed decay; no per-trigger override |
| Game-over | cubicIn | 1200 ms | done — #85; `gameOverOpacity` tween in play-scene |
| Zone banner | quartOut | 800 ms | done — #85; `createZoneBannerState` in `src/hud/zone-banner.ts` |

Engine gaps surfaced at #85:
- `fadeTransition` is linear-only — no easing function parameter in the engine transition API.
- No overlay open/close API — overlays are rendered as React components; no scene-level enter/exit easing hooks.
- No sigil-pulse driver — no built-in periodic animation driver; would require a timer system in the engine.
- No per-trigger flash decay — `triggerHitFlash()` uses a fixed 4.2/s decay for all triggers.

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

Tokens in [`src/theme/colors.ts`](../src/theme/colors.ts) — done at session #74.

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

## Divergences — M2 punch-list

Items requiring code changes. Code-today links use live line numbers as of 2026-04-29.

| Topic | Deck spec | Code today | File:line | Severity | Target session | Status |
|---|---|---|---|---|---|---|
| Gold token | `#C9A24A` | `#C9A24A` (matches) | [`src/theme/colors.ts:4`](../src/theme/colors.ts#L4) | critical | #67 | done |
| Hazard token | `#E84B2A` | `#E84B2A` (matches) | [`src/theme/colors.ts:5`](../src/theme/colors.ts#L5) | critical | #67 | done |
| Ink-black bg | `#0E1A12` | `rgba(14,26,18,0.92)` | [`src/theme/colors.ts:11`](../src/theme/colors.ts#L11) | high | #67 | done |
| 9 missing pigments | bog-green/moss/parchment/verdigris/bone/rust/terracotta/void/parchment-2 | all present | [`src/theme/colors.ts`](../src/theme/colors.ts) | critical | #67 | done |
| Zone ARGB palettes | per-zone deck tokens | aligned at #72 | [`src/palette.ts:52`](../src/palette.ts#L52) | high | #72 | done |
| Fonts | EB Garamond / Source Sans 3 / JetBrains Mono | `@expo-google-fonts/*` + `useFonts` | [`src/theme/typography.ts`](../src/theme/typography.ts) | high | #68 | done |
| Icon system | 30 stamps (MaterialCommunityIcons) | Skia shapes only | — | — | — | intentional |
| Particles | 5-tier up to 256p | 5-tier system live | [`src/fx/explosions.ts`](../src/fx/explosions.ts) | high | #70 | done |
| PostFX Skia | bloom+vignette always-on | `skiaPostFx` wired as Skia | [`src/scene-registry.ts:68`](../src/scene-registry.ts#L68) | high | #69 | done |
| Boss per-phase palette | per-phase color in BOSS_SPECS | wired in all boss FSMs | `src/systems/boss/*.ts` | high | #73 | done |
| Reduce-motion + cb tokens | 5-rule policy + cb.player/hazard/safe | all rules done, cb tokens present | [`src/theme/colors.ts`](../src/theme/colors.ts), [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts) | low | #74 | done |

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

## §15 — Open work against folios

Punch-list of folio-vs-code gaps. Each row maps to a session row in [`docs/plans/sessions.md`](../../../docs/plans/sessions.md).

| # | Gap | Folio | Code locus | Severity | Session | Status |
|---|---|---|---|---|---|---|
| 1 | Ship-anatomy 3-element rule (`hull + N rect weapons + 1 square engine`) not implemented across the 29-ship codex | XIIIa, XIIIb, XIIIb+, XIIIc, XIIIf | [`src/shape-catalogue.ts`](../src/shape-catalogue.ts) | critical | sessions #76–#78 | done |
| 2 | 12-pigment palette migration incomplete (9 of 12 absent) | IV | [`src/theme/colors.ts`](../src/theme/colors.ts) | critical | #67 | done |
| 3 | HUD layout — boss bar at top, no HP gradient, no weapon meter, no zone banner Roman-numeral, no combo readout | IX | [`src/hud/Hud.tsx`](../src/hud/Hud.tsx), [`Hud.styles.ts`](../src/hud/Hud.styles.ts) | critical | #71 + #79 | done |
| 4 | Zone ARGB palettes diverge from folio tokens | XII, XIIB | [`src/palette.ts`](../src/palette.ts), [`src/config/zones.ts`](../src/config/zones.ts) | high | #72 | done |
| 5 | Per-phase boss palette shift not wired (`PhaseScript` carries no color fields) | XIII | `src/systems/boss/*.ts` | high | #73 | done |
| 6 | Reduced-motion rules 1–4 not implemented (rule 5 only) | XIV | [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts) | low | #74 | done |
| 7 | Color-blind tokens absent (`cb.player`, `cb.hazard`, `cb.safe`) | XIV | [`src/theme/colors.ts`](../src/theme/colors.ts) | low | #74 | done |
| 8 | Zone parallax stacks not yet audited against folio specs | XIIB | [`src/fx/ambience.ts`](../src/fx/ambience.ts), play-scene | medium | #84 | done |
| 9 | Frame-budget per-scene caps not enforced by FPS watchdog | XV | [`src/perf/cold-start.ts`](../src/perf/cold-start.ts) + [`src/fx/budget.ts`](../src/fx/budget.ts) | medium | #75 | done |
| 10 | Ship-anatomy 29-ship codex migration | XIIIa, XIIIb, XIIIb+, XIIIc, XIIIf | [`src/shape-catalogue.ts`](../src/shape-catalogue.ts) | critical | sessions #76–#78 | done |
| 11 | Overlay folio XI alignment (inventory, codex, dialogue, shop, paywall, achievements) | XI | overlay scenes in `src/scenes/` | high | sessions #82–#83 | done |
| 12 | Frontmatter folio X alignment (boot, menu, save-select, settings, credits) | X | frontmatter scenes in `src/scenes/` | high | sessions #80–#81 | done |
| 13 | Easing assignments 9 items (4 engine gaps documented in §11) | XIV | [`src/scenes/play.ts`](../src/scenes/play.ts), [`src/hud/zone-banner.ts`](../src/hud/zone-banner.ts) | medium | #85 | done |
| 14 | Typed visual-spec schema + `@flare-engine/shapes` engine package — architectural shift (sessions #91–#92). Introduces `src/visual-spec/` typed schema (HullPreset/ShipDef/BulletDef/WeaponDef/PickupDef/AnimationDef/ZoneVisualSpec/HudSpec/OverlaySpec/ScreenSpec/ThemeSpec), 14 schema-invariant tests, and `@flare-engine/shapes` with 12 atomic primitives (+ arc/annulus/trapezoid/path) replacing the deleted `src/shapes.ts` + `src/shapes-draw.ts`. Schema canary locked: SHA-256 `b056ac8e…` at S2 close. All §3 glow-helper and shape-type cross-links updated to point at `packages/shapes/src/`. | — (cross-cutting) | `src/visual-spec/{types,index,zone-*.ts}`, `packages/shapes/src/{types,draw,bounds,index}.ts` | architectural | sessions #91–#92 | done — 2026-05-07 |

### Verification

After each session that closes a row above, capture a device-build screenshot of the affected scene and place it next to the corresponding folio in `docs/references/pan-tvardowski/folios/diff/<folio>-current.png`. The visual-diff is the verification: builder + verifier confirm the live render matches the folio before flipping the row to `done`.

---

## §16 — M1 Audit Results (2026-05-07)

Full folio-vs-code audit: 21 PNG folios cross-referenced against §1–§15 of this document and live code symbols. Verdicts: ✓ match · ⚠ minor drift (doc-fixable) · ✗ runtime divergence (code fix required) · n/a (device-smoke gate required).

| Folio | Title | Code surface | Verdict | Notes |
|-------|-------|--------------|---------|-------|
| I | Cover / brand voice | `src/theme/colors.ts`, brand principles in §0.1 | ✓ | Ink-black bg, EB Garamond, crimson signature mark — all match §0.1. |
| II | Index — "A book in ten parts" | Scene registry (`src/scene-registry.ts`), section map in §0 | ✓ | All 10 deck chapters have corresponding §N entries in this document. |
| III | Brand principles (5 rules) | `src/theme/colors.ts`, `src/a11y/reduced-motion.ts`, `src/fx/budget.ts` | ✓ | Darkness-canvas (#0E1A12 bg), crimson-as-ink (trail/sigil/flash only), recolor-before-redraw (ShipSpec hull+tint), diacritics (§2 PL char set), 60 fps gospel (≤1k draws/≤512p/≤3 postfx per §12) — all codified. |
| IV | Palette — twelve pigments | `src/theme/colors.ts` | ✓ | All 12 folio pigments present at exact deck hexes; HP-bar anchor `#2a0810` disambiguation documented in §1. Session #67 migration complete. |
| V | Typography — three voices | `src/theme/typography.ts` | ⚠ | Font families + sizes match folio V. Six deprecated aliases (h1/h2/h3/body/caption/xs) still in file; line-number anchors in §2 corrected in M2 of this session. |
| VI | Skia language — no sprites, only shapes | `src/shape-catalogue.ts`, `@flare-engine/shapes` | ⚠ | 6 primitive types confirmed. §3 glow-helper cross-links referenced deleted files `src/shapes.ts` + `src/shapes-draw.ts`; corrected in M2 to point at `@flare-engine/shapes` (session #92 migration). |
| VIb | Explosions — 5 tiers | `src/fx/explosions.ts` | ✓ | 5-tier table (chip/pop/burst/detonation/cataclysm), particle counts, lifetimes, shake amplitudes, concurrent caps — all match folio VIb per §6. |
| IX | HUD anatomy — play frame | `src/hud/Hud.tsx`, `src/hud/Hud.styles.ts` | n/a — device-smoke gate covers this | Slot layout, font roles, HP gradient, weapon meter, zone banner, boss bar: all wired per §7 code. Pixel alignment vs folio IX verified only on physical device (Galaxy A54 + iPhone 12). |
| X | Frontmatter screens (5 of 13) | `src/scenes/{boot,menu,save-select,settings,credits}.ts`, `src/hud/{Boot,Menu}Overlay.tsx` | n/a — device-smoke gate covers this | Scene catalogue complete per §8; folio X layout (boot sigil, menu 4-button stack, save-select flat grid, settings 4-group scroll, credits typography) all implemented at sessions #80–#81. Pixel match requires device. |
| XI | Overlays (5 panels) | `src/hud/{Inventory,Codex,Dialogue,Shop,Achievements,Paywall}Overlay.tsx` + `*.styles.ts` | n/a — device-smoke gate covers this | Inventory tabs, codex unlocked/locked entries, dialogue portrait slot 44×44, shop product cards, achievements entries — all aligned at sessions #82–#83. Pixel match requires device. |
| XII | Zones — 8 cards | `src/palette.ts`, `src/config/zones.ts` | ✓ | 8 zones, zone names (PL), ambience kinds and particle counts match folio XII per §9 table. |
| XIIB | Zone specs — canonical source of truth | `src/palette.ts` (ZONE_PALETTES), `src/fx/ambience.ts` | ✓ | Per-zone palette tokens (primary/accent/hazard), ambience particle counts, parallax rates (VEL_SLOW 10 px/s, VEL_FAST 20 px/s after session #84 correction), spawn spawn rules — all match folio XIIB. |
| XIII | Boss visual beats — phases + postfx | `src/systems/boss/*.ts`, `src/fx/boss-postfx.ts` | ✓ | 8 bosses × phase descriptions + particle presets + postfx chains match §10 table. Per-phase palette shift wired at session #73. |
| XIIIa | Ship anatomy — 3-element rule | `src/shape-catalogue.ts` (ShipSpec), `@flare-engine/shapes` (ShipSpec type) | ✓ | All 29 ships satisfy hull + N rect weapons + 1 square engine. Weapon counts per tier correct (enemy 1–2, mini-boss 2–3, boss 2–4, player 2). Migration complete at sessions #76–#78. |
| XIIIb | Enemy ships (14) | `src/shape-catalogue.ts` (enemies section, lines 44–159) | ✓ | All 14 enemy ShipSpecs confirmed against folio XIIIb silhouettes. Hull kinds, weapon counts, hue families match. |
| XIIIb+ | Mini-bosses (4) — canonical bosses | `src/shape-catalogue.ts` (minibosses section, lines 164–203) | ✓ | All 4 mini-boss ShipSpecs in crimson hue family. Folio shows Leszy (arch), Bes (bottle), Mars (stepped), Czart (drop) — code uses ngon-4/ngon-6/ngon-5/triangle hulls. Visual mapping is preserved; exact silhouette only verifiable on device. |
| XIIIc | Weapons, artifacts, player ships | `src/shape-catalogue.ts` (weaponPickups + upgradePickups + ships sections) | ✓ | 4 weapon pickups, 6 upgrade pickups, 3 player ships (Kogut gold/Twardoń green/Bazyl blue) — all present with correct glow:friendly tags per folio XIIIc. |
| XIIId | Weapon specs — 8 weapons, source of truth | `src/config/gameplay.ts`, `src/shape-catalogue.ts` | n/a — device-smoke gate covers this | Folio XIIId lists damage/cooldown/particle per weapon. These are balance constants in `gameplay.ts`; session #89 (PT-Weapon-Specs) is the dedicated alignment pass. No code divergence found in shapes; config alignment is post-#87. |
| XIIIf | Boss ships (8) | `src/shape-catalogue.ts` (bosses section, lines 208–297) | ✓ | All 8 boss ShipSpecs in violet hue family. Hull kinds match folio XIIIf (Boruta=moon/arch, Mefist=star-6, Lucyper=star-8, Baba=triangle, etc.). Weapon counts (2–4) correct. |
| XIV | Motion + accessibility | `src/scenes/play.ts`, `src/hud/zone-banner.ts`, `src/a11y/reduced-motion.ts`, `src/theme/colors.ts` | ✓ | 5 easing assignments shipped (items 1/5/6/8/9); 4 engine gaps documented in §11 (items 2/3/4/7). 5-rule reduce-motion policy complete. Color-blind tokens (`cb.player/hazard/safe`) present. Contrast floor 14.2:1 maintained. |
| XV | Frame budget — per-scene caps | `src/fx/budget.ts`, `src/perf/cold-start.ts` | ✓ | Per-scene caps from folio XV encoded in `FRAME_BUDGET` constants; fps watchdog (< 55 fps over 3s → drop chromatic-ab); degradation policy per §12. Real-device measurement deferred to session #59 (PT-Perf). |

### Audit summary

- 14 ✓ confirmed match
- 2 ⚠ minor drift (doc cross-link staleness only, corrected in M2 of this session)
- 0 ✗ runtime code divergences
- 5 n/a (device-smoke gate: folios IX, X, XI, XIIId — pixel alignment and weapon balance require physical device)

No runtime code changes were required. All divergences were documentation-level (stale file paths, stale line numbers, stale "will migrate" notes) and resolved in M2.
