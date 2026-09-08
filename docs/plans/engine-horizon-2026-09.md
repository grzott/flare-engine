# Engine horizon — competitive position and a two-year candidate roadmap (2026-09-08)

Where Flare sits against the field it actually competes in, and what is worth building over the next
one to two years. **Proposals and a market read — nothing here is scheduled.** It does not renumber,
reschedule or supersede [road-to-oss-2026-09.md](road-to-oss-2026-09.md), and everything in it sits
after the October 20 flip, behind the already-fixed first post-flip arc (the devtools live-tweak
inspector) and behind [roadmap-post-flip.md](roadmap-post-flip.md)'s T1–T8 and Arc DESK
([adr-0005](../design/adr-0005-desktop-delivery-target.md),
[desktop-steam-2026-09.md](desktop-steam-2026-09.md)).

Engine-side claims were verified at HEAD on 2026-09-08. Competitive claims carry sources in §7 and
are dated, because they decay.

---

## 1. Positioning — decided by the owner, 2026-09-08

> "It'll be great to make something for the RN ecosystem mainly, but also for game devs — maybe
> someone will build a game with my engine, not only me."

Two consequences that this document then applies throughout:

1. **The React Native ecosystem is the primary audience** — app teams, not only game studios. That is
   already what [AGENTS.md](../../AGENTS.md) claims in its first sentence ("animation, gamification,
   interactive UI, and games") and what the Tier-2 stack already *is*. It is also the least contested
   market in §2: no JS/TS game engine competes there at all.
2. **Third-party game developers are a real target, not a hypothetical.** Until now every roadmap
   decision could assume exactly two consumers, both owner-operated. Designing for a stranger who
   never asks a question changes what matters: defaults, error messages, templates, stability
   labelling and documentation move ahead of features. §4 is about that, and it is the section most
   likely to be underweighted.

Games remain the proof of capability. They are no longer the only product.

---

## 2. The field, excluding Unreal / Godot / Unity

Verified 2026-09-08. Scope: engines and libraries a TypeScript developer would realistically choose
for web, mobile and — assuming a Steam integration — desktop.

| Group | Engine | Language | Native mobile | Web | Desktop / Steam | Editor | Ecosystem |
|---|---|---|---|---|---|---|---|
| Web-first, code-first | **Phaser 4 "Caladan"** (10 Apr 2026, rewritten WebGL renderer) | JS-first, TS types | WebView only | best-in-class | Electron + `steamworks.js` | no | very large |
| | **PixiJS v8** | TS | WebView only | renderer only, fastest | Electron | no | large |
| | **Excalibur.js** | **TS-first** | WebView only | yes | Electron | no | small |
| | **Kaplay** | TS | WebView only | yes | — | no | jam-scale |
| Editor engines | **Cocos Creator 3.8.x** | **TS** | **yes, native** | yes | yes (via Greenworks) | yes | very large in Asia |
| | **PlayCanvas 2.20.6** (Jul 2026, MIT) | TS/JS | no | yes | Electron | yes | mid, 3D-leaning |
| | **GDevelop** | no-code + JS | yes | yes | yes | yes | large, non-developer |
| Cross-platform benchmark | **Defold 1.13.0** | Lua | yes | yes, **~1 MB gzipped empty build** | yes, **plus PS4 / PS5 / Switch** | yes | mid, loyal |
| RN primitives | RNGE, `expo-gl`, `react-native-wgpu`, raw Skia + Reanimated | TS | yes | partial | no | no | — |

### 2.1 The quadrant Flare occupies is still empty

Nothing else is a **complete engine layer** rendering through a **native GPU path inside a React
Native app**, in TypeScript, sharing source with a web build. The four partial RN options are the
ones catalogued in the owner's own published analysis: RNGE (dormant, View-per-entity, a ceiling
around 50 active entities), Phaser in a WebView (roughly 5–10× slower on Android and architecturally
separate from the host app), `expo-gl` / `react-native-wgpu` (GPU contexts with no engine above
them), and Skia + Reanimated 4 (the strongest, and what Flare is built on — but bare, and around 300
sprites on budget Android).

**Cocos Creator is the only engine in the table that genuinely does TS + native mobile + web +
desktop.** The difference is structural rather than a feature gap: Cocos is an editor-centric engine
with its own C++ runtime that a developer builds *inside*, not a set of packages installed *into* an
app that already exists. Flare is the only option for a team that already has a React Native app and
wants an engine inside it. That is the moat, and it is real.

