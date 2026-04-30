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

### 12-pigment system

| Token | Folio IV hex | Code today | Code symbol | File:line | Migration |
|---|---|---|---|---|---|
| `gold` | `#C9A24A` | `#F3C262` | `colors.ui.primary` | [`src/theme/colors.ts:4`](../src/theme/colors.ts#L4) | **critical — #67** |
| `crimson` | `#D4213D` | `#C0392B` | `colors.ui.hazard` | [`src/theme/colors.ts:5`](../src/theme/colors.ts#L5) | **critical — #67** |
| `ink-black` | `#0E1A12` | `rgba(10,6,16,0.92)` | `colors.ui.bodyBg` | [`src/theme/colors.ts:12`](../src/theme/colors.ts#L12) | **high — #67** |
| `parchment` | `#E8DCC4` | absent | — | — | **critical — #67** |
| `bog-green` | `#1A2E1F` | absent | — | — | **critical — #67** |
| `moss` | `#243A29` | absent | — | — | **critical — #67** |
| `verdigris` | `#4A7A6A` | absent | — | — | **critical — #67** |
| `bone` | `#C7B89A` | absent | — | — | **critical — #67** |
| `rust` | `#8B3A1F` | absent | — | — | **critical — #67** |
| `terracotta` | `#B05A3C` | absent | — | — | **critical — #67** |
| `void` | `#050A07` | absent | — | — | **critical — #67** |
| `parchment-2` | `#D9C9A8` | absent | — | — | **critical — #67** |
| `parchment-dim` | `#A8997A` | absent | — | — | **critical — #67** |
| `gold-deep` | `#8E6F2C` | absent | — | — | **critical — #67** |
| `crimson-deep` | `#7A1322` | absent | — | — | **critical — #67** |
| `hazard` | `#E84B2A` | absent | — | — | **critical — #67** |
| `safe` | `#6FA66B` | absent | — | — | **critical — #67** |

All tokens land in [`src/theme/colors.ts`](../src/theme/colors.ts) at session #67.

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
| Heading 1 | `h1` | 28 px | `h1 fontSize:28` | [`src/theme/typography.ts:1`](../src/theme/typography.ts#L1) | matches |
| Heading 2 | `h2` | 26 px | `h2 fontSize:26` | [`src/theme/typography.ts:2`](../src/theme/typography.ts#L2) | matches |
| Heading 3 | `h3` | 20 px | `h3 fontSize:20` | [`src/theme/typography.ts:3`](../src/theme/typography.ts#L3) | matches |
| Body | `body` | 14 px | `body fontSize:14` | [`src/theme/typography.ts:5`](../src/theme/typography.ts#L5) | matches |
| Label | `label` | 14 px | `label fontSize:14` | [`src/theme/typography.ts:4`](../src/theme/typography.ts#L4) | matches |
| Caption | `caption` | 12 px | `caption fontSize:12` | [`src/theme/typography.ts:6`](../src/theme/typography.ts#L6) | matches |
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

#### Weapon pickups (4) — lines 229–245

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `iskry` | 3 circles | ORANGE | [230](../src/shape-catalogue.ts#L230) |
| `piorun` | polyline bolt | EYE_YELLOW | [235](../src/shape-catalogue.ts#L235) |
| `sol-swiecona` | ring | MIRROR | [243](../src/shape-catalogue.ts#L243) |
| `znak-pentagramu` | star-5 | PURPLE | [244](../src/shape-catalogue.ts#L244) |

#### Upgrade pickups (6) — lines 249–280

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `czarna-ksiega` | rect stroked | BLACK + GOLD | [250](../src/shape-catalogue.ts#L250) |
| `siedmiomilowe-buty` | 2 rects | BROWN | [251](../src/shape-catalogue.ts#L251) |
| `amulet-wegrowski` | ring + circle | GOLD + HELLFIRE | [255](../src/shape-catalogue.ts#L255) |
| `koguci-pioro` | polyline | GOLD | [259](../src/shape-catalogue.ts#L259) |
| `srebrna-tarcza` | ngon-6 stroked | MIRROR + BLACK | [267](../src/shape-catalogue.ts#L267) |
| `kamien-filozoficzny` | ngon-8 stroked | PURPLE + GOLD | [277](../src/shape-catalogue.ts#L277) |

### Color constant summary

Inline constants at [`src/shape-catalogue.ts:12–28`](../src/shape-catalogue.ts#L12):
`BLACK=0xff111111 / ORANGE=0xffff9944 / RED=0xffc0392b / DARK_RED=0xff7a1a1a /
PURPLE=0xff8844ff / BLUE_GREEN=0xff3aa08c / GREEN=0xff5cae6e / PALE=0xffe6dcc8 /
YELLOW_WHITE=0xfff7f3a6 / TEAL=0xff3ac4b4 / BROWN=0xff6b4423 / GOLD=0xfff3c262 /
MIRROR=0xffc8cdd4 / COPPER=0xffb5651d / HELLFIRE=0xffff2b2b / EYE_YELLOW=0xffffdd55`

These are **current code values** — several diverge from deck tokens (see §1 punch-list). Session #67 will migrate them to canonical hexes.

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
Current wiring at [`src/fx/postfx.ts:18`](../src/fx/postfx.ts#L18). Flash triggered on `player-hit` (existing), bomb detonation, and boss defeat (session #69).

Engine gap: `triggerHitFlash()` lacks per-trigger decay override — deck specifies 80 ms player-hit / 200 ms bomb / 1200 ms boss-defeat; all use the fixed 4.2-decay until a future engine polish session adds per-trigger decay.

PostFx controller: [`src/fx/postfx.ts`](../src/fx/postfx.ts). `skiaPostFx` re-enabled as `Skia` in
[`src/scene-registry.ts`](../src/scene-registry.ts) (session #69). Chain tracks intensities live; visible pixel
compositing requires the GameView SkCanvas bridge (future engine session).

### Always-on chain

| Effect | Params | Purpose | Status |
|---|---|---|---|
| `vignette` | intensity 0.35, radius 0.82 | Darkness canvas framing | live — session #69 |
| `bloom` | threshold 0.72, intensity 0.5 | Luminosity lift on bright shapes | live — session #69 |

Both in [`src/fx/postfx.ts:15–19`](../src/fx/postfx.ts#L15).

### Situational effects

| Effect | Trigger | Status |
|---|---|---|
| Chromatic-aberration | Boss phase-break, elite death | pending #70+ |
| CRT scanlines | Z8 Księżyc only (Lucyper) | pending #70+ |
| Grayscale-flash | Player hit, bomb detonation, boss defeat | live — session #69 |

### Glow recipes

| Kind | Color | Alpha | Technique | Status |
|---|---|---|---|---|
| Friendly rim | `safe #6FA66B` | 0.25 (0x40) | oversized stroked ring at `r+4`, width 3 | live — session #69 |
| Hazard edge | `hazardOrange #E84B2A` | 0.6 (0x99) | double-stroke at `r+1`/`r+2`, width 0.5 | live — session #69 |

Glow helpers: [`src/shapes-draw.ts`](../src/shapes-draw.ts) — `friendlyGlowArgb()`, `hazardGlowArgb()`, `applyFriendlyGlow()`, `applyHazardGlow()`.
Glow field: [`src/shapes.ts`](../src/shapes.ts) — `BaseSpec.glow?: 'friendly' | 'hazard'`.
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

### Concurrent caps

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

### Folio IX target layout (mobile portrait 9:16)

| Slot | Position | Token | Type | Notes |
|---|---|---|---|---|
| Score | top-left | `mono.hud` parchment | 3-digit groups, e.g. `012 480` | folio IX |
| Combo | below score | `mono.hud` crimson | `×N` pulses on hit | folio IX |
| Zone banner | top-center | `display.m` italic + gold rule | Roman numeral + zone name (e.g. `— I — Dachy Krakowa`) | folio IX |
| Bombs | top-right | `stamp.bomb` crimson | filled / outline pip dots | folio IX |
| HP bar | bottom (above boss bar) | `HUDBar` crimson gradient | `#2a0810 → #D4213D` left-to-right; flickers ≤2 segments | folio IX |
| Weapon meter | bottom-right (above boss bar) | 5-segment crimson | weapon-level + cooldown indicator (e.g. `PIORUN · L2`) | folio IX |
| Boss bar | bottom | `display.m` + bar | gold border `#C9A24A`; only when boss alive (e.g. `Smok Krzemionkowski — faza II`) | folio IX |

### Live code state (current divergences)

The live HUD diverges from folio IX on layout and content. Tracked in §15.

- Boss bar is rendered **at top** in current code (`Hud.styles.ts:15–34`); folio IX places it at bottom.
- HP is rendered as **plain text** (`HP 03/05`); folio IX requires a horizontal gradient bar.
- **Combo readout, weapon meter, zone banner with Roman numeral** — not implemented.
- HP gradient anchor `#2a0810` is intentional and distinct from brand `crimson-deep #7A1322` — see §13.

### HP-bar gradient spec (session #71)

The HP bar fill should be a horizontal gradient: `#2a0810` (depleted/left) → `#D4213D` (full/right).
`#2a0810` is the gradient anchor only — see §1 disambiguation note.

### Weapon meter spec (session #71)

5-segment vertical strip, crimson fill `#D4213D`, right side of screen.

### Boss bar spec (session #71)

Gold border `#C9A24A` around the boss bar background. Fill color stays `hazard #E84B2A`.

---

## §8 — Scene catalogue

Scene registry: [`src/scene-registry.ts`](../src/scene-registry.ts).

| Scene | Type | Registry key | Status | Line |
|---|---|---|---|---|
| Boot | frontmatter | `boot` | done | [72](../src/scene-registry.ts#L72) |
| Menu | frontmatter | `menu` | done | [91](../src/scene-registry.ts#L91) |
| Save-select | frontmatter | `save-select` | done | [92](../src/scene-registry.ts#L92) |
| Settings | frontmatter | `settings` | done | [93](../src/scene-registry.ts#L93) |
| Credits | frontmatter | `credits` | done | [94](../src/scene-registry.ts#L94) |
| Play | gameplay | `play` | done | [99](../src/scene-registry.ts#L99) |
| Inventory | overlay | `inventory` | done | [95](../src/scene-registry.ts#L95) |
| Codex-shards | overlay | `codex-shards` | done | [96](../src/scene-registry.ts#L96) |
| Achievements | overlay | `achievements` | done | [97](../src/scene-registry.ts#L97) |
| Shop | overlay | `shop` | done | [98](../src/scene-registry.ts#L98) |
| Game-over | end | `game-over` | done | [115](../src/scene-registry.ts#L115) |
| Victory | end | `victory` | done | [116](../src/scene-registry.ts#L116) |
| Capture | util | — | not yet registered | — |

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

Zone ARGB palettes diverge from deck — all 8 will be replaced at session #72.
Z8 silver-UI exception: entire UI chrome inverts to silver-on-black for Z8. Deferred to #72.

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

### Per-phase palette shift

Each phase entry should trigger a palette shift: boss shape recolored to the phase's accent color,
background lighting shifts to phase color. Wiring deferred to session #73. No boss FSM currently
implements per-phase color.

---

## §11 — Motion & accessibility

### Easing assignments

| Element | Easing | Duration |
|---|---|---|
| Menu enter | cubicOut | 320 ms |
| Overlay open | expoOut | 240 ms |
| Overlay close | expoIn | 180 ms |
| Sigil pulse | sineInOut | 2400 ms loop |
| Combo pulse | backOut(1.4) | 120 ms |
| Boss intro | expoOut | 600 ms |
| Player-hit flash | linear | 80 ms |
| Game-over | cubicIn | 1200 ms |
| Zone banner | quartOut | 800 ms |

### Reduce-motion policy (5 rules)

When `reducedMotion = true` (from `@flare-engine/a11y` — manager deleted from game at M27 lift;
reduce-motion flag now lives in `gameState.settings.reducedMotion` mirrored from the bridge):

1. **Parallax** → static (no layer offset update).
2. **Sigil pulse** → dim 70%, no animation.
3. **Combo pulse** → color shift only (no scale animation).
4. **Boss intro** → cross-fade only (no translate).
5. **Screen shake** → 1-frame red flash instead (no camera movement).

Rule 5 (shake → 1-frame red flash) implemented at session #71 via `applyShake` helper in
[`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts).
Rules 1–4 deferred to session #74. The `createA11yBridge` call is at
[`src/scene-registry.ts:65`](../src/scene-registry.ts#L65).

### Color-blind tokens

| Token | Hex | Replaces |
|---|---|---|
| `cb.player` | `#FF8C42` | ship fill in all palettes |
| `cb.hazard` | `#FFD23F` | enemy bullet + hazard fill |
| `cb.safe` | `#4FC3F7` | pickups + safe-zone markers |

Tokens land in [`src/theme/colors.ts`](../src/theme/colors.ts) at session #74.

### Contrast floor

Parchment `#E8DCC4` on ink-black `#0E1A12`: **14.2:1** (WCAG AAA).
All UI text must satisfy this minimum.

---

## §12 — Frame budget

Per-scene worst-case caps. Degradation triggers at session #75.

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
FPS watchdog: session #75. Perf baseline instrumentation:
[`src/perf/cold-start.ts:16`](../src/perf/cold-start.ts#L16).

---

## Divergences — M2 punch-list

Items requiring code changes. Code-today links use live line numbers as of 2026-04-29.

| Topic | Deck spec | Code today | File:line | Severity | Target session | Status |
|---|---|---|---|---|---|---|
| Gold token | `#C9A24A` | `#F3C262` | [`src/theme/colors.ts:4`](../src/theme/colors.ts#L4) | critical | #67 | open |
| Hazard token | `#E84B2A` | `#C0392B` | [`src/theme/colors.ts:5`](../src/theme/colors.ts#L5) | critical | #67 | open |
| Ink-black bg | `#0E1A12` | `rgba(10,6,16,0.92)` | [`src/theme/colors.ts:12`](../src/theme/colors.ts#L12) | high | #67 | open |
| 9 missing pigments | bog-green/moss/parchment/verdigris/bone/rust/terracotta/void/parchment-2 | absent | [`src/theme/colors.ts`](../src/theme/colors.ts) | critical | #67 | open |
| Zone ARGB palettes | per-zone deck tokens | ARGB ints (all diverge) | [`src/palette.ts:18`](../src/palette.ts#L18) | high | #72 | open |
| Fonts | EB Garamond / Source Sans 3 / JetBrains Mono | `@expo-google-fonts/*` + `useFonts` | [`src/theme/typography.ts`](../src/theme/typography.ts) | high | #68 | done |
| Icon system | 30 stamps (MaterialCommunityIcons) | Skia shapes only | — | — | — | intentional |
| Particles | 5-tier up to 256p | 5-tier system live | [`src/fx/explosions.ts`](../src/fx/explosions.ts) | high | #70 | done |
| PostFX Skia | bloom+vignette always-on | `skiaPostFx = null` | [`src/scene-registry.ts:63`](../src/scene-registry.ts#L63) | high | #69 | open |
| Boss per-phase palette | per-phase color in BOSS_SPECS | not wired in any boss FSM | `src/systems/boss/*.ts` | high | #73 | open |
| Reduce-motion + cb tokens | 5-rule policy + cb.player/hazard/safe | partial; cb tokens absent | [`src/theme/colors.ts`](../src/theme/colors.ts) | low | #74 | open |

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

Punch-list of folio-vs-code gaps, severity-ordered. Each row maps to an existing or new session row in [`docs/plans/sessions.md`](../../../docs/plans/sessions.md). Items marked as scheduled are already in the build plan; the ship-anatomy migration is a new milestone introduced by the folio adoption.

| # | Gap | Folio | Code locus | Severity | Session | Status |
|---|---|---|---|---|---|---|
| 1 | Ship-anatomy 3-element rule (`hull + N rect weapons + 1 square engine`) not implemented across the 29-ship codex | XIIIa, XIIIb, XIIIb+, XIIIc, XIIIf | [`src/shape-catalogue.ts`](../src/shape-catalogue.ts) | critical | sessions #76–#78 | done |
| 2 | 12-pigment palette migration incomplete (9 of 12 absent) | IV | [`src/theme/colors.ts`](../src/theme/colors.ts) | critical | #67 | open |
| 3 | HUD layout — boss bar at top, no HP gradient, no weapon meter, no zone banner Roman-numeral, no combo readout | IX | [`src/hud/Hud.tsx`](../src/hud/Hud.tsx), [`Hud.styles.ts`](../src/hud/Hud.styles.ts) | critical | #71 + new HUD-layout session | open |
| 4 | Zone ARGB palettes diverge from folio tokens | XII, XIIB | [`src/palette.ts`](../src/palette.ts), [`src/config/zones.ts`](../src/config/zones.ts) | high | #72 | open |
| 5 | Per-phase boss palette shift not wired (`PhaseScript` carries no color fields) | XIII | `src/systems/boss/*.ts` | high | #73 | open |
| 6 | Reduced-motion rules 1–4 not implemented (rule 5 only) | XIV | [`src/a11y/reduced-motion.ts`](../src/a11y/reduced-motion.ts) | low | #74 | open |
| 7 | Color-blind tokens absent (`cb.player`, `cb.hazard`, `cb.safe`) | XIV | [`src/theme/colors.ts`](../src/theme/colors.ts) | low | #74 | open |
| 8 | Zone parallax stacks not yet audited against folio specs | XIIB | parallax wiring in `src/scenes/play.ts` | medium | needs audit | open |
| 9 | Frame-budget per-scene caps not enforced by FPS watchdog | XV | [`src/perf/cold-start.ts`](../src/perf/cold-start.ts) + new watchdog | medium | #75 | open |

### Verification

After each session that closes a row above, capture a device-build screenshot of the affected scene and place it next to the corresponding folio in `docs/references/pan-tvardowski/folios/diff/<folio>-current.png`. The visual-diff is the verification: builder + verifier confirm the live render matches the folio before flipping the row to `done`.
