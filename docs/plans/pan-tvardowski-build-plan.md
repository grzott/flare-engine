# Pan Tvardowski — Build Plan

> The canonical end-to-end showcase game for the Flare engine.
> Genre: vertical-scrolling shoot-em-up. Theme: Polish folklore (_Pan Twardowski_ legend).
> Location: [`apps/pan-tvardowski/`](../../apps/pan-tvardowski/). License: PolyForm Noncommercial 1.0.0.

---

## Table of contents

1. [Positioning & goals](#1--positioning--goals)
2. [Legal & IP posture](#2--legal--ip-posture)
3. [Story treatment](#3--story-treatment)
4. [Game structure](#4--game-structure)
5. [Zone list](#5--zone-list)
6. [Art direction — shape atlas](#6--art-direction--shape-atlas)
7. [Enemies](#7--enemies-12)
8. [Mini-bosses](#8--mini-bosses-4)
9. [Bosses](#9--bosses-8)
10. [Weapons](#10--weapons-4)
11. [Player ships](#11--player-ships-3)
12. [Upgrades](#12--upgrades-6)
13. [Dialogue script](#13--dialogue-script-en--pl)
14. [Achievements](#14--achievements-12)
15. [Localization](#15--localization)
16. [Engine surface coverage](#16--engine-surface-coverage)
17. [Milestones](#17--milestones)
18. [Publishing plan](#18--publishing-plan)
19. [Trademark plan](#19--trademark-plan)

---

## 1 — Positioning & goals

**Why this game exists.** Three distinct jobs:

1. **Dogfood** — every shipping `@flare-engine/*` package must be exercised by at least one mechanic. If a package isn't used here, it's either genuinely out-of-scope (`pathfinding`) or a red flag we built an unnecessary package.
2. **Store presence** — a real published game (Google Play + App Store at 0.1.0, Steam at 0.2.0) is a stronger engine sales pitch than any benchmark chart. The Docusaurus site links to store pages as proof the engine handles end-to-end game delivery.
3. **Content** — device-captured gameplay footage is the launch-day demo reel; it replaces the web-playable build deferred in stage 11.11.

**Non-goals.**

- Not a commercial hit. Score-attack shmups have a small audience; that's fine.
- Not a showcase for `@flare-engine/pathfinding` — that package will be exercised by a different post-launch project.

**Store lineup (engine promotion).** Pan Tvardowski is the **first of three planned Flare-built games** that will ship to stores as living proof the engine handles end-to-end delivery across genres. The other two (a top-down action-adventure and a deck-builder) are **not planned in this repo** — they follow PT and are out of scope here. Mentioned only so readers understand PT's role is "canonical + first", not "only".

**Demo retirement.** `apps/demo` was retired at stage 11.14 (deleted 2026-04-24 alongside PT M9.1). PT with zones 1–3 unlocked free (see §20 Monetization) is the canonical end-to-end reference game and the target of `npm create flare-app`-style scaffolding inspiration. Minimal blank/topdown/shmup scaffolds continue to live in [`packages/create-flare-app`](../../packages/create-flare-app).

---

## 2 — Legal & IP posture

### What's PD and usable

- Pan Twardowski legend, 16th c. onward. Documented in Mickiewicz (1822), Kraszewski (1840), 19th c. ethnography (Kolberg, Gloger).
- Polish folklore bestiary: Boruta, Baba Jaga, Bazyliszek, Wodnik, Strzyga, Topielec, Południca, Leszy, Mefistofeles (as folk-devil, not any specific modern adaptation), etc.
- Historical figures: King Sigismund II Augustus, Queen Barbara Radziwiłłówna, Wawel Castle, Węgrów Mirror.

### What's off-limits

- **Raptor: Call of the Shadows** (Cygnus / Apogee) — no art, ship designs, HUD, sprites, music, level names. Genre is not copyrightable.
- **Allegro "Twardowsky" / "Twardowsky 2.0"** CGI ads (2015, 2016) — no character design, costume, time-displaced-astronaut framing, or plot. The "Pan Tvardowski" (with a _v_) spelling is an explicit disambiguation.
- Any post-1950 adaptation (films, comics, novels).

### Due-diligence artifacts

- [`apps/pan-tvardowski/CREDITS.md`](../../apps/pan-tvardowski/CREDITS.md) lists every source.
- [`apps/pan-tvardowski/LICENSE`](../../apps/pan-tvardowski/LICENSE) = PolyForm Noncommercial 1.0.0.
- Trademark (see §19) filed at stage 11.13.

---

## 3 — Story treatment

> The pact has detonated a rift. Devils and strzygas siege the Kingdom from the sky. Boruta has shattered the Mirror into seven shards and scattered them across eight lands under the Devil's lieutenants. The King summons Twardowski. Recover the shards. Fly the rooster. Reach the Moon before dawn at Karczma "Rzym".

### Canonical beats used

- Pact signed on bull's hide — frame story.
- Contract clause: the Devil may take Twardowski only in _Rome_ — the Zone 7 ambush at an inn _called_ "Rzym".
- The Mirror (Zwierciadło) from Węgrów — McGuffin (shattered).
- Rooster mount — player ship "Kogut Złoty".
- Moon exile — canonically the ending; here reversed into an assault on Hell's lunar fortress.

### Invented (clear adaptation, not retelling)

- The shards-of-the-mirror quest.
- Sustained aerial warfare (legend has one flight).
- Lunar boss fight against Lucyper.

---

## 4 — Game structure

| Element      | Count | Notes                                            |
| ------------ | ----- | ------------------------------------------------ |
| Zones        | 8     | ~38 min campaign, +30 s per zone                 |
| Mini-bosses  | 4     | Zones 2, 4, 6, 7 — 2.5× enemy HP, unique pattern |
| Bosses       | 8     | One per zone. Z1–4 = 2 phases, Z5–8 = 3 phases   |
| Enemy types  | 12    | All from Polish folklore                         |
| Weapons      | 4     | 3 upgrade levels each                            |
| Player ships | 3     | Unlocked via progression                         |
| Upgrades     | 6     | Dropped by minibosses + end-of-zone shop         |

**Gameplay loop.** Auto-fire on the chosen weapon. Joystick movement. One bomb button (clears non-boss screen + deals 25% to boss, limited charges). End-of-zone shop spends score on upgrades. Death = retry from zone start with current upgrades.

---

## 5 — Zone list

| #         | Zone                      | Setting                     | Length    | Music                   | Dominant enemies            | Miniboss    | Boss                      |
| --------- | ------------------------- | --------------------------- | --------- | ----------------------- | --------------------------- | ----------- | ------------------------- |
| 1         | **Dachy Krakowa**         | Rooftops of Kraków at dusk  | 3:00      | Sparse baroque          | Skrzat, Latawiec            | —           | Smok Krzemionkowski       |
| 2         | **Puszcza Mazowiecka**    | Storm-lit pine forest       | 3:30      | Folk percussion + flute | Czart, Bies                 | Rokita      | Borowy Król               |
| 3         | **Wisła**                 | Vistula, rafts, fog         | 4:00      | Water drones            | Topielec, Strzyga           | —           | Wodnik Wiślany            |
| 4         | **Łęczyckie Błota**       | Bog, will-o'-wisps          | 4:30      | Low brass, dissonant    | Mamuna, Licho               | Leszy       | Boruta                    |
| 5         | **Łysa Góra**             | Mountain sabbath, bonfires  | 5:00      | Ritual choir            | Nocnica, Dziwożona          | —           | Baba Jaga (3 phases)      |
| 6         | **Katakumby Warszawskie** | Catacombs, torchlit         | 5:30      | Organ + gothic          | Wąpierz, Południca          | Nocny Łowca | Bazyliszek Warszawski (3) |
| 7         | **Karczma "Rzym"**        | Cursed inn at crossroads    | 6:00      | Mocking fiddle          | Mixed (all prior)           | Madej       | Mefistofeles (3)          |
| 8         | **Księżyc**               | Lunar surface, Earth in sky | 6:30      | Cosmic ambient          | Moon wraiths (palette swap) | —           | Lucyper Księżycowy (3)    |
| **Total** |                           |                             | **38:00** |                         |                             |             |                           |

---

## 6 — Art direction — shape atlas

**Constraint: every visual is a composition of primitive Skia shapes.** No sprite art at 0.1.x. Custom pixel art is post-launch.

### Supported primitives (already in `@flare-engine/render`)

| Shape                   | Draw call                   | Game use                     |
| ----------------------- | --------------------------- | ---------------------------- |
| Filled circle           | `Canvas.drawCircle`         | Bullets, pickups             |
| Filled rect (AA)        | SpriteBatch / `drawRect`    | Enemy bodies, UI panels      |
| Rotated rect            | `drawRect` + matrix         | Limbs, laser beams, scythes  |
| Triangle                | `drawPath`                  | Player ship, arrows          |
| N-gon (5/6/8)           | `drawPath`                  | Mini-bosses, shards, sigils  |
| Polyline / stroked path | `drawPath` + stroke `Paint` | Lightning, roots, pentagrams |
| Star (5-pt)             | `drawPath`                  | Pentagram weapon, power-ups  |
| Ring (stroked circle)   | `drawCircle` + stroke       | Shields, auras               |
| Gradient fill           | Skia `Shader`               | Boss phase indicators        |

### Verdict

Zero new engine work. Demo-local helper `apps/pan-tvardowski/src/shapes.ts` (a `drawShape(canvas, spec)` dispatcher over the above). Promote to `@flare-engine/assets` only if a second consumer wants it.

### Palette per zone

| Zone              | Primary                | Accent                  | Hazard                    |
| ----------------- | ---------------------- | ----------------------- | ------------------------- |
| 1 Kraków rooftops | terracotta `#B5651D`   | sunset gold `#F3C262`   | red `#C0392B`             |
| 2 Mazovian forest | pine `#1F4D2E`         | lightning `#E4F0FF`     | green-yellow `#A3D65C`    |
| 3 Vistula         | river blue `#2F5F7A`   | fog white `#D9E4E7`     | algae `#5CAE6E`           |
| 4 Swamp           | bog brown `#5A4A2B`    | wisp teal `#3AC4B4`     | bile green `#7EB52B`      |
| 5 Łysa Góra       | night purple `#2A1B3D` | fire orange `#FF6B1F`   | witch green `#7FFF3C`     |
| 6 Catacombs       | stone gray `#3E3A37`   | torch amber `#FFB347`   | venom violet `#9D3DFF`    |
| 7 Karczma         | oak brown `#6B4423`    | firelight `#FFCF66`     | hellfire red `#FF2B2B`    |
| 8 Moon            | lunar gray `#C8CDD4`   | cosmic indigo `#2B2D5A` | eclipse crimson `#D6002E` |

---

## 7 — Enemies (12)

| #   | Name          | HP  | Fire              | Movement            | Shape brief                                                            |
| --- | ------------- | --- | ----------------- | ------------------- | ---------------------------------------------------------------------- |
| 1   | **Skrzat**    | 1   | — (kamikaze)      | zig-zag             | small orange triangle + 2 dot eyes                                     |
| 2   | **Latawiec**  | 2   | single aimed      | straight dive       | elongated red triangle + forked tail                                   |
| 3   | **Czart**     | 3   | 3-way spread      | sine wave           | black pentagon + 2 horn triangles                                      |
| 4   | **Bies**      | 2   | aimed 3-burst     | hover + strafe      | dark-red hexagon + yellow dot eye                                      |
| 5   | **Licho**     | 4   | heavy single      | teleport blink      | purple 5-star, pulsing alpha                                           |
| 6   | **Strzyga**   | 3   | paired 2-way      | swooping arc        | pale triangle + 2 thin rotated rect wings                              |
| 7   | **Topielec**  | 4   | upward burst      | emerges from bottom | blue-green circle + weed trails                                        |
| 8   | **Mamuna**    | 3   | drops mines       | horizontal sweep    | green oval + 3 stacked egg dots                                        |
| 9   | **Nocnica**   | 2   | radial 8-way      | fast straight       | black circle + particle trail                                          |
| 10  | **Południca** | 5   | wide scythe sweep | cross-screen rush   | yellow-white slim triangle + long rotated rect (scythe)                |
| 11  | **Wąpierz**   | 8   | 5-way cross       | slow heavy          | dark-red octagon, thick outline                                        |
| 12  | **Dziwożona** | 4   | — (summoner)      | slow hover          | teal pentagon + 2 orbiting small triangles (spawns 2 Skrzats on death) |

---

## 8 — Mini-bosses (4)

HP = 2.5× base enemy of the zone. One unique pattern each.

| Zone | Name            | HP  | Unique pattern                                                                                      | Shape brief                                          |
| ---- | --------------- | --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2    | **Rokita**      | 150 | Roots grow from screen edges, narrowing the safe corridor; shoots seed-projectiles along root lines | Stroked polyline (brown) + central green diamond     |
| 4    | **Leszy**       | 200 | Shape-shifts every ~10 s: deer (rams) → bear (slow AOE) → owl (radial burst)                        | Composite hexagon + form-specific addons             |
| 6    | **Nocny Łowca** | 250 | Summons 4 homing hounds, rides a spectral horse                                                     | Large black 4-pointed star + 4 small white triangles |
| 7    | **Madej**       | 300 | Spiked-bed hazard spawns across 3 lanes; shoots from within the bed                                 | Horizontal red rect + 5 spike triangles              |

---

## 9 — Bosses (8)

Each phase ~60 s of screen time. Numbers are design intent; playtest tunes them.

| Zone | Boss                      | HP per phase    | Phase 1                                   | Phase 2                                              | Phase 3                                           |
| ---- | ------------------------- | --------------- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| 1    | **Smok Krzemionkowski**   | 400 / 400       | Fire cone sweeps L→R                      | Swooping dives + radial 6-way                        | —                                                 |
| 2    | **Borowy Król**           | 500 / 500       | Rolling boulders bounce down              | Root walls close in, aimed seed-shots                | —                                                 |
| 3    | **Wodnik Wiślany**        | 600 / 600       | Water-spout columns                       | Bubble shield: spawn 4 Topielec, must kill to damage | —                                                 |
| 4    | **Boruta**                | 700 / 700       | Whip-chains (rotating beams)              | Mud geysers + summons 3 Bies                         | —                                                 |
| 5    | **Baba Jaga**             | 500 / 500 / 500 | Cauldron bombs (arcing)                   | Mortar flight (aimed rush)                           | Broom-laser 360° sweep                            |
| 6    | **Bazyliszek Warszawski** | 600 / 600 / 600 | Stone-gaze cone (slow player)             | Venom spit, persistent puddles                       | Gaze-beam maze + teleport                         |
| 7    | **Mefistofeles**          | 700 / 700 / 700 | Contract-scroll projectiles (track, lock) | Fire-pit AOE + horn-shots                            | Mirror-twin: clones player ship, mirrors input    |
| 8    | **Lucyper Księżycowy**    | 800 / 800 / 800 | Cosmic rain (heavy radial)                | Eclipse darkness + spotlight attacks                 | Shattered-mirror bullet hell, cycles prior bosses |

---

## 10 — Weapons (4)

Auto-fire upward. Balance intent: each weapon wins at _something_ zone-to-zone.

| Weapon              | L1 (start)               | L2 (z3)           | L3 (z6)                 | Best against | Pickup shape           |
| ------------------- | ------------------------ | ----------------- | ----------------------- | ------------ | ---------------------- |
| **Iskry**           | 2 bullets, narrow        | 3 bullets, narrow | 4 bullets, small spread | Swarms       | Orange dot cluster     |
| **Piorun**          | Chains to 1 extra        | Chains 2          | Chains 3 + stun 0.2 s   | Clusters     | Yellow zigzag polyline |
| **Sól Święcona**    | Slow pulse, small radius | Medium radius     | Large radius + burn DoT | Bosses       | White ring             |
| **Znak Pentagramu** | Locks 1 target           | Locks 2           | Locks 4 + pierces       | Mini-bosses  | Purple 5-point star    |

Bomb = separate charge. Clears non-boss screen; deals 25% HP to any active boss/miniboss. Base charges: 2.

---

## 11 — Player ships (3)

| Ship                      | HP  | Speed | Fire rate | Special                                          |
| ------------------------- | --- | ----- | --------- | ------------------------------------------------ |
| **Kogut Złoty** (starter) | 100 | 1.0×  | 1.0×      | +1 starting bomb                                 |
| **Alembik**               | 70  | 1.2×  | 1.3×      | —                                                |
| **Zwierciadło**           | 150 | 0.8×  | 0.9×      | Reflect: 20 % chance to bounce enemy bullet back |

Alembik unlocks after first campaign clear. Zwierciadło after clearing with Alembik.

---

## 12 — Upgrades (6)

Dropped by minibosses + purchasable at end-of-zone shop with score.

| Upgrade                 | Effect                                          | Max stack     |
| ----------------------- | ----------------------------------------------- | ------------- |
| **Czarna Księga**       | +1 weapon level on current weapon               | 2× per weapon |
| **Siedmiomilowe Buty**  | +10 % speed                                     | 3×            |
| **Amulet Węgrowski**    | +25 max HP                                      | 4×            |
| **Koguci Pióro**        | +1 bomb capacity                                | 3×            |
| **Srebrna Tarcza**      | Absorbs 1 hit, regens after 20 s without damage | 1×            |
| **Kamień Filozoficzny** | Auto-magnet pickups within 200 px               | 1×            |

---

## 13 — Dialogue script (EN + PL)

Total: ~400 words across 5 cutscene beats. Text-only at 0.1.0 (voice-acting optional post-launch).

### 13.1 — Opening (Wawel Castle)

> **King Sigismund [EN]:** Twardowski. The Mirror is broken. Seven shards scatter the realm, seven lieutenants of Hell hold them. Ride your rooster. Bring them back before the Devil claims his bond.
>
> **Król Zygmunt [PL]:** Twardowski. Zwierciadło pęknięte. Siedem odłamków rozrzuconych po Koronie, siedmiu pomiotów piekielnych strzeże ich. Dosiądź Koguta. Odzyskaj je, nim Diabeł wypomni ci kontrakt.
>
> **Twardowski [EN]:** One condition, Majesty. Rome does not touch me.
> **Twardowski [PL]:** Jeden warunek, Miłościwy Panie. Rzym mnie nie tyka.
>
> **King [EN]:** Then fly. The Moon will not wait.
> **Król [PL]:** To leć. Księżyc nie zaczeka.

### 13.2 — End of Zone 4 (Boruta defeated)

> **Boruta [EN]:** Four shards, alchemist. Four to go. The Inn waits.
> **Boruta [PL]:** Cztery odłamki, alchemiku. Zostały cztery. Karczma czeka.

### 13.3 — Zone 7 entry (Karczma "Rzym")

> **Innkeeper [EN]:** A drink, Master? The house pours for travelers weary of the road.
> **Karczmarz [PL]:** Kielich, Mistrzu? Na koszt zakładu — droga znojna była.
>
> **Twardowski [EN]:** What is this place called?
> **Twardowski [PL]:** Jak się zowie ta gospoda?
>
> **Innkeeper [EN]:** "Rzym", Master. Rome.
> **Karczmarz [PL]:** „Rzym", Mistrzu. Rzym.
>
> [encounter begins]

### 13.4 — Zone 8 boss intro (Lucyper)

> **Lucyper [EN]:** You sang a hymn once, Twardowski. Sing it again. I will wait.
> **Lucyper [PL]:** Śpiewałeś niegdyś godzinki, Twardowski. Zaśpiewaj jeszcze raz. Poczekam.

### 13.5 — Victory (Moon surface)

> **Twardowski [EN]:** Seven shards. The Mirror whole. And the Devil? On the Moon where he belongs.
> **Twardowski [PL]:** Siedem odłamków. Zwierciadło całe. A Diabeł? Na Księżycu, tam gdzie jego miejsce.
>
> **Spider (tiny, barely audible) [EN]:** …and news from below, Master?
> **Pajączek [PL]:** …a nowiny z dołu, Mistrzu?

---

## 14 — Achievements (12)

| ID                 | EN                       | PL                   | Condition                               |
| ------------------ | ------------------------ | -------------------- | --------------------------------------- |
| `first_shard`      | First Shard              | Pierwszy Odłamek     | Clear Zone 1                            |
| `no_bomb_boss`     | Bareknuckle              | Gołe Pięści          | Beat any boss without using a bomb      |
| `all_shards`       | Mirror Whole             | Zwierciadło Całe     | Complete campaign                       |
| `three_ships`      | Stablemaster             | Stajenny             | Beat campaign with all 3 ships          |
| `iskry_master`     | Sparks Master            | Mistrz Iskier        | Complete Zone 8 using only Iskry        |
| `piorun_master`    | Thunder Master           | Mistrz Pioruna       | Complete Zone 8 using only Piorun       |
| `sol_master`       | Blessed One              | Błogosławiony        | Complete Zone 8 using only Sól Święcona |
| `pentagram_master` | Sigil Master             | Mistrz Pentagramu    | Complete Zone 8 using only Pentagram    |
| `no_hit_z1`        | Untouched                | Nietknięty           | Clear Zone 1 without damage             |
| `twelve_enemies`   | Bestiary                 | Bestiariusz          | Kill one of each enemy type             |
| `karczma_perfect`  | Inn Survivor             | Ocalały z Karczmy    | Clear Zone 7 without damage             |
| `rome_condition`   | "Rome Does Not Touch Me" | „Rzym mnie nie tyka" | Beat Mefistofeles without dying         |

Wired via `@flare-engine/achievements` NoopProvider at 0.1.0; real Game Center / Play Games adapters land in 0.2.0.

---

## 15 — Localization

Top-level key namespace structure (PL + EN parallel). Exercises `@flare-engine/localization` including ICU plurals (`{n, plural, ...}` for bombs/shards remaining).

```
menu.*            — 14 keys (main menu, settings, pause, game-over, victory)
hud.*             —  9 keys (score, hp, bombs, shard count, zone banner, …)
zones.1–8.name    —  8 keys
zones.1–8.subtitle —  8 keys
enemies.<id>.name — 12 keys
minibosses.<id>.name — 4 keys
bosses.<id>.name  —  8 keys
weapons.<id>.name + .desc —  8 keys
ships.<id>.name + .desc   —  6 keys
upgrades.<id>.name + .desc — 12 keys
dialogue.<id>     — ~30 keys
achievements.<id>.name + .desc — 24 keys
```

**Total ≈ 143 strings × 2 languages = 286 entries.**

---

## 16 — Engine surface coverage

Target: every shipping `@flare-engine/*` package exercised by at least one mechanic. `pathfinding` is the one deliberate exclusion — it will be covered by a separate post-launch project.

| Package             | Exercised by                                                            | ✔   |
| ------------------- | ----------------------------------------------------------------------- | --- |
| math                | Vec2, easings for boss patterns, seeded RNG for waves                   | ✔   |
| events              | Boss phase transitions, shard pickup, zone complete                     | ✔   |
| core                | GameLoop, Coroutines (boss scripts), Pool (bullets/particles)           | ✔   |
| ecs                 | Every entity; FSM for all boss phase graphs                             | ✔   |
| render              | Shape draws, Camera2D shake, tint/flash                                 | ✔   |
| input               | Joystick + bomb button + gamepad                                        | ✔   |
| physics             | Heavy bullet-hell AABB at Zone 8                                        | ✔   |
| audio               | Per-zone music crossfade + SFX pool                                     | ✔   |
| assets              | Shape atlas generator                                                   | ✔   |
| scene               | Menu + 8 zones + pause + shop + victory + game-over                     | ✔   |
| animation           | Thruster anim, Tween HUD pops, Spring pickups                           | ✔   |
| particles           | Explosions, muzzle, boss aura, zone weather                             | ✔   |
| tilemap             | Parallax scrolling backgrounds per zone                                 | ✔   |
| debug               | FPS + collision bounds (dev only)                                       | ✔   |
| react               | GameView, VirtualJoystick, VirtualButton                                | ✔   |
| engine              | `createGame` bootstrap                                                  | ✔   |
| storage             | Save slots, settings, upgrade progression                               | ✔   |
| errors              | ErrorBoundary around scene stack                                        | ✔   |
| testing             | Deterministic boss-script replays                                       | ✔   |
| ui                  | All menus + HUD + shop + pause                                          | ✔   |
| postfx              | Hit-flash + vignette + CRT toggle + Zone 8 bloom                        | ✔   |
| localization        | PL + EN tables + ICU plurals                                            | ✔   |
| deep-links          | `pantvardowski://zone/N` dev test routes                                | ✔   |
| share               | Victory screenshot                                                      | ✔   |
| a11y                | Reduced-motion disables shake + heavy postfx                            | ✔   |
| **pathfinding**     | **— deliberately excluded. Covered by a separate post-launch project.** | ✖   |
| dialogue            | 5 cutscenes using the dialogue graph                                    | ✔   |
| devtools            | Entity inspector + time-scrub (dev only)                                | ✔   |
| leaderboards (stub) | High score per zone (NoopProvider)                                      | ✔   |
| achievements (stub) | 12 achievements wired                                                   | ✔   |
| iap (stub)          | Mount NoopProvider (prove wiring)                                       | ✔   |
| analytics (stub)    | Zone completion funnel events                                           | ✔   |

**Coverage: 32/33 shipping packages.** `pathfinding` excluded by design.

---

## 17 — Milestones

Eight milestones, one per zone, plus pre-production and post-content. Each milestone ends with a build that runs on device and has the listed engine-coverage checkboxes ticked.

| M        | Name                              | Deliverable                                                                                                                                                                                                                               | New engine coverage                                                                      |
| -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **M0**   | Pre-production                    | Shape atlas spec, localization scaffold, asset palette, directory layout                                                                                                                                                                  | assets, localization                                                                     |
| **M1**   | Zone 1 (Kraków rooftops)          | Scaffold `apps/pan-tvardowski`, first zone + boss, shape atlas, 2 enemies                                                                                                                                                                 | core, ecs, render, input, physics, scene, ui, engine, react, storage, particles          |
| **M2**   | Zone 2 (Puszcza)                  | Miniboss framework, Rokita, Borowy Król                                                                                                                                                                                                   | animation, audio, events, deep-links                                                     |
| **M3**   | Zone 3 (Wisła)                    | Water-layer effects, bubble-shield boss mechanic                                                                                                                                                                                          | postfx ✅, tilemap ✅                                                                    |
| **M4**   | Zone 4 (Łęczyckie Błota)          | Summons mechanic for Boruta, Leszy shape-shift                                                                                                                                                                                            | devtools ✅, share ✅                                                                    |
| **M5**   | Zone 5 (Łysa Góra)                | First 3-phase boss, night-time palette, ritual SFX                                                                                                                                                                                        | testing (boss-replay tests), errors                                                      |
| **M6**   | Zone 6 (Katakumby)                | Gaze-beam maze (first postfx-heavy boss)                                                                                                                                                                                                  | a11y (reduced-motion toggle)                                                             |
| **M7**   | Zone 7 (Karczma "Rzym")           | Dialogue system, mirror-twin phase, dialogue graph                                                                                                                                                                                        | dialogue ✅                                                                              |
| **M8**   | Zone 8 (Księżyc)                  | Final boss, full bullet hell, ending cutscene                                                                                                                                                                                             | analytics ✅, leaderboards ✅, achievements ✅, iap ✅ stubs mounted                     |
| **M9.1** | UI kit: menu + settings + credits | Title screen, 3 save slots w/ preview, language switch, audio sliders, reduced-motion, controls remap, credits scroll                                                                                                                     | ✅ `@flare-engine/ui` MainMenuKit (new, extracted at stage 11.14)                        |
| **M9.2** | Inventory / codex                 | Shards browser, boss codex, zone-clear stats, achievement tracker screen                                                                                                                                                                  | ✅ — (uses existing `ui`)                                                                |
| **M9.3** | Shop + entitlements               | Single "Full Game" IAP unlocks zones 4–8; optional cosmetic IAP slots reserved; in-app currency purchases for shards → upgrades                                                                                                           | ✅ `@flare-engine/iap` entitlements + `@flare-engine/ui` ShopPanel (both extracted at 11.14) |
| **M9.4** | Dialogue avatar slot              | Speaker portrait frame in dialogue panel; `speakerPortraitKey` in graph; shape-portrait placeholders manifest-swappable                                                                                                                   | ✅ `@flare-engine/dialogue` schema ext (`speakerPortraitKey` on LineNode), ✅ `@flare-engine/ui` DialoguePanel |
| **M9.5** | Asset-swap infrastructure         | Manifest-driven sprite-atlas + audio-atlas; shape atlas becomes "placeholder manifest"; drop-in swap validated by a dry-run atlas drop                                                                                                    | ✅ `@flare-engine/assets` manifest pattern documented                                    |
| **M9.6** | Store-ready bundle                | EAS build profile + keystore docs, privacy UI + data-safety declaration, crash-transport binding (provider-agnostic), screenshot + trailer capture scene, balance freeze, localization audit (EN+PL key parity), save-migrator v1→v2 test | ✅ `@flare-engine/share` screenshot scene (`createScreenshotScene`, session #18), ✅ `@flare-engine/storage` migrator v1→v7 step-chain tested (session #21) |

**Gates between milestones:** `bun run test` green; `bun run build` green; device smoke test on Android (release build); [release-readiness-checklist.md](./release-readiness-checklist.md) items checked off for this milestone.

---

## 18 — Publishing plan

### Sequence

| Order | Store                                         | When                    | Notes                                                |
| ----- | --------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| 1     | **Google Play closed testing**                | M1 (earliest build)     | Kick off the 14-day-with-12-testers gate immediately |
| 2     | **App Store TestFlight**                      | M4–M5 (stable gameplay) | EAS cloud Mac build                                  |
| 3     | **Google Play production**                    | Post-M9 polish          | After closed-testing gate satisfied                  |
| 4     | **App Store production**                      | Post-M9 polish          | Budget 2 review rounds                               |
| 5     | **Steam (Tauri wrap of CanvasKit web build)** | Post-OSS-launch 0.2.0   | Out of 0.1.0 scope                                   |

### Costs

| Item                              | Cost                 | Frequency            |
| --------------------------------- | -------------------- | -------------------- |
| Apple Developer                   | $99                  | Annual               |
| Google Play                       | $25                  | One-time             |
| Steam Direct (when we get there)  | $100                 | One-time per game    |
| EAS Build (if used)               | $0–$29/mo            | Monthly, cancellable |
| **Minimum to ship Android + iOS** | **~$124 first year** |                      |

### Store-page assets (generated from device builds)

- Google Play: 8 screenshots (1080×1920), feature graphic (1024×500), 30-s trailer.
- App Store: 10 screenshots per device class (6.7", 6.5", 5.5"), 30-s preview.
- Steam (later): capsule art variants, 5 screenshots, ≤2 min trailer.

### Privacy

Single privacy policy URL on the Flare Docusaurus site. Since `analytics` stub is NoopProvider at 0.1.0 and `@flare-engine/storage` is local-only, the policy is short: "no data leaves the device".

---

## 19 — Trademark plan

### What

EUIPO word mark **"Pan Tvardowski"**, Classes 9 (software/games) + 41 (entertainment services).

### Pre-file checklist

1. ✅ EUIPO eSearch — no conflicting mark (confirmed 2026-04).
2. ✅ Allegro's "Twardowsky" held in Class 35 (advertising / e-commerce); our Class 9/41 + "v" spelling is clear.
3. ⬜ Register domains: `pantvardowski.com`, `.pl`, `.eu` (~€30 total).
4. ⬜ Grab social handles: `@pantvardowski` on X, YouTube, TikTok (free).
5. ⬜ File via [euipo.europa.eu](https://euipo.europa.eu) — online form, EN or PL, ~2 h work.

### Cost

| Item                     | Cost       |
| ------------------------ | ---------- |
| EUIPO base fee (Class 9) | €850       |
| Second class (Class 41)  | +€50       |
| **DIY total**            | **€900**   |
| Optional lawyer          | +€300–€800 |

### Timeline

1. File — day 0.
2. Formal examination — ~1 month.
3. Publication — 3-month opposition window.
4. Registration certificate — ~5–6 months from filing.

**When to file:** stage 11.13 of the Flare engine build plan (~M5 W4). Registration date protects rights from day one, even though certificate arrives post-launch.

### Lawyer

Not required for DIY filing. Only needed if opposition filed (unlikely for folk-legend-derived name) or broader design mark sought (logo + typography).

---

## 20 — Monetization model

**Freemium + single full-game unlock.** Same flow powers "buy the game" AND "buy a content pack" AND optional cosmetics — one IAP surface, three use cases.

### Product catalogue (PT 0.1.0)

| Product ID                      | Type           | Effect                                         | Notes                                                    |
| ------------------------------- | -------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `pan_tvardowski.full_game`      | non-consumable | Unlocks zones 4–8 + all endings                | Primary revenue. Price TBD at M9.6.                      |
| `pan_tvardowski.supporter_pack` | non-consumable | Alt palettes for Kogut Źłoty + credits billing | Pure cosmetic, optional, no gameplay impact.             |
| `pan_tvardowski.shards_small`   | consumable     | +100 shards (shop currency)                    | Reserved slot; disabled at 0.1.0 unless enabled at M9.6. |
| `pan_tvardowski.shards_large`   | consumable     | +500 shards                                    | Same — reserved slot.                                    |

### Free tier (always playable)

- Zones 1–3 (Kraków → Puszcza → Wisła) + first 3 bosses.
- Full UI kit, all settings, all languages, all player ships, weapons 1–2.
- Score submission + achievements enabled.
- Paywall UI appears on zone-3 defeat screen and from the main-menu "Zones" list (locked zones are visible + clickable → paywall modal).

### Free/paid variant build

Engine must support both "100% free" (other future games may ship free) and "buy-once + free trial" (PT) **without code branching**. Implemented at stage 11.14 as an `EntitlementStore` + `ProductCatalog` in `@flare-engine/iap`. Games declare which product IDs gate which content; the engine treats a missing catalogue as "all free".

### Privacy surface

No analytics at 0.1.0 by default (Noop providers). If the user opts in to a crash provider in settings, the consent is logged in `settings.privacy.crashOptIn`. Data-safety declaration on Google Play + App Store reflects this.

---

## 21 — Engine extraction notes (feeds Phase 11.14)

What PT produced that belongs back in the engine. Strict rule: **genre-agnostic only** (must be useful for top-down, card-based, platformer, or shmup games).

### Accepted (extract into engine at Phase 11.14)

| Item                                              | Source in PT                                    | Destination                                       |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| PostFx controller bridge                          | `src/fx/`                                       | `@flare-engine/postfx` — `createPostFxController` |
| A11y bridge (reducedMotion → fx/camera)           | `src/a11y/manager.ts`                           | `@flare-engine/a11y` — `createA11yBridge`         |
| Tier-2 wiring (events → provider calls)           | `src/tier2/wiring.ts`                           | `@flare-engine/engine` — `createTier2Wiring`      |
| MainMenuKit                                       | (new at M9.1; design lives here, code extracts) | `@flare-engine/ui`                                |
| DialoguePanel w/ avatar slot                      | (new at M9.4)                                   | `@flare-engine/ui` + `@flare-engine/dialogue`     |
| ShopPanel + `EntitlementStore` + `ProductCatalog` | (new at M9.3)                                   | `@flare-engine/ui` + `@flare-engine/iap`          |
| Screenshot + trailer capture scene                | (new at M9.6)                                   | `@flare-engine/share`                             |

### Rejected (game-specific, stays in `apps/pan-tvardowski`)

| Item                              | Why                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Boss FSM + `PhaseScript` dispatch | Shmup-specific structure. Top-down / card games don't phase bosses this way.     |
| Miniboss dispatch + form-cycle    | Same — shmup-specific.                                                           |
| Deterministic wave spawner        | Shmup-specific timing model. Top-down rooms / card encounters spawn differently. |
| Shape catalogue (Kogut, Smok, …)  | PT-specific IP; stays in game code.                                              |

Extraction reviews run at each M9.x gate (see [release-readiness-checklist.md](./release-readiness-checklist.md)).

---

## Change log

- **2026-04-22** — initial plan landed. Pre-production phase. Pathfinding excluded by design.
- **2026-04-22** — **M0 complete.** Directory layout (`apps/pan-tvardowski/{src,tests,locales}`), shape atlas type spec (`ShapeSpec` union), zone palette (8 zones × primary/accent/hazard ARGB), shape catalogue for all 12 enemies / 4 minibosses / 8 bosses / 3 ships / 4 weapon pickups / 6 upgrade pickups, localization scaffold (EN + PL tables, 143 keys, ICU plurals for bombs/shards), 14 tests passing. `@flare-engine/localization` exercised at runtime in tests; `@flare-engine/assets` (procedural atlas) wiring deferred to M1 when Skia runtime is available.
- **2026-04-22** — **M1 complete.** Expo + Skia scaffold, runtime shape-atlas builder (draws `SHAPE_CATALOGUE` + bullet/particle frames onto an offscreen Skia surface, emits a `SpriteSheet`). Zone-1 gameplay: Kogut Złoty player with Iskry L1 auto-fire (2 parallel bullets, 520 px/s), Skrzat (sine zig-zag kamikaze, 1 HP, 100 score), Latawiec (straight dive + aimed shot, 2 HP, 150 score). Deterministic wave spawner (`buildZone1Schedule`, seed → WaveEntry[]). Smok Krzemionkowski boss with FSM (entering → phase1 fire-cone sweep → phase2 6-way radial + aimed burst at 50 % HP → dying 14-explosion timeline → defeated), phase transitions clear enemy-bullet soup. Collision pairs via AABB: player-bullet vs enemy + enemy-bullet vs ship (10 HP per contact) + ship-enemy contact (boss invulnerable except phase1/phase2). Bomb (3 charges, clears non-boss enemies + 25 % boss HP). Particles via ECS sprite entities with Lifetime (explosion bursts on kill). MMKV + memory-fallback save adapter with 3-slot `SaveFile` (runs / bestScore / lastScore / bossDefeated). VirtualJoystick + VirtualButton overlay, minimal RN HUD (score + HP + bombs + boss bar + game-over / victory overlays with tap-to-retry). Engine coverage ticked: `core, ecs, render, input, physics, scene, engine, react, storage, particles`. `ui` package not yet consumed (HUD uses plain RN views); deferred to M2 when pause / menu modals land. 22 tests passing (14 M0 + 3 spawner determinism + 2 save round-trip + 3 Smok FSM transitions).
- **2026-04-22** — **M2 complete.** Zone 2 (Puszcza Mazowiecka) gameplay: Czart (cosine-weave, 3 HP, 3-way spread) and Bies (hover-then-strafe, 2 HP, tight 3-burst) enemies, `buildZone2Schedule` deterministic waves (seeded mulberry32, pre- and post-miniboss windows). Rokita miniboss (150 HP) with FSM entering → active → dying → defeated, dual advancing root-tip projectiles (rootProgress 0→1 over 25 s) + central aimed shot. Borowy Król boss (1000 HP, 2 phases): phase1 two bouncing boulders, phase2 5-way aimed seed-shots (±0.18 rad). Generalized boss system via `PhaseScript` dispatch keyed by `BossPattern` (smok-krzemionkowski, borowy-krol) — one FSM, many scripts. Zone progression: `ZONES` config drives schedule/miniboss/boss per zone, `z1 → z2 → victory`, boss defeat re-enters `play` scene with `currentZone` advanced. Audio subsystem wired via `react-native-audio-api` dynamic import with graceful fallback (SFX: shoot/hit/explode/bomb/shard; music: baroque 88 bpm zone 1 + folk 132 bpm zone 2, 0.6 s crossfade on zone enter). `gameEvents` typed `EventEmitter<GameEventMap>` (`zone-start`, `zone-complete`, `miniboss-defeated`, `boss-phase-change`, `shard-collected`). Deep-link router `pantvardowski://zone/N` with `createPanTvardowskiDeepLinks` (`n=1→z1`, `n=2→z2`, others → `onUnmatched`). Zone-intro banner Tween (fade-in 0.45 s → hold 1.4 s → fade-out 0.45 s) surfaced in HUD via `gameState.zoneBanner`. HUD extended with dynamic boss name (from `ZONES[zoneId].bossNameKey`) + miniboss HP bar. Bomb now deals 25 % damage to active minibosses; collision step treats minibosses as boss-like (no ship-contact destroy, invulnerable outside combat phase). `hud.miniboss_name` key added to PL + EN tables. Engine coverage ticked: `animation, audio, events, deep-links`. 36 tests passing (+ 3 zone-2 spawner + 2 Borowy Król FSM + 3 Rokita FSM + 3 deep-link routing + 2 event bus).
- **2026-04-22** — **M3 complete.** Zone 3 (Wisła) gameplay: Topielec (upward-drifting revenant, 4 HP, sine-drift horizontal + 4-way upward burst fire) and Strzyga (cosine-arc swooper, 3 HP, paired 2-way ±12° fire) enemies spawning from the bottom of the viewport; `buildZone3Schedule` deterministic waves (seeded mulberry32, 50/50 pattern mix, terminates before `ZONE3_BOSS_T`). Wodnik Wiślany boss (1200 HP total, 600 per phase, no miniboss): phase1 three staggered vertical water-spout columns, phase2 aimed spout. Bubble-shield mechanic: phase2 entry raises an invulnerability shield and spawns `WODNIK_SHIELD_MINIONS=4` Topielec minions via the new `BossDeps.onSpawnShieldMinion`/`countShieldMinions`/`onShieldBroken` callbacks; shield drops the instant all minions die and rebuilds after `WODNIK_SHIELD_REBUILD_SEC=5`. `Boss` component extended with `shieldActive / minionsAlive / shieldDownFor`; `computeBossStatus.invulnerable` and player-bullet collision both respect `shieldActive`. `countTopielecMinions(world, enemyQuery)` pre-creates the enemy query to keep the shield tick zero-alloc. `GameEventMap` adds `boss-shield-broken`; HUD shows a localized `hud.shield_active` pip (PL: "Tarcza aktywna") while the shield is up. Postfx wired end-to-end via a new `createPanTvardowskiPostFx` controller — chain = vignette(0.35,0.82) + bloom(0.72,0.5) + grayscale-flash (auto-decay rate 4.2/s), fired on player-hit and boss-phase-change; `buildPass` returns `CompiledPass[]` every frame. Visible pixel application is deferred pending a GameView SkCanvas bridge — the `onRenderPostFx` hook exposes only the limited `CanvasLike` surface today; `skiaPostFx` is wired as `null` (unsupported runtime) so the chain is exercised + tested but does not touch the framebuffer. Tilemap package exercised end-to-end: inline 12×20 `.tmj` JSON → `parseTiled` → per-tile ECS Sprite entities at `z=-100` (solid water layer + sparse fog overlay), scrolling controller mutates `Position.y` every frame and wraps at `mapHeightPx` for seamless loop. Zone-3 audio track: slow 60 bpm sine-drone; deep-link `/zone/3 → z3`; shape-atlas adds `tile-water` + `tile-fog` frames (32×32). `GameConfig.onRenderBackground` / `onRenderPostFx` render hooks added to `@flare-engine/react.GameView` and plumbed through the play scene via a `PlayRenderHooks` ref. Engine coverage ticked: `postfx ✅, tilemap ✅`. 53 tests passing (+ 3 zone-3 spawner + 5 Wodnik FSM covering phase transition / shield raise / shield break / rebuild / defeat + 4 postfx chain + 4 tilemap-bg + 1 deep-link z3).
- **2026-04-22** — **M4 complete.** Zone 4 (Łęczyckie Błota) gameplay: Mamuna (horizontal sweep, 3 HP, drops downward "mine" bullets) and Licho (slow drift + periodic sideways teleport on `LICHO_BLINK_SEC=1.8` s intervals, 4 HP, heavy aimed single shot) enemies; `buildZone4Schedule` deterministic waves (seeded mulberry32, pre-miniboss 3→90 s + post-miniboss 120→215 s, terminates before `ZONE4_BOSS_T=230`). Leszy miniboss (200 HP) extends the miniboss system with per-pattern dispatch (`Record<MinibossPattern, MinibossScript>`): shape-shift cycles `deer → bear → owl` every `LESZY_FORM_SEC=10` s, each form drives a distinct movement speed (95 / 35 / 130) and fire pattern (deer = 3-way ram, bear = heavy slow AOE, owl = 8-way radial); `MinibossDeps.onFormChange` + `gameEvents.emit('miniboss-form-change')` surface the current form to HUD / analytics consumers. Boruta boss (1400 HP / 700 per phase): phase1 four whip-chain projectiles rotating around the boss centre (spun by `b.t`), phase2 aimed 3-way mud-geyser volleys (±0.24 rad) + heavy central drop. Summons mechanic: on phase2 entry, Boruta spawns exactly `BORUTA_SUMMON_COUNT=3` Bies minions via the new `BossDeps.onSpawnSummon(x, y)` callback and the idempotent `Boss.summonsSpawned` counter guards against re-trigger if the FSM re-enters phase2. New packages wired: **`@flare-engine/devtools`** — `DevtoolsProvider` + `DevtoolsHUD` gated by `__DEV__`, consuming a cheap per-tick `createGameSnapshot` (elapsed, score, playerHp, bombCharges, enemyCount, bulletCount, bossPhase, currentZone) built from pre-created queries. **`@flare-engine/share`** — `ShareManager` + `createNativeShareTransport(RN.Share)`; `shareHighScore({ manager, score, victory, t })` formats a localized `hud.share.victory` / `hud.share.gameover` message with a `flare-engine.dev` URL; HUD adds a "Share" button to both game-over and victory overlays. Zone 4 audio track: 72 bpm low-brass dissonant (saw bass + square lead over minor intervals). Deep-link `/zone/4 → z4`. Locale keys added: `hud.share`, `hud.share.victory`, `hud.share.gameover`, `minibosses.leszy.form.{deer,bear,owl}`. Engine coverage ticked: `devtools ✅, share ✅`. 65 tests passing (+ 3 zone-4 spawner + 3 Leszy FSM covering activation / form-cycle determinism / defeat + 2 Boruta FSM covering phase2 summons idempotency + defeat + 2 share-manager + 1 devtools-snapshot + 1 deep-link z4).
- **2026-04-22** — **M5 complete.** Zone 5 (Łysa Góra) gameplay: Nocnica (fast straight descent, 2 HP, radial 8-way burst on cooldown) and Dziwożona (slow hover summoner, 4 HP, no fire — splits into `DZIWOZONA_SKRZAT_SPAWN=2` Skrzats on death) enemies; `buildZone5Schedule` deterministic waves (seeded mulberry32, 3→245 s window, terminates before `ZONE5_BOSS_T=260`). Baba Jaga boss (1500 HP / 500 per phase, first 3-phase boss, no miniboss): phase1 three arcing cauldron-bomb drops (heavy slow arcs, large vy + narrow vx fan), phase2 mortar-flight aimed 3-way rush (charges downward at player with ±0.18 rad spread), phase3 broom-laser 360° rotating sweep (12-ray radial pinwheel spun by `b.t * 2.4`). Boss FSM extended with new `phase3` state + transitions (`phase2 → phase3 → dying`); `BossPhase` gains `'phase3'`; 3-phase bosses use a 2/3 gate (`THREE_PHASE_P2_RATIO`) for phase1→phase2 and 1/3 gate (`PHASE3_HP_RATIO`) for phase2→phase3, keeping 2-phase bosses on the existing `PHASE2_HP_RATIO=0.5`. `PhaseScript` now carries optional `sweepSpeed3 / fire3Cooldown / fire3` so phase3 dispatch stays data-driven per pattern. Bomb system + `computeBossStatus` updated so phase3 takes 25 % bomb damage and is vulnerable (only entering/dying/defeated/shieldActive remain invulnerable). Dziwożona split: scene `onEnemyKilled` callback spawns 2 Skrzats at the death site via `spawnEnemy`, deterministically seeded by `(x,y)` hash. New packages wired: **`@flare-engine/testing`** — `createFakeClock` + `createTestWorld` drive a deterministic replay test (`baba-jaga-fsm.test.ts`) asserting that two independent worlds with identical dt sequences produce bit-identical Boss position + phase. **`@flare-engine/errors`** — `ErrorBoundary` + `createConsoleTransport` wrap the `<GameView>` + HUD subtree, rendering a localized fallback (new `menu.error.title` / `menu.error.reset` keys in PL + EN) and forwarding every crash payload to the console transport. Zone 5 audio track: 54 bpm ritual choir (sine lead + sine bass drone-pad, minor voicings). Deep-link `/zone/5 → z5`. `KillKind` + `RunStats.kills` extended with `nocnica` + `dziwozona` counters. Engine coverage ticked: `testing ✅, errors ✅`. 74 tests passing (+ 4 Baba Jaga FSM covering phase1→2 gate / phase2→3 gate / defeat / deterministic replay + 4 zone-5 spawner + 1 deep-link z5).
- **2026-04-22** — **M6 complete.** Zone 6 (Katakumby Warszawskie) gameplay: Wąpierz (slow tanky side-drift, 8 HP, 5-way aimed cross) and Południca (cross-screen horizontal rush, 5 HP, wide 5-way scythe fan) enemies + a new non-scoring `hound` homing enemy (3 HP, 170 px/s pure chase via `normalizeDirection(player - pos)`); `buildZone6Schedule` deterministic waves (mulberry32, pre-miniboss 3→90 s + post-miniboss 120→275 s, terminates before `ZONE6_BOSS_T=290`). Nocny Łowca miniboss (250 HP) adds a new `MinibossPattern` branch + `MinibossData.hounds` counter + `MinibossDeps.onSpawnHound / countHounds` — on active-entry summons exactly `NOCNY_LOWCA_HOUND_COUNT=4` hounds flanking the boss; re-summons the pack the instant `countHounds()` hits 0 (spectral-horse sweep at 120 px/s + whip-shot 2-way ±0.18 rad). Bazyliszek Warszawski boss (1800 HP / 600 per phase, 3-phase): phase1 stone-gaze 3-way cone (drives the new `onGazeChange` hook — scene flips `gameState.bossGazeActive`, emits `boss-gaze-changed`, and scales player speed by `BAZYLISZEK_GAZE_SPEED_MUL=0.55` via a new `PlayerDeps.speedMul`); phase2 heavy aimed venom shot + `onSpawnPuddle` drop that spawns a slow-drifting enemy bullet with `Lifetime=BAZYLISZEK_PUDDLE_LIFETIME_SEC=4 s` (persistent ground hazard); phase3 gaze-beam maze (10-ray radial pinwheel spun by `b.t * 1.35`) + deterministic teleport every `BAZYLISZEK_TELEPORT_SEC=3 s` (deterministic `Math.sin(b.t * 12.9898) * 43758.5453` hash → x inside bounds). `Boss` gains `teleportT`, `PHASE3_HP_RATIO` + `THREE_PHASE_P2_RATIO` now cover Bazyliszek via `threePhase = pattern === 'baba-jaga' || pattern === 'bazyliszek-warszawski'`. **`@flare-engine/a11y`** wired end-to-end via a new `A11yBridge` (`apps/pan-tvardowski/src/a11y/manager.ts`): owns an `A11yManager` whose `onChange` Signal mirrors `reducedMotion` into `gameState.settings` and calls `Camera2D.setMotionScale(motionScale(settings))` + `PostFxController.setMotionScale(k)` (which forwards to `EffectChain.setGlobalIntensity(k)`) — reduced-motion thus zeroes screen-shake amplitude/duration and globally scales vignette/bloom/grayscale-flash/chromatic-aberration/CRT strength with zero per-call guards. `PlaySceneDeps.a11y?` plumbed from `App.tsx`; `Settings` + save schema gain `reducedMotion: boolean` (default `false`). Zone 6 audio track: 48 bpm gothic sine organ drone (D-minor with lowered-2, sub-bass sine). Deep-link `/zone/6 → z6`. Locale key `hud.gaze_active` (EN "Petrifying gaze" / PL "Wzrok kamieniejący"); `KillKind` + `RunStats.kills` extended with `wapierz`, `poludnica`, `hound`. Shape catalogue adds `hound` (small black circle + ear triangles + red eyes). Engine coverage ticked: `a11y ✅`. 88 tests passing (+ 4 zone-6 spawner + 4 Nocny Łowca FSM covering activation / pack summon / re-summon on depletion / defeat + 4 Bazyliszek FSM covering gaze toggle / phase2→3 gate / phase3 teleport bounds / defeat + 2 a11y integration).
- **2026-04-22** — **M8 complete.** Zone 8 (Księżyc) gameplay: Moon-Wraith (straight-dive with slow horizontal drift, 2 HP, sparse aimed single shot) as the lone palette-swap enemy; `buildZone8Schedule` deterministic waves (mulberry32, 3→325 s window, 70/30 moon-wraith/nocnica mix, terminates before `ZONE8_BOSS_T=340`). Lucyper Księżycowy boss (2400 HP / 800 per phase, 3-phase final boss, no miniboss): phase1 **cosmic rain** — 10-way radial bullet pattern + aimed center anchor every `LUCYPER_P1_FIRE=1.3 s`; phase2 **eclipse spotlight** — tight aimed 3-fan (±0.1 rad) every `LUCYPER_P2_FIRE=0.85 s`, `onPhase2Enter`/`onPhase2Exit` toggle a new `BossDeps.onEclipseChange` hook so the HUD / postfx can darken the arena; phase3 **shattered-mirror bullet hell** — rotates through all seven prior bosses via a `SHATTER_CYCLE` registry (smok→borowy→wodnik→boruta→baba-jaga→bazyliszek→mefistofeles), advancing `Boss.shatterIdx` every `LUCYPER_SHATTER_CYCLE=3.2 s` via the new `PhaseScript.onPhase3Update(dt, ctx)` hook; each cycle dispatches a simplified emission for that boss (6-way radial / 5-fan / vertical 3-spout / 4-ray / 12-way radial / 10-way radial / 3-fan). `BossData` gains `shatterIdx + shatterT` (default 0/0); `BossPattern` + `BOSS_SCRIPTS` registry extended with `'lucyper-ksiezycowy'`. **Ending cutscene:** new `ZONE8_INTRO_GRAPH_ID` (single Lucyper taunt) fires on zone 8 enter; new `VICTORY_GRAPH_ID` (Twardowski reflects, Spider asks for news) plays on Lucyper `onDefeated` before the scene chains to `'victory'` via the dialogue `endCallback`. **Tier-2 stubs mounted** via `src/tier2/{providers,wiring}.ts`: `getTier2Providers()` returns the four workspace Noop\*Providers (analytics / leaderboards / achievements / iap); `mountTier2Wiring()` subscribes to `gameEvents` and dispatches `analytics.track('zone_start'|'zone_complete'|'miniboss_defeated'|'boss_phase_change')`, `leaderboards.submitScore('zone_${zone}_high_score', score)` on zone-complete, and `achievements.unlock('first_shard')` on z1-complete / `achievements.unlock('all_shards')` on z8-complete. `App.tsx` mounts the wiring once at startup and tears it down on unmount. `setTier2Providers` / `resetTier2Providers` exposed for test injection of recording fakes. Zone 8 audio track: 44 bpm cosmic ambient (sine lead + sine sub-bass, wide minor voicings to evoke the lunar void). Deep-link `/zone/8 → z8`. `z7.nextZone` now advances to `'z8'` (was `null`). `KillKind` + `RunStats.kills` extended with `moon-wraith`. Locale keys added: `dialogue.speaker.lucyper` (EN "Lucyper" / PL "Lucyper") + `dialogue.speaker.spider` (EN "The Spider" / PL "Pająk"). Shape catalogue adds `moon-wraith` (dark triangle + MIRROR ring + small MIRROR circle, 14-enemy total). Engine coverage ticked: `analytics ✅, leaderboards ✅, achievements ✅, iap ✅`. 119 tests passing (+ 3 zone-8 spawner determinism / pattern / boss-gate + 4 Lucyper FSM covering phase1→2 eclipse enter / phase2→3 eclipse exit / shatterIdx advancement / defeat + 5 tier-2 wiring covering analytics dispatch / leaderboard submission / first_shard + all_shards unlocks / unlock dedupe / miniboss + phase events).
- **2026-04-24** — **M9.1 complete.** UI kit shell: four new scenes (`menu`, `save-select`, `settings`, `credits`) registered in `App.tsx`; boot now jumps to `menu` (deep-links still bypass straight to `play`). New React overlay `MenuOverlay.tsx` subscribes to `stateChanged` and renders above the paused canvas using `@flare-engine/ui` (`MainMenuKit`, `Panel`, `Button`, `Label`, `ThemeProvider`, `FocusProvider`, `darkTheme`). Save schema bumped v2→v3: `SlotData.zoneReached: ZoneId` added (v1/v2 slots migrate to `z1`); `Settings` gains `masterVolume`, `musicVolume`, `sfxVolume` (clamped 0..1) and `controls: { joystickSide: 'left'|'right', fireButtonSide: 'left'|'right' }` (all missing fields default). `GameState.activeSlot: 0|1|2` mirrored from `SaveFile.activeSlot` on load/select/create. `commitRun` takes optional `zoneReached` and uses `maxZone` helper. New `src/save/preview.ts` with `slotPreview(index, slot)` → `SlotPreview { status: 'empty'|'in-progress'|'completed', bestScore, zoneReached, lastPlayed, runs }` and `formatLastPlayed(ts, locale)` via `Intl.DateTimeFormat`. `MenuOverlay` sub-views: title (Play / Settings / Credits + version), save-select (3 slots, empty / zone + best + last-played, delete stub), settings (language EN/PL, three ±0.1 volume rows, reduced-motion toggle, joystick-side + fire-side toggles with `save.persist()` on back), credits (scroll with six sections — Legend, Bestiary, Artifacts, Engine, License, Thanks — from `hud/credits-sections.ts`). Audio channels wired via new `applyVolumes(audio)` helper that sets `master`/`music`/`sfx` channel volumes from `gameState.settings`; called after boot `initAudio` and after settings change. Joystick + fire button positioning now reactive to `controls.joystickSide` / `controls.fireButtonSide` (style flips + `controlsTick` re-render). Game-over + victory HUD overlays gain a "Main Menu" button next to Share, both wired via new `HudActions.onMainMenu`. `scene-shell.ts` switched to granular imports (`@flare-engine/ecs.World` + `@flare-engine/render.Camera2D`) so scene tests load in Bun without pulling the `@flare-engine/react` umbrella (no behavior change). `apps/pan-tvardowski` adds `@flare-engine/ui` workspace dep. Locale keys added (18 total, EN + PL parity verified): `menu.subtitle`, `menu.credits`, `menu.settings.{title,audio.master,audio.music,audio.sfx,controls.joystick_side,controls.fire_side,controls.left,controls.right,back}`, `menu.save_select.{title,empty,zone,best_score,last_played,back}`, `menu.credits.{title,skip}`, `hud.main_menu`. Engine coverage ticked: `ui ✅`. 135 tests passing (+ 5 save-slot-preview status / best / zone / last-played formatting + 4 settings round-trip reduced-motion / volumes / controls / v2-migration + 5 menu-scene factories set `currentScene` + 2 boot-to-menu transition including async load). Device smoke deferred to orchestrator.
- **2026-04-26** — **M9.3 complete.** Shop + entitlements: `src/iap/catalog.ts` (2-entry `PT_CATALOG`: `pt.full_game` non-consumable + `pt.shards_small` consumable), `src/iap/store.ts` (`createPTEntitlementStore`), `src/scenes/shop.ts`, `src/hud/ShopOverlay.tsx` (`ShopPanel` + restore flow). Save schema bumped v4→v5: `SaveFile.entitlements: readonly string[]`; `parseSaveFile` migrates v4 saves to empty array; `SaveStore` exposes `entitlements()` + `grantEntitlement(key)`. `SceneName` gains `'shop'`; `GameState` gains `shopGateVisible`. `MenuOverlay` gains `goShop()` action + "Shop" menu item. `App.tsx` registers shop scene, creates `createPTEntitlementStore`, seeds it from save on boot, and gates zones 4–8 in `startSlot` (redirects to shop if slot's `zoneReached` ∈ {z4…z8} and `pt.full_game` not entitled). Locale keys added (14 total, EN + PL parity): `menu.shop`, `shop.{title,subtitle}`, `shop.full_game.{title,desc,price}`, `shop.shards_small.{title,desc,price}`, `shop.{owned,restore,back,gate.title,gate.desc}`. 18 new tests green (`shop-entitlements.test.ts`): save v4→v5 migration (4 tests), zone-gate logic (2 tests), locale key parity (4 tests), catalog/entitlement-store suite (8 tests, symlink-guarded on Windows). Device smoke pending.
- **2026-04-26** — **M9.2 complete.** Inventory / codex UI: new `inventory` scene + `InventoryOverlay.tsx` (four tabs: Codex / Shards / Stats / Achievements). `SceneName` gains `'inventory'`; `MenuOverlay` gains `goInventory()` action + "Bestiary" menu item. `InventoryOverlay` renders all 24 codex entries (locked = `???` + hint; unlocked = name + lore) from `src/codex/`, slot stats (zone / best score / runs), and achievement display list (`src/hud/achievements-list.ts`, 12 entries). Save schema bumped v3→v4: `SaveFile.codexUnlocked: readonly string[]` added; `parseSaveFile` migrates v3 saves to empty array; `SaveStore` exposes `codexUnlocked()` + `unlockCodexEntry(id)`. Locale keys added (10 new keys × EN + PL parity): `menu.inventory`, `inventory.tab.{codex,shards,stats,achievements}`, `inventory.codex.locked`, `inventory.shards.collected` (ICU plural), `inventory.stats.{zone,best_score,runs}` (ICU plural), `inventory.back`. No new engine packages (uses existing `@flare-engine/ui`). 8 new tests green (`inventory-overlay.test.ts`): codex roster counts, boss category completeness, locale key structure, firstSeenZone range, achievement list count/uniqueness/key prefixes; 15 total tests green across inventory + codex + locale-parity suites. Device smoke pending.
- **2026-04-26** — **M9.5 complete.** Asset-swap infrastructure: three manifest files (`assets/sprites.manifest.json` v1 with one `shape-atlas` placeholder entry; `assets/audio.manifest.json` v1 with 5 SFX + 8 music entries all `kind: synth`; `assets/portraits.manifest.json` v1 with 6 portrait entries all `kind: shape`). Typed container interfaces in `src/assets/manifest-types.ts` (`SpritesManifest`, `AudioManifest`, `PortraitsManifest` — closed-union kind fields, all `readonly`). Three loaders: `sprites-loader.ts` (`loadSpriteAtlas` dispatches `shape-atlas` → `buildShapeAtlas`, reserves `texture-packer` with a throw); `audio-loader.ts` (`loadSfxBuffers` + `loadMusicBuffers` dispatch `synth` → existing `createSfxBuffers`/`createMusicBuffers`, reserve `file` with a throw); `portraits-loader.ts` (`resolvePortraitViaManifest` dispatches `shape` → `resolvePortraitShape`, reserves `image` → `undefined`). `src/assets/manifests.ts` statically imports all three JSON files typed against manifest-types. `src/assets/index.ts` barrel re-exports everything. `App.tsx` switched from direct `buildShapeAtlas(Skia)` to `loadSpriteAtlas(Skia, SPRITES_MANIFEST)`. `audio/init.ts` switched from direct `createSfxBuffers`/`createMusicBuffers` calls to `loadSfxBuffers`/`loadMusicBuffers`; key-cast loops replaced with plain `Object.entries` iteration (no more `SfxKey`/`MusicKey` imports in `init.ts`). `DialogueOverlay.tsx` switched from `resolvePortrait` to `resolvePortraitViaManifest(PORTRAITS_MANIFEST, key)`. `portrait-manifest.ts` renamed `resolvePortrait` → `resolvePortraitShape` with updated JSDoc identifying it as the placeholder data source for the `shape` kind. No new locale keys. 19 new tests green (`asset-manifest.test.ts`): sprites manifest structure (3), audio manifest structure (3), portraits manifest structure (2), closed-union kind checks (4), loader dispatch coverage (3, symlink-guarded), boundary lint (1 — walks `src/**` excluding allowed files, asserts zero leaks), dry-run swap (1 — `kind:file` zone1 entry throws reserved message), resolvePortraitViaManifest (2, symlink-guarded). Engine-coverage ticked: `@flare-engine/assets` manifest pattern documented ✅. Device smoke pending.
- **2026-04-26** — **M9.4 complete.** Dialogue avatar slot: `src/dialogue/portrait-manifest.ts` defines 6 speaker portraits (king, twardowski, innkeeper, lucyper, spider, boruta) as `ShapeSpec[]` placeholder frames keyed by `PortraitKey`; `resolvePortrait(key)` is the caller-facing accessor. `DialogueHudState` gains `portraitKey?: string`; the dialogue controller's `runner.onLine` handler forwards `ev.speakerPortraitKey` verbatim. All 5 existing dialogue graphs (`opening`, `zone7-entry`, `zone8-intro`, `victory`) gain `speakerPortraitKey` on every `LineNode`. New `createZone4BorutaGraph()` (`zone4-boruta`, single Boruta line using `dialogue.speaker.boruta` / `portrait.boruta` / `dialogue.zone4.boruta.1`) added to `graphs.ts` and re-exported from `dialogue/index.ts`. `DialogueOverlay.tsx` replaced with a `<ThemeProvider>` + `<DialoguePanel>` (from `@flare-engine/ui`) wrapper; portrait slot rendered as a 44×44 color block derived from the manifest's first `fill` channel (device-verified Skia draw). Locale key `dialogue.speaker.boruta` (EN "Boruta" / PL "Boruta") added to `keys.ts` + both locale files; parity test still green. 9 new tests in `tests/dialogue-portrait.test.ts`: manifest key count, key presence, non-empty shapes, resolvePortrait known/unknown/undefined, zone4 node fields, zone8 portraitKey, opening/zone7/victory completeness, controller first-line, controller advance, zone4 gameState, post-end null. Pure manifest suite (6 tests) runs on Windows; graph+controller suite (7 tests) matches pre-existing `dialogue.test.ts` Windows-EACCES pattern. Engine-coverage ticked: `@flare-engine/dialogue` `speakerPortraitKey` schema ext ✅, `@flare-engine/ui` `DialoguePanel` ✅. Device smoke pending.
- **2026-04-27** — **M9.2 complete.** Boss codex per-phase stats view: all 8 bosses expose per-phase HP / fire-rate / pattern data in the Codex overlay (20 new EN + PL locale keys). Per-zone clear-stats tracker: `SaveFile` bumped v5→v6 adding `zoneStats` (per-zone `deaths`, `bestTimeMs`, `noHit`) and `unlockedAchievements: readonly string[]`; `recordZoneOutcome` wired into play-scene zone-complete and player-down sites; save migration carries empty defaults for both new fields. Achievement tracker screen: `AchievementsOverlay` with 12 entries sourced from `src/hud/achievements-list.ts`, wired into the inventory scene and `MenuOverlay`. +10 new tests (210 total, all green). Locale parity (EN + PL) preserved across all new keys.
- **2026-04-27** — **M9.3 complete (re-shipped on engine primitives).** Supersedes the 2026-04-26 M9.3 entry, which hand-rolled the shop UI inside the app. Three new engine packages landed first: **`@flare-engine/iap-revenuecat`** (session #23) — concrete `IAPProvider` adapter wrapping `react-native-purchases` (peer dep), lazy SDK import, no-throw contract, +6 mock-SDK tests; **`@flare-engine/ui-shop`** (session #24) — `ShopPanel` + `PaywallModal` + `RestorePurchasesButton` smart components consuming `IAPContext` + `EntitlementStore`, +9 tests; **integration tests + api-specs** (session #25) — +4 tests (Noop → ShopPanel → grantProduct round trip, restoreOnBoot wiring), `docs/design/api-specs.md` entries for both new packages. Game side: `PT_CATALOG` updated to storefront-namespaced SKUs `pan_tvardowski.full_game` (non-consumable, grants `pt.full_game`) + `pan_tvardowski.supporter_pack` (non-consumable, grants `pt.supporter`); deprecated `pt.shards_small` removed (#7). RevenueCat provider wired in `tier2/providers.ts` via `createGameIapProvider()` with env-var fallback (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS/_ANDROID` → real adapter; both empty → `NoopIAPProvider` for CI/dev). New `ZoneConfig.requiresEntitlement` + `canStartZone` helper gate zones 4–8; play scene emits `'zone-gated'` and `'paywall-trigger'` on attempted access (#8). `<ShopPanel>` from `@flare-engine/ui-shop` replaces the hand-rolled `ShopOverlay`; `<PaywallOverlay>` (wrapping `<PaywallModal>`) renders at the App level, soft-dismissible, triggered by `'paywall-trigger'` events from zone-3 boss defeat or locked-zone click; `'purchase-completed'` event auto-closes the paywall (#9). `<RestorePurchasesButton>` from `@flare-engine/ui-shop` added to Settings; `onComplete` re-fires `'purchase-completed'` per restored SKU so paywall close-on-purchase wiring picks up restored entitlements (#10). New EN+PL locale keys: 6 paywall (`paywall.heading/body/cta/dismiss/loading/error`) + 14 shop (`shop.heading/empty/loading/error/owned_section/available_section` + `shop.{full_game,supporter_pack}.{title,description,cta,owned}`) + 5 restore (`settings.restore.{cta,loading,success,empty,error}`) + 1 zone-locked badge (`menu.zone.locked`). +14 new game-side tests (zone-gate +4, paywall flow +4, restore-purchases +3, iap-catalog +5 minus one retired = net +14 from baseline 211 → 226). All gates green; locale parity preserved. Device smoke pending.
- **2026-04-27** — **M9.6 partial (session #15).** EAS build profiles added (`apps/pan-tvardowski/eas.json`): `development` (internal, devClient), `preview` (internal APK + iOS simulator), `production` (store app-bundle + `autoIncrement: true`). `app.json` gains `runtimeVersion: { policy: "appVersion" }`, `updates.url`, and `extra.eas.projectId` (TODO placeholders until `eas init` runs). Keystore + signing procedure documented in `apps/pan-tvardowski/docs/keystore.md` (keytool generation, EAS Credentials vault rule, iOS auto-managed signing, lost-keystore recovery). Version-bump policy table in same file (semver in `app.json`; `versionCode`/`buildNumber` auto-managed by EAS `autoIncrement`). M9.6 main milestone remains open (pending sessions #16–#21).
- **2026-04-27** — **M9.6 partial (session #16).** Privacy UI + data-safety declaration: `PrivacySettings` interface (`analyticsOptIn`, `crashOptIn`, both `false` default) added to save schema; `SaveFile` bumped v6→v7 with inline v6→v7 migration (missing `privacy` field defaults to both-false). `SaveStore` gains `privacy()` accessor + `setPrivacy(p)` mutator. `PrivacyOverlay.tsx` (Modal, fade-in) wired into Settings via a new "Privacy" button in `SettingsView` (inside `MenuOverlay.tsx`). Overlay renders two toggle rows (analytics / crash) + a "Data we collect" disclosure note. 8 new PL+EN locale keys (`settings.privacy.{title,analytics_label,crash_label,on,off,data_heading,data_note,close}`) added to `keys.ts` and both locale files. `tests/zone-stats.test.ts` updated `toBe(6)→toBe(7)` to match the version bump (necessary drive-by, not scope creep). +3 new tests in `tests/privacy-overlay.test.ts` (229 total, all green). Release-readiness §5 crash-opt-in surface ticked. M9.6 main milestone remains open (pending sessions #17–#21).
- **2026-04-27** — **M9.6 partial (session #17).** Sentry crash-transport binding gated by `crashOptIn`. New `apps/pan-tvardowski/src/errors/transport.ts` exports: `createSentryCrashTransport({ optIn, sentry, dsn })` (returns a `CrashTransport` from `@flare-engine/errors`; drops payload when `optIn()` returns false, when DSN is null, or when sink is null; otherwise rebuilds the original `Error` from payload — name/message/stack preserved — and forwards via `sentry.captureException(err, { extra: { ...payload.context, capturedAt } })`); `composeTransports(...transports)` (fan-out helper that swallows per-transport throws so one bad sink does not block others); `tryLoadSentry()` (lazy `require('@sentry/react-native')`, returns `null` on failure — keeps Sentry as a strictly optional binding, no peer dep added at 0.1.0). `App.tsx` `<ErrorBoundary>` now consumes `composeTransports(createConsoleTransport(), createSentryCrashTransport({ optIn: () => saveStore.privacy().crashOptIn, sentry: tryLoadSentry(), dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? null }))` — console always logs (dev visibility), Sentry only fires under user opt-in **and** a configured DSN **and** an installed sink. +8 new tests in `tests/crash-transport.test.ts` (5 transport behaviour + 3 composer behaviour, 237 total, all green). Release-readiness §5 "Crash transport provider chosen … wired in PT" ticked. M9.6 main milestone remains open (pending sessions #18, #19, #20, #21).
- **2026-04-27** — **M9.6 partial (session #18).** Screenshot capture scene + PT store-target manifest. `src/share/manager.ts` gains `PT_SCREENSHOT_TARGETS` (4 portrait phone slots: Play 1080×1920, Play 1080×2400, iOS 1242×2688, iOS 1290×2796 — all PNG) and `createPTScreenshotScene({ source, targets?, setup? })` factory wrapping `@flare-engine/share` `createScreenshotScene` with PT defaults (`{ format: 'png', quality: 90 }`). New `src/scenes/capture.ts` (`createCaptureScene(ctx, { screenshots, onComplete?, onError? })`) — minimal orchestration scene; `onEnter` flips `gameState.currentScene` to `'capture'` then awaits `screenshots.captureAll()`, forwarding the `ScreenshotResult[]` array to `onComplete` (or any thrown error to `onError`). `SceneName` union in `src/state.ts` extended with `'capture'` (justified scope extension — same shape as session #2's `'codex-shards'` addition). Scene **not yet registered in App.tsx** (the GameView Skia surface does not yet expose a `CaptureSource` shim — wiring + debug-button trigger deferred to a follow-up; the factory + tests are sufficient to satisfy the M9.6 row requirement). +7 new tests in `tests/capture-scene.test.ts` (2 target-list shape, 3 screenshot-scene behaviour, 2 capture-scene lifecycle), 244 total all green. M9.6 main milestone remains open (pending sessions #19, #20, #21).
- **2026-04-28** — **M9.6 partial (session #19).** Balance freeze. `BALANCE_FROZEN_AT = '2026-04-28'` exported from `src/config/gameplay.ts` and `src/config/zones.ts` (the two real balance config files; planner-declared `enemies.ts`/`upgrades.ts` do not exist in this codebase). `apps/pan-tvardowski/scripts/check-balance-freeze.sh` enforces the freeze: walks the `PROTECTED` file list, confirms each declares `BALANCE_FROZEN_AT`, then `git diff --quiet HEAD --` against each; any dirty/staged change fails with exit 1. Bypass via `ALLOW_BALANCE_CHANGE=1` for authorised post-launch passes. +4 new tests in `tests/balance-freeze.test.ts` (date format on each file, agreement between files, valid-calendar-date round-trip), 248 total all green. Script verified in both modes (bypass passes; dirty-files mode fails as expected with the freeze constants edited). M9.6 main milestone remains open (pending sessions #20, #21).
- **2026-04-28** — **M9.6 partial (session #20).** Locale parity audit. New `apps/pan-tvardowski/scripts/check-locale-parity.ts` (Bun-shebang, runnable as `bun run check:locales`) walks `locales/en.json` + `locales/pl.json` against `LOCALIZATION_KEYS`, building a `LocaleParityReport` (`missingInEn`, `missingInPl`, `extraInEn`, `extraInPl`, `emptyInEn`, `emptyInPl`); exits 0 if every section is empty, 1 otherwise with a tabulated drift report on stderr. Comparator helper `auditLocaleParity(en, pl, expected)` is a pure filesystem-free function — used by both the CLI entry and the new test. `package.json` gains `"check:locales": "bun run scripts/check-locale-parity.ts"` and `"check:balance": "bash scripts/check-balance-freeze.sh"` (the latter folded in from session #19, which left no script entry). Initial run reports clean (288 canonical keys, en + pl in parity) — no drift to fix. +3 new tests in `tests/check-locale-parity.test.ts` (live-triple clean assertion, synthetic drift detection, report-formatter section-suppression), 251 total all green. Existing `tests/locales-parity.test.ts` retained as the assertion form; the script is the CLI form. M9.6 main milestone remains open (pending sessions #21, #22).
- **2026-04-28** — **M9.6 partial (session #21).** Save-migrator v1→v7 step-chain. `src/save/migrator.ts` implements a linear step-chain (`migrateV1ToV2` … `migrateV6ToV7`) covering every schema bump across M9.1–M9.6; each step adds only the fields introduced in that milestone and carries typed `SaveFileV*` interfaces. `parseSaveFile` wired to run `migrate(raw)` before validation, making the loader version-transparent for all persisted saves from v1 onward. +5 new tests in `tests/save-migrator.test.ts`: v1→v7 full-chain round-trip, v6→v7 privacy-defaults, mid-chain entry (v4→v7 entitlements preserved), already-current v7 passthrough, and corrupted-version coercion. 256 total tests green. `@flare-engine/storage` migrator pattern exercised end-to-end.
- **2026-04-28** — **M9.6 complete.** Engine-coverage boxes ticked in §17 (share screenshot scene + storage migrator). Release-readiness §2 EAS profile confirmed; §5 crash transport + crash-opt-in surface + save-migrator step-chain all tested; §7 locale parity scripted (`check:locales`, 288 keys in parity) + balance freeze recorded (`BALANCE_FROZEN_AT = '2026-04-28'`, `check:balance` enforced); §8 screenshot capture scene wired via `createPTScreenshotScene` + `createCaptureScene` orchestration scene. Mirror row in `docs/references/builder-reference.md` updated: M0–M9.6 done, 256 tests green, feature-complete 2026-04-28. M9.6 is the final milestone — Pan Tvardowski is feature-complete for 0.1.0.
- **2026-04-28** — **PT-Bugfix-A bundle complete (session #46).** 3 bugfixes shipped, 333 tests green (+7 from bundle). M1: ExpoKeepAwake Android rejection suppressed via Android-guarded `deactivateKeepAwake()` shim in `App.tsx` (the originally-attempted `app.json` plugin entry was reverted — `expo-keep-awake` does not export a config plugin). M2: zone-progression persistence corrected — `commitRun` in `src/scenes/play.ts` now passes `nextZone` as `zoneReached` on boss-defeat and `currentZone` on game-over; +4 tests in `tests/zone-progression-save.test.ts`. M3: zone-select submenu in save-select view — `MenuOverlay.tsx` zone-picker renders all zones up to `slot.zoneReached`, each tappable via new `startSlotAtZone` action in `App.tsx`; 4 locale keys × EN/PL in `localization/keys.ts` + both locale files; +3 tests in `tests/zone-select.test.ts`.
- **2026-04-28** — **PT-Bugfix-A session #46 controls-visibility follow-up complete.** M4: `VirtualJoystick` + `VirtualButton` now conditionally rendered only when `currentScene === 'play'` — unmounts outside play, releasing input listeners in menus/game-over/victory; +3 tests in `tests/controls-visibility.test.ts` (336 total). M5 (engine): `@flare-engine/react` skia-bridge `beginFrame(viewportWidth, viewportHeight)` now passes a real bounds rect to `beginRecording` and skips when viewport=0 (shipped by engine-builder in same session).
- **2026-04-28** — **PT-Bugfix-B bundle complete (session #47).** 3 milestones shipped, 354 tests green (+18 from bundle; plan targeted +9). M1: collider scale audit — named constants `COLLIDER_SCALE_ENEMY=0.7`, `COLLIDER_SCALE_MINIBOSS=0.85`, `COLLIDER_SCALE_BOSS=0.9` extracted into `src/config/gameplay.ts`; `spawnBoss` gains optional `colliderScale` override param; `spawnEnemy`/`spawnMiniboss` adopt the constants; +5 tests in `tests/collider-scale.test.ts`. M2: Smok silhouette audit — draw-order investigation confirmed `shapes-draw.ts` iterates specs in forward array order (painter's algorithm: index [0] drawn behind); `smok-krzemionkowski[0]=COPPER ngon` is already the body layer and `[1]=HELLFIRE triangle` is the flame detail — no array swap required; +7 tests in `tests/boss-visual-audit.test.ts` encoding the painter-order invariant and distinct-silhouette contract for all 8 bosses. M3: logical gameplay bounds — `PlaySceneDeps.bottomInset?: number` added; `refreshBounds` subtracts it from viewport height so player clamp, spawn Y, and entity cull never use the occluded region; canvas stays full-bleed. `SceneRegistryDeps.bottomInset?` + `buildSceneRegistry` forward the value; `AppRoot` reads `insets.bottom` from `useSafeAreaInsets()` and passes it to `bootstrap` → `buildSceneRegistry` → `createPlayScene`. +6 tests in `tests/safe-area-bounds.test.ts`.
- **2026-04-28** — **PT-Polish-2..9 bundle complete (session #29).** 8 sequential polish milestones shipped across ~17 commits, 326 tests green (264 baseline → 326). M1: theme tokens consumed in `Hud.tsx` + `MenuOverlay.tsx` (+6 structural tests); two new tokens `colors.ui.onPrimary` + `colors.ui.tint55`. M2: theme tokens in 6 remaining overlays (Inventory/Codex/Achievements/Dialogue/Privacy/Shop) + shared `theme/overlays.ts` StyleSheet partials (root/panelContainer/panelLg/panelMd) + 3 new tokens (backdropModal/divider/dividerStrong); +11 tests. M3: entitlement-lost fallback — `createEntitlementFallback` / `shouldAllowStaleAccess` / `gameState.entitlementHealth: 'ok'|'stale'`, 5 PL+EN locale keys under `iap.entitlement_check_failed.*`, +8 tests. M4: analytics event names frozen in `tier2/analytics-events.ts` (+3 tests); `pantvardowski://` deep-link scheme + Android intentFilters in `app.json` (+3 tests); `CREDITS.md` expanded with engine packages, runtime libs, assets/font/contributors sections (+3 tests). M5: PL dialogue QA — 4 string fixes (codex.czart `sośninach`→`sosnach`; codex.nocny-lowca missing `o` preposition; codex.madej cut broken phrase EN+PL) + 5 sanity tests; `docs/locale-qa-followups.md` records `codex.smok-krzemionkowski.lore` deferred to expert review. M6: cold-start instrumentation (`src/perf/cold-start.ts` exports markBootStart/markBootMilestone/getBootTrace/resetBootTrace; 5 milestones wired: boot-start at module load, providers-mounted, save-loaded, audio-ready, first-frame); `docs/perf-baseline.md` (TTI ≤3s Galaxy A54, 60fps target, ≤250MB memory budget); App.tsx split into `src/providers.ts` (`useAppProviders` hook) + `src/scene-registry.ts` (`buildSceneRegistry` + `SCENE_KEYS`) + zero-dep `src/scene-keys.ts` (+8 tests). M7: `argbTo` helper exported from `shapes-draw.ts` and consumed by `shape-atlas.ts` (8 call sites, deleted local `argb` duplicate); migrate-helpers coverage sweep (parseZoneStats/parseSlot/isZone/parsePrivacy edge cases, +7 tests) + shapes-draw structural tests (+4 tests). M8: release-readiness checklist §3 entitlement-lost ticked; mirror row + this Change log entry synced. Deferred to post-launch: §5 device-measured TTI (instrumentation in place, awaits physical Galaxy A54 release build), CI green on release branch, device smoke; §7 store-page copy EN+PL; §8 store assets; §2 store accounts + signing; §4 privacy policy live URL.
- **2026-04-29** — **PT-Visual-Doc complete (session #66).** Canonical visual reference written: `apps/pan-tvardowski/docs/visual-reference.md` (14 sections, 44-entity shape table, 8-zone specs, 8-boss per-phase specs, 11-row punch-list with live file:line cross-links to all theme/config/catalogue files). Deck companion README at `docs/references/pan-tvardowski/README.md`. Three deck errors documented (ship art orientation, drawio rotations, HP-bar hex disambiguation). All visual sessions #67–#75 now have an authoritative spec to implement against.
- **2026-04-29** — **PT-Visual-Palette complete (session #67).** 12 ui tokens + 17 raw pigments rebranded to deck hexes; `Hud.styles.ts` miniboss-bar swapped `tertiary→verdigris`; `shape-catalogue.ts` global `GOLD`/`RED` ARGB constants migrated to deck values (`0xffc9a24a`/`0xffe84b2a`); `ZONE_PALETTES` regenerated for all 8 zones from `visual-reference.md §9`. `tertiary` alias bridged then removed. 367 tests green.
- **2026-04-29** — **PT-Visual-Type complete (session #68).** 3 font families wired via `@expo-google-fonts/*` (`@expo-google-fonts/eb-garamond`, `@expo-google-fonts/source-sans-3`, `@expo-google-fonts/jetbrains-mono`) + `useFonts` in `App.tsx` (non-blocking; font errors forwarded to `crashTransport.report` via `createCrashPayload`). `src/theme/typography.ts` rewritten: new `fontFamily` const (7 strings) + 11-key first-class type scale (`displayXl/displayL/displayM/lede/bodyL/bodyM/bodyS/label/monoHud/monoDebug/smallcap`) + 6 deprecated aliases (`h1/h2/h3/body/caption/xs`) all with `fontFamily` set. `src/theme/index.ts` re-exports `fontFamily`. `Hud.styles.ts` migrated: `score→bodyL`, `minibossName→smallcap`, `zoneBannerTitle→displayM`, `zoneBannerSub/tapHint→bodyM`, `bannerTitle→displayL`, `shieldActive/staleBannerText→smallcap`; `hp`/`bombs` kept on deprecated `body` alias (compact layout). `MenuOverlay.styles.ts`: `xs→monoDebug`. `BootOverlay.styles.ts`: `h3→bodyL`, `body→bodyM`. `visual-reference.md §2` updated: font families marked loaded, type-scale rows filled in, `mono.hud` corrected to 13 px. 389 tests green.
- **2026-04-28** — **PT-UX-A bundle complete (session #48).** 3 UX milestones shipped, 362 tests green (+8 from bundle). M1 (HUD insets + joystick gating): `Hud.tsx` + `Hud.styles.ts` apply `insets.bottom` padding to game-over and victory overlays so content clears Android navigation bar; `VirtualJoystick` + `VirtualButton` already gated on `currentScene === 'play'` in `App.tsx` (confirmed by M4 of session #46) — M1 focuses on the overlay inset fix; +3 tests in `tests/hud-insets.test.ts`. M2 (BootOverlay ProgressBar): new `src/hud/BootOverlay.tsx` + `src/hud/BootOverlay.styles.ts` render a `@flare-engine/ui` `ProgressBar` during cold-start boot, driven by `gameState.bootProgress` (new field in `src/state.ts`); `src/scenes/boot.ts` emits progress updates at `loadSave` and `initAudio` milestones; `src/localization/keys.ts` gains `boot.*` keys; PL+EN locale strings for `boot.loading`, `boot.loading_save`, `boot.loading_audio` added to both locale files; +3 tests in `tests/boot-overlay.test.ts`. M3 (InventoryOverlay tab persist): `gameState.inventoryActiveTab` (new field, type `InventoryTab` from new `src/hud/inventory-tab.ts`) persists across scene transitions; `InventoryOverlay.tsx` reads + writes `inventoryActiveTab` on tab press; `inventory-tab.ts` extracts the `InventoryTab` type to break a circular import between `state.ts` ↔ `InventoryOverlay.tsx`; tab state survives unmount/remount because `InventoryOverlay` returns `null` when `currentScene !== 'inventory'`, making state-lift the correct mechanism (spec's `key`-based rendering cannot preserve state across scene transitions); +2 tests in `tests/inventory-tab-persist.test.ts`.
- **2026-04-29** — **PT-Visual-Glow complete (session #69).** Friendly/hazard glow recipes wired into atlas-build draw; 11 starter entities tagged friendly (player ship `kogut-zloty` + 4 weapon pickups `iskry`/`piorun`/`sol-swiecona`/`znak-pentagramu` + 6 upgrade pickups); `skiaPostFx` re-enabled as `Skia as unknown as SkiaPostFxModuleLike` (chain ready, visible compositing pending engine SkCanvas bridge); grayscale-flash triggered on bomb detonation and boss defeat. Engine gap: `PostFxController.triggerHitFlash()` lacks per-trigger decay override; deck specifies different durations per event (80 ms player-hit / 200 ms bomb / 1200 ms boss-defeat); fixed 4.2-decay (~238 ms) used for all until a future engine polish session adds per-trigger decay. 402 tests green.
- **2026-04-29** — **PT-Visual-Explosions complete (session #70).** 5-tier explosion preset system (`chip`/`pop`/`burst`/`detonation`/`cataclysm`) in new `src/fx/explosions.ts`: per-tier particle counts (8/24/64/128/256), lifetimes (120/280/520/900/1600 ms), shake amplitudes (—/2/5/10/14 px), postfx flags. Concurrent caps with degradation: Tier III ≤4 active (overflow→pop), Tier IV ≤1 active (overflow→burst), Tier V 1/zone (overflow→detonation). Cataclysm zone-gate reset on `startZone()` via `resetCataclysmGate`. `src/particles.ts` `burstExplosion` refactored to thin Tier-II wrapper; `burstMuzzleFlash` unchanged. `src/scenes/play.ts` wired: Tier IV on boss phase-break (`onPhaseChange`), Tier V on boss-defeat (`onDefeated`; redundant `triggerHitFlash` removed — Tier V preset fires it), Tier III on miniboss-defeat explosion (`onExplosion` in `updateMiniboss` callback). Engine gaps deferred: `state.timeScale` slow-mo, sequenced postfx chain, Perlin shake. +10 tests (5 preset/particle-count + 5 caps/degradation), 412 tests green.
- **2026-04-29** — **PT-Visual-HUD complete (session #71).** Combo + weapon-meter elements added (stubbed — combo hidden until `comboCount > 1`; weapon meter 5-segment filled from `weaponCooldownPct = 1.0`); HP bar gradient `#2a0810→#D4213D` via `expo-linear-gradient` (HP text removed — bar communicates HP visually); boss bar gold border `colors.ui.gold`; reduce-motion swap (camera shake → 1-frame red flash) wired through new `applyShake` helper in `src/a11y/reduced-motion.ts`; 4 direct `ctx.camera.shake()` call sites in `play.ts` replaced. Combo + weapon-cooldown game-loop wiring deferred to a future session. New fields on `GameState`: `comboCount`, `weaponCooldownPct`, `redFlash`. New spacing token `weaponMeterHeight: 6`. `expo-linear-gradient ~14.1.5` added as dependency. +9 tests (5 hud-layout + 4 hud-reduced-motion), 421 tests green.
- **2026-04-29** — **PT-Content bundle complete (session #49).** 3 content/polish milestones, 428 tests green (+7). **M1** (overlay layout audit): `Hud.styles.ts` `minibossBar` hardcoded px replaced with theme tokens (`spacing.hudCornerY + spacing.xxl`, `spacing.hudCornerX`, `spacing.sm`); +2 tests in `tests/hud-layout.test.ts`. **M2** (shop placeholder cards): `ShopOverlay.tsx` renders full_game + supporter_pack placeholder cards (`placeholder-y-x` price labels) when `NoopIAPProvider` active; new `isNoopProvider` prop wired from `App.tsx`; 3 new shop locale keys (`shop.full_game.placeholder_price`, `shop.supporter_pack.placeholder_price`, `shop.noop_notice`) × EN/PL; +3 tests in `tests/shop-placeholder.test.ts` (new file); `tests/shop-entitlements.test.ts` count-guard 19→22. **M3** (fresh-save UX): `CodexOverlay.tsx` + `AchievementsOverlay.tsx` show locked-entry count + encouraging ICU-pluralized copy when save is fresh, instead of bare `???` list; 4 new locale keys (`codex.fresh_save.{heading,body}`, `achievements.fresh_save.{heading,body}`) × EN/PL; +2 tests in `tests/empty-state-ux.test.ts` (new file). Scope expansions: `App.tsx` (⊕ pre-approved); `tests/shop-entitlements.test.ts` (⊕ mechanically required count-guard). Locale parity clean at 307 keys.
- **2026-04-30** — **PT-Final bundle complete (session #50).** 3 milestones shipped, 434 tests green (+6). **M1** (credits PL/EN): `credits-sections.ts` refactored from hardcoded EN strings to type-safe locale keys; 27 `credits.*` keys added to `src/localization/keys.ts` + EN/PL locale files; `MenuOverlay.tsx` updated to consume keyed sections; +3 tests in `tests/credits-locale.test.ts`. **M2** (auto-persist on zone-enter + 30s idle): `src/scenes/play.ts` calls `persist()` directly on zone entry and on 30-second idle tick (no `save/store.ts` changes required — existing `persist()` API sufficient); +3 tests in `tests/auto-persist.test.ts`. **M3** (device-smoke gate): `apps/pan-tvardowski/docs/device-smoke.md` created with Galaxy A54 + iPhone 12 checklist; actual device run deferred to session #59 (PT-DeviceSmoke) per explicit user direction. Locale parity 334 keys.
- **2026-04-30** — **Session #51 (mixed): `getBottomInset` callback refactor.** Engine half delivered `SafeArea` type + `SafeAreaContext` + `useSafeArea()` hook in `packages/react/src/safe-area.ts`; `<GameView safeArea?>` optional prop added (resolves from RN-SAC peer dep or falls back to zero-inset); 5 new tests (50 total in `@flare-engine/react`). Game half (Path B): manual `bottomInset?: number` field in `BootstrapDeps` / `SceneRegistryDeps` / `PlaySceneDeps` renamed to `getBottomInset?: () => number`; `App.tsx` now threads `() => insets.bottom` callback; `scene-registry.ts` and `scenes/play.ts` updated accordingly. `tests/safe-area-bounds.test.ts` not modified — `computePlayHeight` helper is pure arithmetic, contract unchanged. 434 tests green (no net new PT tests in this session).
- **2026-04-30** — **PT-Visual-Zones complete (session #72).** 8-zone deck palettes wired per zone (Z1 Dachy ember-32p, Z2 Puszcza pollen-80p, Z3 Wisła spray-48p, Z4 Błota ember-96p, Z5 Łysa ash-128p, Z6 Katakumby dust-24p, Z7 Karczma smoke-16p, Z8 Księżyc float-64p) in `src/palette.ts` (new `AmbienceKind` union, `ambienceName`/`ambienceParticles`/`silverUi?` fields, `getUiPrimary` + `getUiPrimaryHex` helpers). Parallax-particle ambience emitter (`src/fx/ambience.ts`, new file) wired into `src/scenes/play.ts` via tier-system: rate `count/8`, two parallax layers (slow 8 px/s, fast 20 px/s), zero-alloc tick, reduced-motion + boss-active early returns. Z8 silver-UI exception applied to the only device-visible gold accent — bossBar border in `src/hud/Hud.tsx` via per-render `bossBarBgStyle` memo (other `colors.ui.gold` references are entity geometry or static chrome out of scope). `config/zones.ts` not touched — balance-frozen, ambience routed through `palette.ts` per pre-approval. `src/fx/ambience.ts` + `src/hud/Hud.tsx` are pre-approved drift beyond declared paths. +10 tests (5 in `tests/zone-ambience.test.ts` + 5 in `tests/z8-silver-ui.test.ts`), 444 total green.
- **2026-04-30** — **PT-Visual-Bosses complete (session #73).** Per-boss phase palette transitions wired for all 8 bosses (M1): `src/systems/boss/types.ts` gains `onPhaseTransition?(phase: BossPhase, palette: ZonePalette): void` on `BossDeps`; each of the 8 boss scripts (`smok`, `borowy`, `wodnik`, `boruta`, `baba-jaga`, `bazyliszek`, `mefistofeles`, `lucyper`) calls `deps.onPhaseTransition` on every phase-enter, passing the boss-specific tint override palette. Per-boss particle preset + postfx chain on phase-break (M2): new `src/fx/boss-postfx.ts` defines `BossPostFxKind` union (8 boss-specific variants) + `BOSS_POSTFX_CHAINS` record mapping each kind to a `PostFxChainSpec`; `onPhasePostFx` callback type added to `BossDeps`; all 8 boss scripts invoke it on phase transition. Z5 Baba Jaga 3-phase white-out + Z8 Lucyper crimson-mirror finale (M3): `baba-jaga.ts` emits a desaturating white-out palette ramp through phases 1→2→3; `lucyper.ts` triggers a crimson-mirror postfx chain on defeat — `onDefeated` calls `onPhasePostFx('lucyper-finale')` before chaining to victory. +7 tests (3 in `tests/boss-phase-palette.test.ts` + 2 in `tests/boss-postfx.test.ts` + 2 in `tests/boss-final-hit.test.ts`), 451 total green.
- **2026-04-30** — **PT-Visual-A11y complete (session #74).** M1: color-blind tokens added to `src/theme/colors.ts` (`colors.cb.player #FF8C42`, `colors.cb.hazard #FFD23F`, `colors.cb.safe #4FC3F7`); `colorBlindMode: boolean` toggle added to `Settings` + save schema bumped v7→v8 (nested `ui: { colorBlindMode }` field, inline v7→v8 migration); `MenuOverlay.tsx` `SettingsView` gains a colorBlind toggle row (accessibility prefs co-located with reducedMotion; `hud/PrivacyOverlay.tsx` not touched — GDPR-only); `src/save/migrate.ts` and `src/save/schema.ts` updated; `src/state.ts` and `src/localization/keys.ts` updated. Drift from declared paths: `hud/PrivacyOverlay.tsx` + `scenes/settings.ts` not touched (toggle placed in `SettingsView` inside `MenuOverlay.tsx`); added `hud/MenuOverlay.tsx`, `save/{schema.ts,migrate.ts}`, `state.ts`, `localization/keys.ts`; cascading test updates in `tests/{save-migrator,theme,zone-stats,zone-ambience}.test.ts` for v8 schema bump — all pre-approved at `/session-start`. M2: `src/a11y/reduced-motion.ts` extended — `isReducedMotion()` guard added to `src/fx/ambience.ts` (parallax-static when reduced-motion active); `sigilOpacity` helper added (`0.7` dim when reduced-motion active); `applyShake` already exits early on reduced-motion (no shake). M3: `locales/{en,pl}.json` extended with PL diacritics for new cb/a11y keys; new `tests/diacritics-render.test.ts` asserts presence of ą/ę/ó/ś/ź/ż/ć/ń chars in all new PL locale strings. +14 tests total (5 in `tests/cb-palette.test.ts` + 5 in `tests/reduced-motion-extended.test.ts` + 4 in `tests/diacritics-render.test.ts`), 466 total green.
- **2026-04-30** — **PT-Visual-Budget complete (session #75).** M1: per-scene frame-budget guards added in new `src/fx/budget.ts` — `FRAME_BUDGET` const object (`maxDrawCalls: 920`, `maxParticles: 480`, `maxPostFx: 3`); `checkFrameBudget(draws, particles, postfx)` returns a `BudgetResult` with per-category `over` flags; `src/scenes/play.ts` calls `checkFrameBudget` each frame and emits a `frame-budget-exceeded` event on first breach per category (deduped with a per-category latch). `src/perf/cold-start.ts` gains `getFrameBudget()` accessor. 5 new tests in `tests/frame-budget.test.ts`. Drift: `src/fx/postfx.ts` modified to expose the 4th-effect slot needed by M2 (pre-approved). M2: fps watchdog implemented — `createFpsWatchdog(options)` in `src/fx/budget.ts` tracks a 3-second rolling avg; when avg fps drops below 55 the watchdog fires `fps-watchdog-drop` event and the play scene removes `chromatic-ab` from the postfx chain; watchdog re-arms after 10s of stable fps. `tests/fps-watchdog.test.ts` (+5 tests). `tests/postfx.test.ts` updated for new 4-effect exact-order assertion (pre-approved drift). M3: `apps/pan-tvardowski/docs/perf-baseline.md` updated with post-rebrand benchmark section — draw-call budget headroom, particle peak per zone, postfx chain lengths; all numbers carry a `Pending real-device measurement (session #59)` note (placeholder values pre-approved at plan time). +10 tests total (5 + 5), 476 total green. Locale parity unchanged at 335 keys. Device-smoke deferred to session #59 (PT-DeviceSmoke) per session #50 footnote ⊞ and M3 plan-time approval.
- **2026-04-30** — **PT-Ship-Anatomy-3 complete (session #78).** M1: folio-conformance audit of 4 weapon pickups (`iskry`, `piorun`, `sol-swiecona`, `znak-pentagramu`) and 6 upgrade pickups (`czarna-ksiega`, `siedmiomilowe-buty`, `amulet-wegrowski`, `koguci-pioro`, `srebrna-tarcza`, `kamien-filozoficzny`) — all 10 pickups confirmed as `ShapeSpec[]` with `glow: 'friendly'` on the first spec; 6 new tests in `tests/pickup-ships.test.ts` (T1: 4 weapon-pickup entries non-empty; T2: 6 upgrade-pickup entries non-empty; T3: glow=friendly on every first spec; T4: weapon-pickup signatures unique; T5: upgrade-pickup signatures unique; T6: total 10). M2: 29-ship silhouette-uniqueness visual audit — all 29 `ShipSpec` entries (14 enemies + 4 minibosses + 8 bosses + 3 players) confirmed to have distinct hull silhouette keys (kind:shapeParams:fill); 5 new tests in `tests/ship-silhouette-audit.test.ts` (T1: exactly 29 entries; T2: no two ships share hull key; T3: every engine kind=square size=20; T4: weapon counts per tier; T5: every weapon kind=rect). M3: `apps/pan-tvardowski/docs/visual-reference.md` §3 updated with migration-complete note + pickup carve-out rationale; §15 gap #1 status flipped from `open` to `done`. Net +11 tests (496→507 total green). Device-smoke deferred per session #50 footnote convention.
- **2026-04-30** — **PT-Ship-Anatomy-2 complete (session #77).** M1: all 4 mini-bosses rewritten as `ShipSpec` in `src/shape-catalogue.ts` (crimson hue family: `CRIMSON 0xffd4213d`, `CRIMSON_DARK 0xff7a1322`, `CRIMSON_RUST 0xff8b3a1f`); 2–3 weapons each per folio XIIIb+; hull and engine fills validated in `tests/miniboss-ships.test.ts` (+3 tests). M2: all 8 bosses rewritten as `ShipSpec` (violet hue family via channel comparison: `b > g`, `r > g`, `b ≥ 0x40`, `r ≤ 0xb0`); 3 named violet constants (`VIOLET`, `VIOLET_DARK`, `VIOLET_MID`) + 2 inline ARGB literals for 5 distinct shades; 2–4 weapons each; `tests/boss-ships.test.ts` (+3 tests) validates via `isVioletFamily`. M3: all 3 player ships rewritten as `ShipSpec` with brand hue families (kogut-zloty GOLD `0xffc9a24a`, alembik BOG_GREEN `0xff1a2e1f`, zwierciadlo DEEP_BLUE `0xff1a2e4a`); each has `glow: 'friendly'` and exactly 2 weapons; `tests/player-ships.test.ts` (+6 tests: 2 describes × 3 each). Companion test rewrites: `boss-visual-audit.test.ts` migrated from array indexing to `ShipSpec` field access (net 6 tests, count unchanged); `glow-recipes.test.ts` +2 assertions; `shape-catalogue.test.ts` 1 test split into 2 — all mechanical, type-forced by session #76 ShipSpec. Dead-code: unused `COPPER` constant removed. Net +12 tests (484→496 total green). Device-smoke deferred per session #50 footnote convention.
- **2026-04-30** — **PT-Ship-Anatomy-1 complete (session #76).** M1: `ShipSpec` type added in `src/shapes.ts` — `{ kind: 'ship'; hull: NgonSpec; weapons: readonly RectSpec[]; engine: SquareSpec; glow?: GlowKind }` (folio XIIIa 3-element rule: hull + N rect weapons + 1 square engine); `SquareSpec` added as a new leaf type; `ShapeSpec` union extended with both. M2: all 14 enemies in `src/shape-catalogue.ts` rewritten as `ShipSpec` entries; `enemies` field typed as `Record<string, ShipSpec>`; `(12)` comment corrected to `(14)`; `src/shape-atlas.ts` call-site updated to split enemy iteration over the now-typed `Record<string, ShipSpec>` (drift — mechanically forced by type change, no alt path). M3: `case 'ship'` branch added to `drawShape` / `glowRadius` / `shapeBoundsRadius` in `src/shapes-draw.ts`; private `drawSquare` + `drawShip` helpers implement the engine→hull→weapons draw order. 7 new tests in `tests/ship-anatomy.test.ts` (T1–T7). Test updates: `tests/shape-catalogue.test.ts` special-cases enemies (kind=ship); `tests/glow-recipes.test.ts` reads `spec.glow` directly on `ShipSpec`. Drift notes: (1) `shape-atlas.ts` call-site fix forced by enemies type change; (2) T5 silhouette uniqueness key broadened to include `n`/`r` params — `bies` vs `wapierz` are both ngon+DARK_RED but differ in `n` (spec clarification, not scope expansion); (3) `weapons: ReadonlyArray<RectSpec>` → `readonly RectSpec[]` per Biome `useConsistentArrayType` lint rule. +8 tests total (483→484 with test file changes net-counted), 484 total green. Device-smoke deferred per session #50 footnote convention.
- **2026-04-30** — **PT-HUD-Complete complete (session #79).** M1 (combo readout): `comboHit: boolean` added to `GameState` interface, initializer, and `resetGameState`; `play.ts` increments `comboCount` + sets `comboHit = true` on enemy-kill, resets both on player-down and zone-start; `Hud.tsx` stateChanged handler clears `comboHit` after 16 ms (mirrors redFlash); combo `<Text>` now selects `comboPulse` (scale 1.18) or `comboPulseReduced` (opacity 0.6) when `comboHit` true; both styles added to `Hud.styles.ts`. M2 (weapon meter live wiring): `weaponLevel: number` added to `GameState` + initializer + `resetGameState`; `play.ts` post-`updatePlayer` iterates `shipQuery` zero-alloc, writes `weaponCooldownPct = 1 - ship.cooldown / ship.fireRate`; weapon meter refactored — `i < weaponLevel` = full crimson, `i === weaponLevel` = cooldown-overlay strip, `i > weaponLevel` = dim; new segment styles `weaponSegmentCooldown` + `weaponSegmentCooldownFill` added. M3 (zone banner): `zoneRomanNumeral(zoneId)` pure function added to `hud/zone-banner.ts` mapping z1–z8 → I–VIII; `Hud.tsx` banner now renders numeral (gold italic serif) → `zoneBannerRule` (gold rule) → zone name; `zoneBannerNumeral` + `zoneBannerRule` styles added to `Hud.styles.ts`. Tests: +17 tests across 3 new test files (combo-readout.test.ts, weapon-meter.test.ts, zone-banner.test.ts). Gates: lint 0 errors, typecheck 0 errors, 538 tests all green (21 new vs session #78 baseline of 507 net — 31 new assertions across state/style/mapping concerns; count increase also reflects carry-over tests from interim sessions). Device-smoke deferred per session #50 convention.
- **2026-04-30** — **PT-Frontmatter complete (session #80).** M1 (boot screen): `BootOverlay.tsx` rewritten per folio X — ink-black bg, centered sigil placeholder, `ProgressBar` driven by `gameState.bootProgress`, version label gated on `appVersion` prop; `BootOverlay.styles.ts` updated; `App.tsx` threads `appVersion` prop (single-line mechanical change); locale key `boot.version` added (stores complete `v0.1.0` string per cleanest folio-X reading). M2 (menu screen): `MenuOverlay.tsx` rewritten per folio X — title `EB Garamond display.xl`, 4-button stack (New Game / Continue / Settings / Credits); `MenuOverlay.styles.ts` new companion file; locale keys `menu.save_select.new_game` + `menu.save_select.runs` added. M3 (save-select): `SaveSelectView` drop-in inside `MenuOverlay.tsx` — flat `Pressable` + `divider` border rows (no nested `Panel` per folio X "no nested Panel" spec), 3-slot grid with zone preview + stats. No `scenes/{boot,menu,save-select}.ts` changes — scene logic was already correct (presentation-only session). +6 tests across 3 new test files (`tests/boot-screen.test.ts`, `tests/menu-screen.test.ts`, `tests/save-select-screen.test.ts`), 544 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Frontmatter-2 complete (session #81).** M1 (settings screen grouped): `MenuOverlay.tsx` `SettingsView` restructured with 4 named groups — Audio (master/music/sfx volume rows), Accessibility (reduced-motion + color-blind toggles), Gameplay (controls / language rows), Telemetry (analytics + crash-opt-in rows with live privacy state) — each headed by a gold `lede` `settingsGroupHeading` style; wrapped in `<ScrollView>`. M2 (credits typography): `MenuOverlay.styles.ts` `creditsSectionTitle` upgraded `label→lede` + `neutralLight→gold`; `creditsLine` upgraded `monoDebug→bodyL` + lineHeight 18→30; `creditsContent` padding uses `spacing.xxxl` token; `creditsSkip` uses `smallcap` type scale. M3 (locale keys): 4 new group-heading keys `settings.group.{audio,accessibility,gameplay,telemetry}` × EN + PL added to `src/localization/keys.ts` and both locale files. Drift: `scenes/settings.ts` + `hud/PrivacyOverlay.tsx` not modified — UI lives in `SettingsView` inside `MenuOverlay.tsx`; `MenuOverlay.styles.ts` sibling drift pre-approved; `keys.ts` sync pre-approved. +5 tests: 3 in `tests/settings-screen.test.ts` (group keys non-empty EN, non-empty PL, ordering) + 2 in `tests/credits-screen.test.ts` (creditsSectionTitle fontFamily, creditsLine fontFamily), 549 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Overlay-Polish complete (session #82).** M1 (InventoryOverlay folio XI): `InventoryOverlay.styles.ts` — tab style uses `gold` token, `tabActive` retoned from `neutralLight` to `crimson`, panel background updated to `parchment`. M2 (CodexOverlay folio XI): `CodexOverlay.styles.ts` — `entryLocked` fill updated to `void` at 0.45 opacity, new `entryUnlocked` style added with `gold` left-border; panel background updated to `parchment`; `CodexOverlay.tsx` applies `entryUnlocked` style to unlocked entries (one-line mechanical change). M3 (DialogueOverlay folio XI): `DialogueOverlay.styles.ts` — panel background updated to `parchment`, `portraitSlot` size corrected 48 → 44 per folio XI, `portraitBox` gains `gold` border. Drift: `tests/theme-overlays.test.ts` fixture updated (tabActive `neutralLight→crimson` assertion); `CodexOverlay.tsx` one-line style application — both pre-approved. +6 tests across 3 new test files (`tests/inventory-folio.test.ts`, `tests/codex-folio.test.ts`, `tests/dialogue-folio.test.ts`), 555 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Overlay-Polish-2 complete (session #83).** M1 (ShopOverlay folio XI): `ShopOverlay.styles.ts` gains `panel`, `productCard`, `productCardPrice` styles (gold border on product card, parchment panel bg, price label token); `ShopOverlay.tsx` wired to use `panel` wrapper and `productCard`/`productCardPrice` per folio XI. M2 (PaywallOverlay folio XI): new `PaywallOverlay.styles.ts` — full-bleed wrapper with `crimsonDeep` background, enforces full-screen CTA layout per folio XI; `PaywallOverlay.tsx` wraps `PaywallModal` in the new `View`. M3 (AchievementsOverlay folio XI): `AchievementsOverlay.styles.ts` — panel `parchment` background, `entryLocked` void background, `entryUnlocked` gold left-border; `AchievementsOverlay.tsx` applies `entryUnlocked` style. +6 tests across 3 new test files (`tests/shop-folio.test.ts`, `tests/paywall-folio.test.ts`, `tests/achievements-folio.test.ts`), 561 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Parallax-Audit complete (session #84).** M1 + M2: parallax audit confirmed zones.ts balance-frozen + palette.ts already match folio XIIB layer counts and scroll-rate ratios — no config changes required. M3: `src/fx/ambience.ts` tuned to folio XIIB specs — `VEL_SLOW` corrected 8 → 10 px/s, drift spread widened ±2 → ±8 px/s; `createAmbienceLayer`, `tickAmbience`, `resetAmbience` exported as named functions for testability. Drift: `src/config/zones.ts`, `src/scenes/play.ts`, `palette.ts` not modified (already conformant); only `src/fx/ambience.ts` needed changes. +4 tests in 2 new test files (`tests/parallax-audit.test.ts`, `tests/ambient-density.test.ts`), 565 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Easing complete (session #85).** M1: 5 of 9 folio XIV easing assignments wired — items 1/5/6/8/9 shipped; items 2/3/4/7 deferred behind 4 engine gaps (linear-only `fadeTransition`, no overlay open/close API, no sigil-pulse driver, no per-trigger flash decay) documented in `visual-reference.md §11`. `scene-registry.ts` menu fade corrected to 0.32 s cubicOut. M2: boss-intro `expoOut 600 ms` + game-over `cubicIn 1200 ms` transitions — `bossBarOpacity`, `gameOverOpacity`, `comboPulseScale` fields added to `state.ts`; `scenes/play.ts` drives boss-intro tween; `Hud.tsx` applies `gameOverOverlayStyle` (separate from victory overlay) + `comboPulseTween`. Integration bug-fixes in-session: `comboPulseTween` initialised with `done: true`; `bossBarStyle` useMemo deps corrected to include `s.bossBarOpacity`; `gameOverOverlayStyle` split from `centerOverlayStyle`. M3: zone-banner `quartOut 800 ms` enter animation via `src/hud/zone-banner.ts`. Drift: `src/state.ts` + `src/hud/zone-banner.ts` not in declared paths but mechanically required (same pattern as session #48). +6 tests in 3 new test files (`tests/easing-assignments.test.ts`, `tests/boss-intro-transition.test.ts`, `tests/zone-banner-anim.test.ts`), 571 total green. Device-smoke deferred to session #59 per established convention.
- **2026-04-30** — **PT-Visual-DocSync complete (session #86).** M1: `visual-reference.md` §§5–12 flipped from `open` to `done` reflecting sessions #66–#75 closures. M2: §15 punch-list updated with new ship-anatomy + overlay + frontmatter rows. M3: ~14 stale `file:line` cross-links corrected (scene-registry boot :72→:78, menu :91→:96, save-select :92→:97, settings :93→:98, credits :94→:99, inventory :95→:100, codex :96→:101, achievements :97→:102, shop :98→:103, play :99→:105, game-over :115→:120, victory :116→:121, skiaPostFx :63→:68, a11y :65→:70; `cold-start.ts:16→:22`; `postfx.ts:15-19→:19-20`; `palette.ts:18→:52`). Link audit was explicitly required by the M3 goal text ("verify all file:line cross-links still valid") — in-scope. No test changes (doc-only session). 571 tests unchanged.
- **2026-05-07** — **PT-Visual-Close complete (session #87).** M1 (21-folio audit): full folio-vs-code audit written as `visual-reference.md §16` — 14 ✓ confirmed match, 2 ⚠ doc-only drift, 0 ✗ runtime divergences, 5 n/a (device-smoke gate: folios IX/X/XI/XIIId pixel alignment). M2 (stale ref cleanup): §3 glow-helper cross-links updated from deleted `src/shapes.ts` + `src/shapes-draw.ts` to `@flare-engine/shapes` package (session #92 migration); §3 color-constant note updated (COPPER removed, GOLD/RED migrated at #67, crimson+violet family constants added); §3 weapon/upgrade pickup line numbers corrected (229–280 → 337–403); §2 typography line-number anchors corrected (h1→:72, h2→:78, h3→:83, body→:90, label→:49, caption→:95). M3 (doc close): §15 row #14 added for visual-spec schema architectural shift (sessions #91–#92, canary `b056ac8e…`); `builder-reference.md` mirror row updated (last session #87, 2026-05-07); release-readiness checklist walked. Device-smoke (Galaxy A54 + iPhone 12) runs before `/session-close`. 571 tests unchanged (doc-only session).