**It is also why the quadrant is empty:** "a game engine inside an RN app" is a smaller market than
"a web game engine". §1's positioning is the answer to that — the adjacent, larger market is the RN
product layer, and the same packages serve it.

### 2.2 Three things the moat does not cover

1. **No editor.** Every editor-group competitor has one and the code-first group mostly does not need
   one. This is the most common reason a visitor bounces, and §3.2 is the proposed answer.
2. **Web payload.** CanvasKit measures **6.8 MB** on disk here (`node_modules/canvaskit-wasm/bin/
   canvaskit.wasm`), and [web-target-2026-08.md](web-target-2026-08.md):261 records 7.1 MB and 8.0 MB
   for the two variants. Against Defold's ~1 MB gzipped HTML5 build this is disqualifying for itch /
   Poki / playable-ad distribution. It matters less under §1's positioning — RN ships native — but it
   does not disappear, because **Arc DESK's desktop target is the web export in a Chromium shell**,
   so the payload becomes desktop boot time.
3. **Ecosystem is zero at the flip.** 41 scoped packages, one maintainer, no plugins, no third-party
   tutorials, no external users. Phaser's advantage over everything in this table is not technical.

### 2.3 Where Flare is ahead, and nobody is close

The Tier-2 product layer — `iap`, `iap-revenuecat`, `leaderboards`, `achievements`, `analytics`,
`haptics`, `ui-shop`, `progression`. Phaser, PixiJS and Excalibur ship none of it; Cocos and
PlayCanvas ship parts of it welded to their editors. It is a *product* feature set rather than a game
feature set, it is already built, and it is the strongest evidence for §1's positioning.

Two more, less visible: the packages are genuinely separable (a React Native app can take
`progression` alone and never touch a renderer — no competitor unbundles), and the engineering rigor
is ecosystem-grade rather than hobby-grade (dependency-tier enforcement, publint/attw export gates,
perf baselines with a freshness gate, a 2,392-test consumer).

---

## 3. Candidate tracks

Three bets, then a compounding layer, then cheap adapters. Each must still pass the owner constraint
every post-flip track passes: **it ships as its own package or as a bounded addition to exactly one
existing package.**

### 3.1 Bet A — put a backend seam under the renderer before Graphite lands

Skia Graphite — the Dawn/WebGPU backend — is already reachable in RN-Skia's `@next` channel behind a
flag, requires Android API 26+, and was not production-ready as of April 2026. Shopify is pushing it
publicly, and it is what moves the ~300-sprite budget-Android ceiling the owner's own analysis names.
It also brings GPU compute into reach for particles and physics, and 2D/3D composition.

The risk is not that Graphite lands. It is that it lands while `render` is welded to the current
`SpriteBatch` → `drawAtlas` path, so the ceiling stays where it is and the moat quietly erodes.

**Shape:** a `RenderBackend` interface behind `SpriteBatch.flush` (which already delegates the actual
Skia call to a callback, so the seam is half-built), plus a measured Graphite spike on the Pixel 7 the
bench lane already uses. The `RENDER-INST` instanced-atlas proposal that `roadmap-post-flip.md` §3
rejected as speculative re-opens **conditionally on that spike**, not before.

This also supersedes the standing "WebGPU watch list" posture: the re-evaluation trigger recorded
there has effectively fired.

### 3.2 Bet B — "the types are the editor"

The in-browser live editor is permanently ruled out (road-to-oss §0.6), which leaves the strongest
remaining move: **typed asset and content manifests generated by the CLI.**

`flare gen` emits a TypeScript union of every atlas frame name, tilemap layer, animation clip and
locale key, so a typo is a compile error rather than a silent `undefined` at runtime. **No
editor-based engine can do this** — Cocos and PlayCanvas hand the developer strings, and the editor
is what compensates. Turning the absence of an editor into a position rather than a gap is worth more
than any single feature in §3.4.

There is a concrete defect underneath it: `TilemapRenderer` resolves tilesets by *name* from a `Map`
the consumer populates by hand via `setTilesetImage`, `TilesetRef.image` is documented as "may need
resolving" with nothing resolving it, and `frameMap.get()` is stringly-typed everywhere. T7
(TM-LEVEL) already owns half of this.

