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
- Not a replacement for `apps/demo`. That demo stays as the minimal-scope integration smoke test.
- Not a showcase for `@flare-engine/pathfinding` — that package will be exercised by a different post-launch project.

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

| M      | Name                     | Deliverable                                                                                   | New engine coverage                                                             |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **M0** | Pre-production           | Shape atlas spec, localization scaffold, asset palette, directory layout                      | assets, localization                                                            |
| **M1** | Zone 1 (Kraków rooftops) | Scaffold `apps/pan-tvardowski`, first zone + boss, shape atlas, 2 enemies                     | core, ecs, render, input, physics, scene, ui, engine, react, storage, particles |
| **M2** | Zone 2 (Puszcza)         | Miniboss framework, Rokita, Borowy Król                                                       | animation, audio, events, deep-links                                            |
| **M3** | Zone 3 (Wisła)           | Water-layer effects, bubble-shield boss mechanic                                              | postfx, tilemap                                                                 |
| **M4** | Zone 4 (Łęczyckie Błota) | Summons mechanic for Boruta, Leszy shape-shift                                                | devtools, share                                                                 |
| **M5** | Zone 5 (Łysa Góra)       | First 3-phase boss, night-time palette, ritual SFX                                            | testing (boss-replay tests), errors                                             |
| **M6** | Zone 6 (Katakumby)       | Gaze-beam maze (first postfx-heavy boss)                                                      | a11y (reduced-motion toggle)                                                    |
| **M7** | Zone 7 (Karczma "Rzym")  | Dialogue system, mirror-twin phase, dialogue graph                                            | dialogue                                                                        |
| **M8** | Zone 8 (Księżyc)         | Final boss, full bullet hell, ending cutscene                                                 | analytics, leaderboards, achievements, iap stubs mounted                        |
| **M9** | Polish pass              | Balance tuning, PL+EN dialogue final, achievement hookup, screenshot captures for store pages | — (all packages revisited)                                                      |

**Gates between milestones:** `bun run test` green; `bun run build` green; device smoke test on Android (release build).

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

## Change log

- **2026-04-22** — initial plan landed. Pre-production phase. Pathfinding excluded by design.
