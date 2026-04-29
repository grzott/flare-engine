# Pan Tvardowski — Canonical Visual Reference

This file is the **single source of truth** for all visual specifications in Pan Tvardowski.
Every value (hex, px, ms, particle count) that appears in code must agree with this document.
The HTML deck at `docs/references/pan-tvardowski/Pan Tvardowski - Visual Reference.html`
is preserved as a visual companion — mood boards, rendered previews, concept art — **not a spec**.
Do not propagate values from the deck into code without cross-checking here first.

---

## §1 — Palette

### 12-pigment system (deck Chapter 01)

| Token | Deck hex | Code today | Code symbol | File:line | Migration |
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

### Font families

| Family | Role | Size range | Status |
|---|---|---|---|
| EB Garamond (serif) | Titles, zone banners, boss names | 56–132 px | not loaded — session #68 |
| Source Sans 3 (sans-serif) | Dialogue, codex, UI labels | 14–22 px | not loaded — session #68 |
| JetBrains Mono (monospace) | HUD numerics, debug overlay | 11–18 px | not loaded — session #68 |

All three families must be bundled in `assets/fonts/` and wired via `expo-font` in `App.tsx`.

### Type-scale

| Role | Deck name | Deck size | Code today | Code file:line | Status |
|---|---|---|---|---|---|
| Display XL | `display-xl` | 132 px | absent | — | session #68 |
| Display L | `display-l` | 80 px | absent | — | session #68 |
| Display M | `display-m` | 56 px | absent | — | session #68 |
| Heading 1 | `h1` | 28 px | `h1 fontSize:28` | [`src/theme/typography.ts:1`](../src/theme/typography.ts#L1) | matches |
| Heading 2 | `h2` | 26 px | `h2 fontSize:26` | [`src/theme/typography.ts:2`](../src/theme/typography.ts#L2) | matches |
| Heading 3 | `h3` | 20 px | `h3 fontSize:20` | [`src/theme/typography.ts:3`](../src/theme/typography.ts#L3) | matches |
| Body | `body` | 14 px | `body fontSize:14` | [`src/theme/typography.ts:5`](../src/theme/typography.ts#L5) | matches |
| Label | `label` | 14 px | `label fontSize:14` | [`src/theme/typography.ts:4`](../src/theme/typography.ts#L4) | matches |
| Caption | `caption` | 12 px | `caption fontSize:12` | [`src/theme/typography.ts:6`](../src/theme/typography.ts#L6) | matches |
| Mono HUD | `mono-hud` | 18 px | absent | — | session #68 |
| Mono debug | `mono-debug` | 11 px | absent | — | session #68 |

### PL diacritics

The following characters must render correctly at all sizes and font weights:
**ą ć ę ł ń ó ś ź ż**. Font files must include full Polish Latin Extended coverage.

---

## §3 — Shape vocabulary

### 6 Skia primitives (deck Chapter 02)

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

#### Enemies (14) — lines 29–114

| Entity | Kind | Key color constant | Line |
|---|---|---|---|
| `skrzat` | triangle + 2 circle eyes | ORANGE | [32](../src/shape-catalogue.ts#L32) |
| `latawiec` | triangle + polyline tail | RED | [37](../src/shape-catalogue.ts#L37) |
| `czart` | ngon-5 + 2 horn triangles | BLACK | [46](../src/shape-catalogue.ts#L46) |
| `bies` | ngon-6 + circle eye | DARK_RED | [51](../src/shape-catalogue.ts#L51) |
| `licho` | star-5 | PURPLE | [55](../src/shape-catalogue.ts#L55) |
| `strzyga` | triangle + 2 wing rects | PALE | [56](../src/shape-catalogue.ts#L56) |
| `topielec` | circle + 2 polyline legs | BLUE_GREEN | [61](../src/shape-catalogue.ts#L61) |
| `mamuna` | ngon-8 + 3 circle spots | GREEN | [76](../src/shape-catalogue.ts#L76) |
| `nocnica` | circle | BLACK | [82](../src/shape-catalogue.ts#L82) |
| `poludnica` | triangle + rect | YELLOW_WHITE | [83](../src/shape-catalogue.ts#L83) |
| `wapierz` | ngon-8 stroked | DARK_RED | [87](../src/shape-catalogue.ts#L87) |
| `hound` | circle + 2 ear triangles + 2 eyes | BLACK | [97](../src/shape-catalogue.ts#L97) |
| `dziwozona` | ngon-5 + 2 side triangles | TEAL | [104](../src/shape-catalogue.ts#L104) |
| `moon-wraith` | triangle + ring + circle | `0xff2b2d5a` | [109](../src/shape-catalogue.ts#L109) |

#### Mini-bosses (4) — lines 118–144

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `rokita` | ngon-4 + polyline roots | GREEN + BROWN | [119](../src/shape-catalogue.ts#L119) |
| `leszy` | ngon-6 stroked | BROWN + GREEN | [128](../src/shape-catalogue.ts#L128) |
| `nocny-lowca` | star-4 + 4 tip triangles | BLACK + PALE | [129](../src/shape-catalogue.ts#L129) |
| `madej` | rect + 5 spike triangles | HELLFIRE + BLACK | [136](../src/shape-catalogue.ts#L136) |

#### Bosses (8) — lines 148–211

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `smok-krzemionkowski` | ngon-6 + triangle flame | COPPER + HELLFIRE | [149](../src/shape-catalogue.ts#L149) |
| `borowy-krol` | ngon-5 stroked + star-5 | GREEN + BROWN | [153](../src/shape-catalogue.ts#L153) |
| `wodnik-wislanny` | gradient-rect + circle | `0xff2f5f7a` + BLUE_GREEN | [165](../src/shape-catalogue.ts#L165) |
| `boruta` | ngon-8 stroked + 2 triangles | BLACK + HELLFIRE | [176](../src/shape-catalogue.ts#L176) |
| `baba-jaga` | ngon-3 + rect broom | PURPLE + BROWN | [188](../src/shape-catalogue.ts#L188) |
| `bazyliszek-warszawski` | ngon-6 + circle eye | `0xff9d3dff` + EYE_YELLOW | [192](../src/shape-catalogue.ts#L192) |
| `mefistofeles` | star-6 + circle | HELLFIRE + BLACK | [196](../src/shape-catalogue.ts#L196) |
| `lucyper-ksiezycowy` | gradient-rect + star-8 | `0xff2b2d5a`→`0xffd6002e` + MIRROR | [200](../src/shape-catalogue.ts#L200) |

#### Ships (3) — lines 215–225

| Entity | Kind | Key color | Line |
|---|---|---|---|
| `kogut-zloty` | triangle + circle engine | GOLD + HELLFIRE | [216](../src/shape-catalogue.ts#L216) |
| `alembik` | ngon-5 stroked | MIRROR + COPPER | [220](../src/shape-catalogue.ts#L220) |
| `zwierciadlo` | ngon-4 stroked + ring | MIRROR + BLACK | [221](../src/shape-catalogue.ts#L221) |

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

Duration: 80 ms. Envelope: white frame 20% opacity → transparent 100%.
Implemented via `createGrayscaleFlash('grayscale-flash', { intensity: 0 })` with auto-decay.
Current wiring at [`src/fx/postfx.ts:18`](../src/fx/postfx.ts#L18). Flash triggered on `player-hit` event.

PostFx controller: [`src/fx/postfx.ts`](../src/fx/postfx.ts). Currently initialized but bound as `skiaPostFx = null` in
[`src/scene-registry.ts:63`](../src/scene-registry.ts#L63) — visible pixel application deferred to session #69.

### Always-on chain

| Effect | Params | Purpose |
|---|---|---|
| `vignette` | intensity 0.35, radius 0.82 | Darkness canvas framing |
| `bloom` | threshold 0.72, intensity 0.5 | Luminosity lift on bright shapes |

Both in [`src/fx/postfx.ts:15–19`](../src/fx/postfx.ts#L15).

### Situational effects

| Effect | Trigger | Session |
|---|---|---|
| Chromatic-aberration | Boss phase-break, elite death | #69 |
| CRT scanlines | Z8 Księżyc only (Lucyper) | #69 |
| Grayscale-flash | Player hit, bomb detonation | #69 |

### Degradation rule

Drop chromatic-aberration if avg fps < 55 over 3 consecutive seconds. See §12.

---

## §6 — Explosion tiers

### 5-tier table

| Tier | Name | Particles | Life | Shake | PostFX | +Draws | Use |
|---|---|---|---|---|---|---|---|
| I | Chip | 8 spark | 120 ms | — | — | +0 | bullet hit |
| II | Pop | 24 spark+ash | 280 ms | 2 px·80 ms | bloom-pulse | +12 | grunt death |
| III | Burst | 64 spark+smoke | 520 ms | 5 px·180 ms | bloom+chrom-ab | +38 | elite/mini-boss |
| IV | Detonation | 128 spark+shrapnel | 900 ms | 10 px·320 ms | bloom+chrom+flash | +86 | boss phase-break |
| V | Cataclysm | 256+debris | 1600 ms+slow-mo | 14 px·900 ms | flash→grayscale→bloom | +220 | boss final, once/zone |

Current particle implementation (basic 10-burst only): [`src/particles.ts:16`](../src/particles.ts#L16).
5-tier system lands at session #70.

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

HUD component: [`src/hud/Hud.tsx`](../src/hud/Hud.tsx).
Styles: [`src/hud/Hud.styles.ts`](../src/hud/Hud.styles.ts).
Spacing tokens: [`src/theme/spacing.ts`](../src/theme/spacing.ts).

| Element | Position | Color | Font role | Notes |
|---|---|---|---|---|
| Score | top-left `hudCornerX=16 hudCornerY=32` | `colors.ui.primary` | h3 20 px | [`Hud.styles.ts:12`](../src/hud/Hud.styles.ts#L12) |
| HP text | below score, `marginTop sm=4` | `#fff` | body 14 px | [`Hud.styles.ts:13`](../src/hud/Hud.styles.ts#L13) |
| Bombs | below HP, `marginTop xs=2` | `#fff` | body 14 px | [`Hud.styles.ts:14`](../src/hud/Hud.styles.ts#L14) |
| Boss bar | top-center, `h=bossBarHeight=8` | `colors.ui.hazard` fill | label 14 px | [`Hud.styles.ts:15–34`](../src/hud/Hud.styles.ts#L15) |
| Miniboss bar | below boss bar at `top=56`, `h=minibossBarHeight=6`, `w=70%` | `colors.ui.secondary` fill | caption 12 px | [`Hud.styles.ts:35–54`](../src/hud/Hud.styles.ts#L35) |
| Zone banner | `top 38%`, centered | `colors.ui.primary` title | h2 26 px | [`Hud.styles.ts:55–73`](../src/hud/Hud.styles.ts#L55) |

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

Implementation at session #74. The `createA11yBridge` call is at
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
| Fonts | EB Garamond / Source Sans 3 / JetBrains Mono | system stack (no fontFamily) | [`src/theme/typography.ts:1`](../src/theme/typography.ts#L1) | high | #68 | open |
| Icon system | 30 stamps (MaterialCommunityIcons) | Skia shapes only | — | — | — | intentional |
| Particles | 5-tier up to 256p | basic 10-burst | [`src/particles.ts:16`](../src/particles.ts#L16) | high | #70 | open |
| PostFX Skia | bloom+vignette always-on | `skiaPostFx = null` | [`src/scene-registry.ts:63`](../src/scene-registry.ts#L63) | high | #69 | open |
| Boss per-phase palette | per-phase color in BOSS_SPECS | not wired in any boss FSM | `src/systems/boss/*.ts` | high | #73 | open |
| Reduce-motion + cb tokens | 5-rule policy + cb.player/hazard/safe | partial; cb tokens absent | [`src/theme/colors.ts`](../src/theme/colors.ts) | low | #74 | open |

---

## §13 — Deck errors & deliberate deviations

Three confirmed errors in the HTML deck. **Code is correct where it diverges from the deck.**

### Ship art orientation

`docs/references/pan-tvardowski/uploads/player1.jpg`, `player2.jpg`, `player3.jpg` depict ships
pointing down or sideways. This is a composition error in the reference images.
The live `kogut-zloty` shape (`triangle` pointing up, GOLD fill) at
[`src/shape-catalogue.ts:216`](../src/shape-catalogue.ts#L216) is correct.
Do not "fix" the code to match the photographs.

### DrawIO rotations

`docs/references/pan-tvardowski/uploads/ships-design.drawio` lists mini-boss rotation values
`-90°`, `-180°`, `112°`. These imply sideways hulls and are incorrect drafting angles.
All live shapes in `shape-catalogue.ts` are correctly oriented (pointing up or neutral).
Treat the DrawIO file as a scratch reference only.

### HP-bar hex

Deck Folio IX uses `#2a0810` in an HP-bar context, while the named token `--crimson-deep`
is `#7A1322`. These are not the same value and serve different roles:

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