Pair it with the already-fixed first post-flip arc — the devtools live-tweak inspector — surfaced as
a **VS Code extension** (ECS inspector, atlas preview, live tweak against a running app). That is an
IDE integration, not an in-browser editor, so it does not contradict the standing decision.

### 3.3 Bet C — resolved, and what it re-ranks

The strategic fork (RN product layer versus RN game engine) was put to the owner and answered in §1:
**both, with the RN ecosystem primary.** That is not a neutral outcome — it re-ranks the rest:

- **Up:** everything in §4. A third party who never files an issue is served by defaults, templates,
  error messages and stability labels, not by package count.
- **Up:** the Tier-2 product layer, because it is what the primary audience actually buys.
- **Down, but not out:** the CanvasKit web payload (§2.2 item 2) — it stops being a competitive
  problem and becomes an Arc DESK boot-time problem.
- **Unchanged:** the game tracks. A third party building a game is now an explicit goal, so
  game-facing gaps keep their weight rather than being justified only by Berek and Pan-Tvardowski.

### 3.4 The compounding middle layer

| Track | Ships as | Why | Size |
|---|---|---|---|
| **Netcode** | `@flare-engine/net` + a `net-colyseus` adapter | The largest missing *category*. Snapshot sync first, transport-agnostic; the adapter follows the `iap-revenuecat` precedent. **The determinism prerequisites already exist and are unused** — see below. | L |
| **Behaviour** | `@flare-engine/behavior` | Behaviour trees + blackboard, steering, flow fields over the existing `SolidGrid`. `pathfinding` finds the route; nothing in the engine decides to walk it. Genre-agnostic; Berek is a named consumer. | M |
| **2.5D lighting** | `@flare-engine/lighting` | [lighting-2-5d.md](../design/lighting-2-5d.md) is designed, unapproved and gated on a ~2 h spike. `createGodRays` and `createColorGradingLut` already shipped. Nobody in the RN space has this — it is the screenshot that sells the engine. | M |
| **Adaptive quality** | `@flare-engine/quality` | Device tiering + quality scaling driven by a live frame-time histogram. `createFrameBudget` already produces the histogram; this turns measurement into runtime behaviour. Directly answers the budget-Android ceiling. | S |
| **Live ops** | `@flare-engine/liveops` | Remote config, feature flags, seasons, timed events — interface + adapter, exactly like Tier-2. This is what Berek's 24 h expedition bonus and PT's economy both actually want, and it is squarely an *RN product* feature, not a game feature. | M |
| **Replay** | `@flare-engine/replay` | Record inputs, replay deterministically. One package serves ghosts, verified leaderboards, bug repro **and** the agent-QA pipeline. Unusually high leverage per line. | M |

**On the determinism prerequisites** — better than assumed, and worth stating precisely because two
tracks depend on it. `GameLoop` runs a fixed-step accumulator (`core/src/game-loop.ts:15,34`;
`clock.fixedDt`), `math` ships `SeededRNG` (mulberry32) whose `getState()` / `setState()` are
documented in-source as exactly what makes "a save file or a replay reproducible", and
`progression`'s roll APIs take caller-supplied roll values so the package is deterministic by
construction. `Math.random` appears in only three files across 41 packages. **The foundation for
replay and rollback is already in the engine and nothing uses it.**

Two donations already on file belong here too: PT's `createHeadlessContext()` (queued as `CW7-Q7`)
and its zero-allocation source-construct assertion. Both are cheap, both are offered, and the second
makes the engine's own zero-alloc rule enforceable by a gate rather than by review.

### 3.5 Cheap, days each, outsized reach

- **Distribution adapters:** Discord Activities and Poki / CrazyGames SDKs — real 2026 distribution
  channels, thin wrappers, and the only place the `render-web` tier (currently consumer-less) could
  earn its keep.
- **Concrete Tier-2 providers:** PostHog behind `analytics`; Game Center / Play Games behind
  `leaderboards` and `achievements`. The interfaces exist and have shipped since 0.1.0 with only
  `NoopProvider` behind them; Arc DESK adds the Steam pair and establishes the second precedent.
- **Playable-ad export** — a single-file, sub-5 MB HTML build. A real commercial niche, and the one
  use case that would force an honest answer to the CanvasKit payload question.
- **More `create-flare-app` templates** beyond `blank` / `topdown` / `shmup` and DESK-11's `desktop`:
  a 2.5D top-down, a puzzle grid, a card game. Templates are how a stranger starts.

---

## 4. Adoption is the post-flip constraint, not features

41 packages already exceed what a solo maintainer can market, and §1 makes strangers an explicit
audience. The work that converts a visitor into a shipped game is therefore worth more per session
than any package in §3.4. None of this is glamorous and all of it is cheap:

- **A stability tier per package** — stable / beta / experimental — with a written deprecation policy.
  `api-specs.md:301` already labels `pathfinding` "beta — no production consumer yet"; make that a
  system instead of a one-off. It buys credibility *and* it is what makes shipping experiments
  affordable, because an experiment nobody promised to support can be withdrawn.
- **Defaults and error messages as a feature.** `parseTiled` already throws actionable errors on every
  unsupported input; that standard should be the norm, not the exception.
- **Recipes over reference.** `docs/recipes/save-migrations.md` is the shape. A stranger reads a
  recipe; only a maintainer reads an API table.
- **A plugin seam** — `roadmap-post-flip.md` T6 already reduces this to the CLI seam and rejects the
  framework. That judgement holds; the seam is the part third parties need.
- **One external contributor's first PR** is a better post-flip milestone than any package. Nothing in
  the repo currently optimises for it.

---

## 5. Explicit non-goals

Named so this document cannot be read as a mandate for everything:

- **3D.** Not the market, not the moat, and it would collide with every bundle-size ceiling.
- **Consoles.** Requires a certified native runtime. Defold wins that lane; concede it.
- **An in-browser live editor.** Ruled out (road-to-oss §0.6) and it stays ruled out. §3.2 is the
  legal move.
- **Visual scripting.** The audience is TypeScript developers.
- **Any new package without a named consumer.** `roadmap-post-flip.md` §4.1 records that proposers
  ignored demand already on file; the failure mode here is the same one, one level up.

---

## 6. Relationship to the existing plan

Proposals only, all post-flip, behind the devtools inspector arc, T1–T8, and Arc DESK. This file
holds the market read and the candidate list; when a track is taken it becomes a row in
[todo.md](todo.md) with its own design doc, and this file links there rather than restating it.

Companion consumer-demand documents, which several §3 tracks are justified by:
[berek-needs-2026-09.md](berek-needs-2026-09.md),
[pan-tvardowski-needs-2026-08.md](pan-tvardowski-needs-2026-08.md),
[consumer-needs-audit-2026-08.md](consumer-needs-audit-2026-08.md).

---

## 7. Sources

Competitive claims, retrieved 2026-09-08. They decay — re-check before repeating any of them in
anything consumer-facing.

- Phaser 4 "Caladan" release and renderer: [phaser.io/news/2026/04](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games),
  [Phaser 3 vs Phaser 4](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)
- Cocos Creator platforms and Steam export: [platform support](https://www.cocos.com/en/post/what-platforms-does-cocos-creator-support),
  [exporting to Steam](https://www.cocos.com/en/post/exporting-cocos-creator-games-to-steam)
- Defold 1.13.0, platform matrix, HTML5 build size: [H1 2026 summary](https://defold.com/2026/06/30/Defold-H1-2026/),
  [defold.com](https://defold.com/)
- PlayCanvas 2.20.6, Excalibur, Kaplay, PixiJS: [web game engine comparison](https://app.cinevva.com/guides/web-game-engines-comparison)
- Skia Graphite / WebGPU direction: [Shopify Engineering](https://shopify.engineering/webgpu-skia-web-graphics),
  [Graphite status, April 2026](https://reactnativerelay.com/article/react-native-skia-tutorial-gpu-graphics-shaders-animations-expo)
- Steam from a JS/Electron shell: [steamworks.js](https://github.com/ceifa/steamworks.js/) —
  superseded for our purposes by [adr-0005](../design/adr-0005-desktop-delivery-target.md), which
  did this research properly and is the source of truth for the desktop decision
- The RN engine gap, and the RNGE / WebView / `expo-gl` / Skia figures quoted in §2.1:
  [grzegorzotto.dev](https://grzegorzotto.dev/blog/the-react-native-game-engine-gap)
