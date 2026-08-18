# Road to OSS — the single roadmap to the October 2026 public flip

**Status: ACTIVE — this is the only execution queue for the OSS launch.** Created 2026-07-03 from the
July audit corpus; every bug row below was re-verified against HEAD (file:line) on 2026-07-03 by an
independent 7-agent pass before this plan was written.

> **Filename note:** this file is named `-2026-09` for historical reasons — it predates the
> September→October schedule move. The plan is an **October** flip throughout (freeze Oct 5, flip
> Oct 20). Do not rename (≈30 inbound `road-to-oss-2026-09` references); trust the dates in the body.
> **§17 (bottom) holds the 2026-07-05 deep-audit additions** (rows B25–B31, C2–C4, Arc HYG);
> evidence ledger: `_local/deep-audit-2026-07-05.md`.

Sources (evidence ledgers, NOT queues — one source per fact):
[engine-deep-audit-2026-07.md](engine-deep-audit-2026-07.md) (bug ledger + module adjudications),
[package-findings-2026-07.md](package-findings-2026-07.md) (per-package detail),
[game-migration-audit-2026-07.md](game-migration-audit-2026-07.md) (consumer state),
[extraction-audit-2026-06.md](extraction-audit-2026-06.md) (closed; deferred slivers only).
Queue pointers live in [todo.md](todo.md); full row specs live HERE. If a row and its source audit
disagree, this doc wins (it post-dates and re-verified them).

---

## 0. Fixed decisions (do not relitigate in-row)

1. **Release = public flip, October 2026.** npm access → public on all `@flare-engine/*`, repo →
   public, docs site live at flareengine.dev. Quiet launch: no day-one marketing; announce-when-ready
   items land post-flip on the owner's schedule.
2. **License/model (updated 2026-07-03):** engine relicenses **MIT → Apache-2.0** before the flip (owner decision; adds an express patent grant + §6 trademark reservation for the "Flare Engine" name, at no adoption cost). Games are licensed separately — Pan Tvardowski stays PolyForm Noncommercial. No paid engine packages; `FUNDING.yml` tip-jar only. Add a DCO/CLA before the first external PR to keep a future dual-license open (not committing to one). **New pre-flip task:** swap `LICENSE` + the README MIT badge to Apache-2.0 and add `NOTICE` + `TRADEMARK.md`, after confirming the 3 non-owner commits are trivially relicensable.
3. **Name kept.** `flare-engine` + flareengine.dev. One-line disambiguation vs flarerpg.org ships in
   README + docs-site FAQ.
4. **Versioning: lockstep `fixed` stays** (matches `.changeset/config.json` + shipping practice since
   0.1.0). All docs claiming "independent SemVer per package" are wrong and get rewritten (D4).
   `create-flare-app` joins the fixed group (B13) so its version tracks the engine.
5. **Everything pre-flip ships as one 0.4.0** (restricted) at freeze; the peer-floor bump alone forces
   the minor. Manual-window fixes ship as 0.4.x restricted. The flip makes existing versions public;
   the first post-flip publish re-adds provenance.
   **Renumbered 2026-08-18 (owner):** this was 0.3.0 until the consumer-enablement release was
   resequenced pre-freeze ([consumer-enablement-2026-08.md](consumer-enablement-2026-08.md)). That
   cut consumes the pending changesets as **0.3.0 in August**, restricted, so the two live consumers
   bake against a real registry install for the weeks before the freeze — which leaves **0.4.0** as
   the freeze/launch cut. Every version reference in this doc, `flip-runbook.md`,
   `manual-test-protocol.md` and `SECURITY.md` was swept the same day. Two references deliberately
   kept 0.3.0: the third-party `react-native-audio-api >=0.3.0` peer floor (§5), and the MIT→Apache
   boundary (§ license) — 0.3.0 is still the first Apache-2.0 version published, which the August
   cut makes true rather than false.
6. **Module adjudications (from the deep audit, owner-ratified):** planck.js rigid-body = post-flip,
   opt-in package (`planck` v1.5.x, never `planck-js`); C++/Nitro = no (perf gate untripped);
   devtools live-tweak inspector = first post-flip arc; in-browser live editor = never (playground +
   inspector instead); Tiled 1.12.x = primary authoring story, LDtk secondary.
7. **PT stays the private commercial game.** Public-facing showcase links point at the docs site,
   never at the game's private repo (D2–D4 rewrite those links). If the owner later flips PT public,
   that's independent of this plan.
8. **Public positioning (2026-07-03):** lead with "a 2D engine that runs the same code on Web + React Native — animation, gamification, interactive UI, and games"; drop "first full-stack RN game engine"; not a Unity/Godot/Unreal competitor. Games are showcases — Pan Tvardowski (private commercial), Berek (a ~342-LOC tilemap proof), and a planned platformer. SEO/a11y proof is DOM/CSS-transform output (the portfolio page-collapse), NOT the CanvasKit canvas demos (canvas pixels aren't indexable).

## 1. Dates and capacity

| Milestone | Date | Meaning |
|---|---|---|
| Plan accepted, hygiene arc starts | week of **Jul 6** | OSS-A0 + Arc B begin |
| Arc B (bugs) done | ~**Aug 28** | all P0/P1 bug rows landed |
| Arc C + M (packaging + modules) done | ~**Sep 18** | 0.4.0 feature-complete; Arc D may start during the M tail |
| Arc D + E (truth pass + governance) done | ~**Sep 29** | docs describe reality |
| Arc F (rehearsal + runbook + audits) done | ~**Oct 2** | flip mechanics proven on verdaccio |
| **FREEZE + 0.4.0 restricted publish** | **Mon Oct 5** | code-complete; only manual-test fixes after |
| **Manual test window (owner)** | **Oct 5 – Oct 18** | the requested two weeks; protocol in §11 |
| **Flip week** | **Oct 19 – Oct 23** (target Tue Oct 20) | runbook execution, §12 |
| Buffer | after the actual flip day → Oct 28 | absorbs slip while staying "October" |

**Capacity assumption:** engine gets ~5 agent sessions/week of the owner's four-project split
(June ran ~45 sessions across repos, so this is the historical norm, not a stretch). The P0+P1 set
is ~56 rows and **~49–58 sessions** (base P0+P1 ≈46 rows + the 2026-07-05 audit's B25–B31 / C2–C4;
≥1 session/row is the floor, so the old "42" was arithmetically impossible; B8/B14/M1 are two-session,
and B13/C1/M2/M5/D5/F2/C3/C4 run 1–2). Against ~5/wk × 13 wk ≈ 65 available it lands by Oct 5 with a
**thin** margin, not a comfortable one — Arc HYG and most P2 are post-flip unless the calendar runs green. So:

- **~5 sessions/wk is the no-slip path** — P0+P1 lands by Oct 5 (using the table's
  D-starts-during-the-M-tail overlap when needed); the P2 rows (B18, M7–M11) get squeezed in only
  if the calendar stays green.
- ~4/wk → P2 moves to the post-flip backlog untouched **and** either Arc D starts during the M tail
  (the table already allows it) or freeze slips one week (Oct 12, flip Oct 26–28). **The flip does
  not need P2.**
- <3/wk by mid-September → freeze Oct 12 + P2 cut + demote M3, M4 and B16 (named P1 demotions — none
  is flip-critical) to post-flip. Still October. Never compress the two-week manual window.

## 2. Execution contract (read before running any row)

Every row below is sized for the existing `/start` → per-row gate → `/close` loop.

**Routing.** Rows whose scope is `packages/**` (+ `docs/design/api-specs.md`) route
**engine-builder** as usual. Rows that touch root docs, `docs/design/architecture.md`, `scripts/`,
`.changeset/`, `.github/`, `.claude/`, or `docs/plans/` are tagged **[main-thread]** and run in the
orchestrating session directly (engine-builder's scope guard forbids those paths — do NOT relax the
guard); the per-row gate + commit-block discipline is identical. Mixed rows name the split inline.
[main-thread] rows: A0, B13 (the `.changeset` edit only), D1, D4, D5, E1, F1, F2, F3, F4, H1, H2,
I1, I2.

**Multi-session rows** name their seam (a/b sub-rows); each sub-row closes gate-green with its own
commit block — never leave a half-row uncommitted across sessions.

1. Read `docs/design/api-specs.md` for the touched packages before coding; update it + the package
   README in the same row when the public surface changes (that's part of "done", not a follow-up).
2. Repo rules apply unweakened: no `any`/`@ts-ignore`, named exports, factories over classes,
   zero-alloc in `update()`/`render()` paths, `import type`, real behavioral tests
   (no `toBeDefined`, no self-parity oracles — known-answer or fail-old/pass-new).
3. Full gate green per row (`lint → typecheck → test → build` via verify.sh) **plus** root
   `tsc -p tsconfig.json` (test files) and biome on changed `tests/`/`scripts/` (the two known gate
   blind spots).
4. Public-surface changes are allowed without back-compat shims — every pre-1.0 minor from 0.2.x
   on is a sanctioned breaking window. Record every intentional break in the row's todo entry on completion (the launch-cut
   changelog is assembled from those).
5. No changesets per row; one minor changeset lands in OSS-H1 (lockstep). No publishes mid-arc —
   **exemption:** F2's local-verdaccio publishes (registry-scoped, discarded) and I1's flip-day
   publishes (runbook-governed).
6. Builders never run git; commit blocks come from `/close` as usual. F2 and I1 are owner-paired
   sessions where the owner runs the git/publish steps the runbook or row names.
7. If a row's cited file:line has drifted, trust the row's *intent*, find the real site, and note the
   drift — do not skip the row. Every site below was verified at HEAD on 2026-07-03.

---

## 3. OSS-A0 — immediate hygiene (week 1, before everything else)

### OSS-A0 · repo hygiene + private-docs split (P0, 1 session, [main-thread])

**Scope:** `.gitignore`, `.claude/skills/retro/SKILL.md`, `docs/plans/`, `packages/testing/package.json`, `packages/share/package.json`.

- `.gitignore`: add root-scope `.npmrc`, `.env*` (keep the existing `apps/*/.env.testingbot` line),
  and `docs/plans/_local/`.
- Create `docs/plans/_local/` and **move the two untracked private strategy notes into it** (kept
  out of the repo by policy — they are the two docs/plans files that are neither this file nor the
  three technical audits). Fix the resulting companion links in `engine-deep-audit-2026-07.md`
  (point at this doc instead). `engine-deep-audit-2026-07.md`, `package-findings-2026-07.md`,
  `game-migration-audit-2026-07.md` and this file are technical and get committed.
- **Public-safety sweep of the committed audits** (they go public with the repo): in
  `engine-deep-audit-2026-07.md` replace the three publish-credential passages (`:9`, `:46`, `:118`)
  with "the publish credential needed rotation before the window (owner action, tracked privately)"
  — no set dates, no expiry arithmetic, no privilege class; `:47` → "decide fate of the two
  untracked private strategy notes (kept out of the repo)"; `:55` → "FUNDING.yml (tip-jar)"; `:112`
  → delete the business-model parenthetical (keep "Excalibur on cadence + a services company." as
  plain market fact only if stripped of the self-referencing clause). In
  `package-findings-2026-07.md:150` soften the portfolio note to "copy needs updating to match
  reality". Then commit all three technical audits.
- Scrub absolute local paths: `.claude/skills/retro/SKILL.md:21-23` (rewrite `c:\_PROG\...` /
  `C:\Users\...` as workspace-/HOME-relative); `docs/plans/todo.md:44` and `:112` (rewrite the two
  archival `C:\_PROG\...` references generically).
- Fix wrong homepages: `packages/testing/package.json:8` and `packages/share/package.json`
  `homepage` → `https://github.com/grzott/flare-engine#readme` (both currently `grzott/engine`).
- **Do NOT** "fix" `.changeset/config.json`'s ignore of `@flare-engine/benchmarks` — that package
  exists at `benchmarks/` (workspace member, private) and the ignore is correct.

**Done when:** `git status` shows the two private notes untracked-and-ignored; a sweep of COMMITTED
`docs/plans/*.md` finds zero mentions of credential privilege classes, auth-token literals, token
expiry arithmetic, or monetization vocabulary (excluding this paragraph itself), and `NPM_TOKEN`
appears only as the plain CI secret name in archival todo rows (it is already public in
`release.yml`) — never with expiry/privilege/location detail; grep for `C:\` in `.claude/skills` +
`docs/plans/todo.md` is clean; gate green (docs/config only).

---

## 4. Arc B — verified-bug fixes (all sites re-verified at HEAD 2026-07-03)

Order within the arc = the order below (B1/B2 first: other rows' tests lean on events/ecs).

### OSS-B1 · events: emit hardening (P1, 1 session)

**Scope:** `packages/events/src/signal.ts`, `emitter.ts`, tests.
`signal.ts:39-50` + `emitter.ts:54-71`: emit sets `iterating=true`, loops, resets, flushes
`pendingRemove` — no try/finally, and nested emit resets the flag early.

- Replace the boolean with a **depth counter**: `iterating++` on entry, `finally { iterating--; if (iterating === 0) flushPending(); }`.
  A throwing handler must not wedge deferred removal; a nested emit must not flush mid-outer-loop.
- Handlers added during emit currently run in that same emit (live Set iteration) and the "we iterate
  a copy" comment is false. **Keep** live-set semantics (a snapshot allocates per emit — banned on
  this 5×/frame path); fix the comment and document the semantics in both docstrings + README.
- Do not fix the rest-args allocation here (post-flip hot-path arc); do not change emit signatures.

**Done when:** tests pin (a) throwing handler → `off()`/`remove()` still effective next emit,
(b) nested emit + removal correctness, (c) added-during-emit runs same-emit (documented semantics),
zero new allocations on the emit path.

### OSS-B2 · ecs: query disposal + entity iteration (P1, 1 session)

**Scope:** `packages/ecs/src/world.ts`, `query.ts`; consumers `packages/testing/src/scene-snapshot.ts`, `packages/devtools/src/hooks.ts`.
`world.ts:110-124` + `:155-161` push queries permanently (no removal API);
`testing/scene-snapshot.ts:25-31` leaks N+1 permanent queries per `serializeScene` call;
`devtools/hooks.ts:26` casts `world as unknown as {nextId}` to enumerate entities.

- Add `World.removeQuery(q)` and a zero-alloc public entity walk — `forEachEntity(cb: (e: Entity) => void)`
  (walk live archetypes; no array snapshot) + `entityCount` getter. Cover `_WorldQueryBuilder.build`
  (`world.ts:175-179`) too.
- `serializeScene`: memoize its queries per world (`WeakMap<World, Query[]>` — the pattern already
  shipped in `packages/testing/src/define-snapshot.ts`), now also disposable; kill the redundant
  ALL query.
- `devtools/hooks.ts`: replace the `nextId` cast + scan with `forEachEntity`; delete the "may land in
  0.2.0" comment.
- README: the "per world" 32-type cap claim is a separate known drift — fix the sentence while in-file
  (cap is module-global) but do NOT redesign the cap here.

**Done when:** dispose test (removed query stops updating and no longer costs spawn-time iteration),
iterator test (sees all alive entities across archetype moves + after removals), serializeScene
no longer grows `world.queries` across repeat calls (regression-pinned), devtools inspector lists
real entities without the cast.

### OSS-B3 · share: screenshot format codes (P0, 1 session)

**Scope:** `packages/share/src/capture.ts`, tests, README.
`capture.ts:41` ships `FORMAT_CODES = { png: 3, jpeg: 2 }`; real RN-Skia `ImageFormat` is
`JPEG=3, PNG=4, WEBP=6` — png silently emits JPEG bytes, jpeg passes 2 (kICO → null).

- Fix to `{ png: 4, jpeg: 3 }`. Add a **contract test against the real dependency's enum** (import
  `ImageFormat` from `@shopify/react-native-skia`'s types in the workspace and assert equality — the
  fakes-can't-catch-this class; if a runtime import drags RN, pin the literal values with a
  version-stamped comment and a test that reads the installed `.d.ts` text).
- Same row, same file cluster: `canShare` hardcodes `'screenshot.png'` even for jpeg — derive the
  extension. Fix the README payload-field drift for this package now (don't wait for Arc D).
- Out of scope (post-flip): native transport dropping `payload.screenshot`, ScreenshotTarget dims.

**Done when:** contract test locks the mapping to RN-Skia's real values; jpeg/png byte-type test via
the existing fake updated to the corrected codes; README example compiles.

### OSS-B4 · render: camera-rotation contract (P0, 1 session)

**Scope:** `packages/render/src/renderer.ts`, `frame-renderer.ts`, `packages/render-web/src/web-surface.ts`, `web-skia-module.ts`, `docs/design/api-specs.md:295`, tests.
The live defect is `renderer.ts:91` — `applyCamera` passes **radians** (`camera2d.ts:116`) to
`c.rotate(...)`, but both real backends (RN-Skia SkCanvas, CanvasKit) take **degrees**. The web
bridges (`web-surface.ts:42`, `web-skia-module.ts:89`) forward verbatim by deliberate choice
("dormant mismatch" comments); `frame-renderer.ts:120-121` doc says "web shims must convert";
api-specs.md:295 claims the web module converts. `packages/shapes` converts correctly at its own
call sites (`draw.ts:183` etc.) — it is the reference behavior and needs no change.

- **Decision: `CanvasLike.rotate` / `DrawSurfaceLike.rotate` contract = DEGREES, pass-through
  everywhere.** Convert once at the camera seam: `applyCamera` → `c.rotate((-rotation * 180) / Math.PI, cx, cy)`.
- Update the `frame-renderer.ts:120-121` interface doc (degrees, no shim conversion), delete the
  dormant-mismatch comments in both render-web files (verbatim is now correct), fix api-specs.md:295.
- Grep every `\.rotate(` caller of `CanvasLike`/`DrawSurfaceLike` across `packages/**` and confirm no
  other radians caller remains (shapes drives real Skia canvases directly — out of contract, leave).
- Parity test: extend the render-web CPU-surface readback conformance test with a camera rotated
  `Math.PI/2` — assert the sprite lands in the rotated quadrant. Native side: unit-test the degrees
  math in `applyCamera`.

**Done when:** nonzero `Camera2D.rotation` renders identically-intentioned on both backends
(readback-proven on web), docs and code agree on the unit at every layer.

### OSS-B5 · scene: restart + async preload (P0, 1 session)

**Scope:** `packages/scene/src/scene-manager.ts`, tests.
`scene-manager.ts:57`: `go(currentSceneName)` fetches the cached instance (`_getOrCreate`,
`:139-140`), destroys it (`:67` → map deletes at `:176-185`), then reactivates the destroyed
instance with its stale World. Transition path identical (`:62`, `:202-208`, `:218`).
`:215`: transition branch fires `pending.onPreload?.()` without await (`_initIfNeeded` at `:156`
awaits — inconsistent).

- Reorder: destroy/evict the current scene **before** `_getOrCreate`, so restart constructs a fresh
  instance with a fresh World/Camera2D (`:147-148` path).
- Make the transition sequence await `onPreload` before `onInit`/`onEnter` (preload during fade-out
  is fine; entering before assets resolve is not). Keep the instant path's semantics aligned.
- While in-file: `go(unknownName)` currently no-ops silently — add a dev-mode diagnostic (warn
  naming the unknown scene + registered names).
- Do not add pause/resume or push/pop transitions (post-flip).

**Done when:** restart test — spawn entities, `go(sameScene)`, assert fresh World (entity count 0,
new instance identity); async-preload test — slow `onPreload`, assert `onInit`/`onEnter` ordering.

### OSS-B6 · storage: import safety + migration honesty (P1, 1 session)

**Scope:** `packages/storage/src/storage.ts`, `migrations.ts`, tests.
`storage.ts:132`: `adapter.clear()` runs before per-entry validation (`:133-137`) — a bad payload
wipes storage. `migrations.ts:13-15` doc claims throws-on-gap; `:27-43` validates only
positive-integer + duplicates and silently skips gaps.

- `importJSON`: validate the complete payload (top-level `:122-130` AND every entry) **before**
  touching the adapter; only then clear+write. Bad payload → typed error, storage untouched.
- `runMigrations`: implement the documented contract — throw on version gaps and on `to` lower than
  the highest migration. (`defineMigrationChain` already enforces; this aligns the loose path.
  PT no longer consumes migrations (save redesign SV1) — no consumer risk.)

**Done when:** corrupt-payload test proves storage untouched after failed import; gap test throws
with a message naming the missing version.

### OSS-B7 · core + particles: loop alpha, pool caps, seeds (P1, 1 session)

**Scope:** `packages/core/src/game-loop.ts`, `pool.ts`, `packages/particles/src/particle-pool.ts`, `particle-emitter.ts`, tests.
`game-loop.ts:96-120`: interpolation alpha (`accumulator/fixedDt`) computable but private — the
classic missing piece, prerequisite for any physics interpolation. `pool.ts:23-28`: `acquire()`
falls through to `factory()` — no cap. `particle-emitter.ts:61-63`: ctor `maxParticles` only sets
prewarm; `:73/:88` gate only on `config.maxParticles`; `:59` LCG seed hardwired `_seed = 1`.

- `GameLoop`: expose `get alpha(): number` (post-step residual fraction, 0 when no fixed step
  configured). Document in api-specs (physics-interpolation note).
- `core.Pool`: optional `capacity` + new `tryAcquire(): T | null`. `acquire` keeps its current
  pop-or-create-via-factory behavior (it never throws and may exceed capacity — unchanged);
  capacity is enforced ONLY by `tryAcquire` returning null at cap. Dev-mode double-release guard.
- particles: ctor `maxParticles` becomes the enforced cap (wire into both gates; emitter skips spawn
  when the pool is at cap); seed injectable (ctor option + `reseed(seed)`), default stays 1.
- Do NOT build emitter shapes / render adapter here (that's M8).

**Done when:** alpha test (fixed-step accumulator residual exact), cap test (spawns past prewarm
never exceed cap, zero allocation past cap), determinism test (same seed → identical burst).

### OSS-B8 · tilemap: GID flip bits + LDtk pipeline (P0 — the authoring story depends on it, 2 sessions: B8a Tiled flip-bits + validation, B8b LDtk pipeline)

**Scope:** `packages/tilemap/src/tiled-parser.ts`, `ldtk-parser.ts`, `tilemap-data.ts`, `tilemap-collider.ts`, tests with real fixtures.
No flip-bit mask anywhere (`0x1FFFFFFF` grep = zero hits): `tilemap-data.ts:142-153`
`getTilesetForGid` compares raw GIDs, so flipped tiles resolve to the LAST tileset and lose solid
flags (`tilemap-collider.ts:59-60`). LDtk: `ldtk-parser.ts:216` stores `ti.t + 1` ignoring the
layer's tileset while firstGids assign sequentially (`:130-153`) — all tiles land in the first
tileset's GID space; `:149` gives every tileset an empty `solidTiles`; IntGrid (`:180-200`) never
marks solids → `extractColliders` returns `[]` for every LDtk map.

- Tiled: define `const GID_FLIP_MASK = 0x1fffffff`; mask at every GID consumer (tileset resolve,
  local-id compute, collider check, renderer UV lookup). Preserve the 3 flip bits on the tile record
  (typed flags) — the renderer may ignore them for now (documented limitation; render flip support
  is M10/post-flip), but colliders and tileset resolution must be correct.
- LDtk: resolve each tile through its **layer's** tileset (`__tilesetDefUid` → firstGid), make
  firstGid assignment deterministic (sort tilesets by uid), populate `solidTiles` from IntGrid
  (value > 0 = solid by default, predicate configurable).
- Parser validation (dev-facing honesty): `parseTiled` throws descriptive errors on base64/infinite/
  external-tsx maps instead of failing silently; `parseLDtk` equally on unsupported features.
- Fixtures: a real two-tileset Tiled map with H/V/D-flipped tiles; a real two-tileset LDtk map with
  IntGrid walls. Assert tileset resolution, collider extraction non-empty and correct, flip flags.

**Done when:** flipped tiles resolve the correct tileset + keep colliders; LDtk maps produce
non-empty correct colliders; unsupported formats throw with actionable messages.

### OSS-B9 · deep-links: scheme-URL parsing (P1, 1 session)

**Scope:** `packages/deep-links/src/parse.ts`, README, tests.
`parse.ts:23-35`: after `://` the first token becomes `host`, so `myapp://zone/4` yields
host `zone`, segments `['4']` and `/zone/:id` never matches (`router.ts:36,69`) — the standard RN
Linking shape, and the README example itself demonstrates the broken pattern.

- For custom (non-`http`/`https`) schemes, treat everything after `://` as path (`host = ''`).
  Keep host parsing for `http(s)` universal links. Fix the README example + the wrong 2-arg
  constructor shown there.

**Done when:** `myapp://zone/4` matches `/zone/:id` with `id === '4'`;
`https://example.com/zone/4` still parses host `example.com`; README example is a passing test.

### OSS-B10 · dialogue: dangling ids + cycles (P1, 1 session)

**Scope:** `packages/dialogue/src/runner.ts`, tests.
`runner.ts:93-96`: missing node id → silent `end()`. `:164` + `:179`: branch/action recursion with
no cap — a content cycle overflows the stack (worst failure mode for content authors).

- Dangling id: dev-mode diagnostic before ending — add an optional `onError(err: DialogueError)`
  hook on the runner config; default behavior logs a console.warn naming the node + missing id,
  then ends (unchanged outcome, now visible).
- Cycles: convert the processNode/processBranch/processAction recursion into an iterative loop with
  a per-advance step budget (e.g. 1000) → throw a descriptive error naming the repeating node chain.

**Done when:** dangling-id test observes the diagnostic; `A→B→A` cycle test gets a typed error, not
RangeError; existing runner suite untouched-green.

### OSS-B11 · physics + input: small correctness traps (P1, 1 session)

**Scope:** `packages/physics/src/collision-world.ts`, `spatial-index.ts`, `packages/input/src/pointer.ts`, tests.
`collision-world.ts:76-79`: `add()` overwrites the Map entry but unconditionally `spatial.insert`s —
re-adding an entity leaves a stale duplicate broadphase record (`spatial-index.ts:26-34` always
pushes; remove/update only hit the first match). `pointer.ts:63-68`: same-frame moves overwrite
`delta` (doc at `:7` says per-frame delta ⇒ accumulate).

- `CollisionWorld.add`: on existing entity, update in place (remove-then-insert or an
  `entries.has()` branch routing to the update path). Add a broadphase-size regression test.
- `Pointer`: accumulate `delta += segment` across a frame; `resetPointerFrame` (`:42-47`) already
  zeroes it.

**Done when:** double-add test keeps exactly one broadphase record and collisions stay correct;
multi-move-per-frame test sums deltas.

### OSS-B12 · iap-revenuecat: money-path fixes (P0, 1 session)

**Scope:** `packages/iap-revenuecat/src/provider.ts`, local SDK structural types, tests.
`provider.ts:41`: restore maps `entitlements.all` (includes expired) → re-grants lapsed subs; the
local structural SDK type doesn't even model `.active`. `:150-181`: unsubscribe is broken both ways
— pre-resolution it no-ops while the pending `.then` still adds the listener (leak); post-add it
sets `listener = null` at `:178` synchronously before the async remove at `:175` dereferences it →
`removeCustomerInfoUpdateListener(null)`. `:118`: purchase tx id = `originalPurchaseDate` string.

- Extend the structural SDK type with `entitlements.active`; restore maps **active only**.
- Listener lifecycle: keep the real listener in a local `const` captured by the removal call; a
  cancelled flag makes a pre-resolution unsubscribe suppress the pending add; null out only after
  removal completes. Unsubscribe must be idempotent.
- Tx id: prefer a real transaction identifier if the structural type can carry one
  (`transactionIdentifier?`); if RevenueCat's customer-info shape genuinely lacks it at this SDK
  surface, keep the date fallback but rename/document it honestly (`lastPurchaseAt`-style, not `id`).
- `getProducts`/`restore` currently swallow all errors into `[]` — add an optional `onError` hook
  (default: keep returning `[]`, now observable).
- While in the listener range: customer-info updates currently emit only `entitlements[0]` — emit
  every entitlement per update (or document single-emission as intended; prefer emitting all).

**Done when:** fake-SDK tests — expired entitlement NOT re-granted; unsubscribe before and after SDK
resolution both result in zero live listeners; double-unsubscribe safe; error hook observes failures.

### OSS-B13 · cli + create-flare-app: mechanics (P0, 1-2 sessions — seam: "both CLIs versioned + spawns fixed" / "tiled-to-flare + template packlist"; the `.changeset` edit is [main-thread])

**Scope:** `packages/cli/src/cli.ts`, `tiled-to-flare.ts`, `packages/create-flare-app/src/cli.ts`, `scaffold.ts`, `.changeset/config.json`, tests.
Verified: `create-flare-app/src/cli.ts:31-36` never passes `flareVersion` → `scaffold.ts:149` stamps
`^0.0.0` (in shipped dist too); both CLIs hardcode `.version('0.0.0')` (`cli.ts:25` / cli `cli.ts:36`);
Windows spawns EINVAL on Node ≥20.12 (`scaffold.ts:98-104` `${pm}.cmd` shell:false; cli `cli.ts:93-98`
`npx.cmd` shell:false); `tiled-to-flare.ts:164-167` default out path embeds the absolute input path
inside `join()` → ENOENT without `-o`; `scaffold.ts:19` doc names a `__FLARE_VERSION__` token that is
actually `{{FLARE_VERSION}}`.

- **Version single-source:** add `create-flare-app` to the changeset fixed group
  (`"fixed": [["@flare-engine/*", "create-flare-app"]]`) AND hand-bump its `version` to the current
  engine version (0.2.1) in the same commit — joining the group does not rewrite existing versions
  (alignment applies only from the next `changeset version` run, i.e. H1). Both CLIs read their
  real version from their own package.json at build time (tsup `define` or a generated const — no
  runtime fs read). Scaffolder stamps `^<own version>` as `{{FLARE_VERSION}}`.
- **Windows spawn:** `spawn(cmd, args, { shell: process.platform === 'win32' })` with args
  validated — project name already constrained? If not: enforce `/^[a-z0-9@/_-]+$/i` on the name
  before any shell-mode spawn (injection guard). Same fix in both packages.
- `tiled-to-flare` default out: `join(dirname(inputPath), basename(inputPath).replace(/\.(tmj|json)$/i, '') + '.flare.json')`.
- Fix the `__FLARE_VERSION__` doc comment; fix the negative token-replacement tests that assert the
  wrong syntax (currently vacuous).
- Rename each template's `.gitignore` → `gitignore` (npm packlist strips dotfiles from the published
  tarball); scaffolder renames it back on copy.
- Keep `"private": true` on create-flare-app until the flip (runbook flips it — prevents accidental
  publish); `publishConfig.access` is already `public` there, correct.

**Done when:** scaffold test asserts the stamped range equals `^<package version>` (which is
`^0.2.1` after the hand-bump, `^0.4.0` after H1 — assert against the live package.json, never a
literal);
`--version` prints the real version (both CLIs); spawn paths covered by a platform-matrix unit test
(win32 shell:true / posix shell:false); tiled-to-flare without `-o` writes next to the input;
template tarball packing test (npm-packlist or `bun pm pack` on the package) contains `gitignore`.

### OSS-B14 · create-flare-app: template honesty (P0, 2 sessions: B14a shmup rebuild / B14b blank + deps + pins + template-typecheck tests)

**Scope:** `packages/create-flare-app/templates/{blank,shmup,topdown}/**`, `src/manifest.ts`, template tests.
Verified in the audit (topdown is the one honest template): shmup spawns Position-only entities
(black screen), leaks bullets (never despawned), allocates in `onUpdate`; blank's promised "single
sprite" is absent; `react-native-safe-area-context` missing from template deps; exact heavy pins
(skia 2.4.18 / RN 0.83.4 / expo 55) will rot; topdown `App.tsx:58` ships the repo's only
user-visible `as unknown as` cast.

- **shmup**: make it render and play at template scale — player sprite + joystick move + autofire +
  a simple enemy spawner + collision kill + score text, using engine systems (`createMovementSystem`,
  `createLifetimeSystem`/`createBoundsCullSystem` for bullet despawn — engine-first, no template-local
  re-impl), zero-alloc `onUpdate` (pre-created queries, pooled spawns). It must visibly match its
  manifest line or the manifest line gets softened — prefer making it true.
- **blank**: render the promised single centered sprite via `createProceduralAtlas`.
- All three: add `react-native-safe-area-context`; refresh pins to the §5 target stack
  (Expo SDK 57 / RN 0.86 / React 19.2 / RN-Skia 2.6.x — C1 later validates the same floors; exact
  pins re-checked once at freeze, §11); remove the topdown `as unknown as` cast (type the boundary
  properly).
- Template tests: keep token/structure tests; add per-template "compiles" coverage — typecheck each
  template's `App.tsx` against workspace packages (the topdown tilemap tests are the model).

**Done when (in-row):** template tests typecheck all three against the workspace engine; a written
per-template behavior checklist (what must be visible on screen) is reviewed against the code; no
`onUpdate` allocations in shmup (reviewed, not just asserted). The owner's on-device `expo run`
verification is deliberately deferred to §11 item 1 — not this row's gate.

### OSS-B15 · ui: reactive focus (P1, 1 session)

**Scope:** `packages/ui/src/focus-provider.tsx`, `button.tsx`, tests.
`focus-provider.tsx:15-26`: context value is the identity-stable manager, and the internal
subscribe+force at `:19-23` only re-renders the provider whose `children` element is
reference-identical → React bails out; `button.tsx:46` reads focus at render with no subscription.
Focus rings never repaint — the README's keyboard/gamepad navigation claim is visually dead.

- Publish `{ manager, focusedId }` as context **state** (subscription updates `focusedId` via
  `setState`) so consumers re-render on focus moves; `Button` derives `focused` from context.
- Replace the 12 `typeof`-shell primitive tests with behavioral ones for focus (focus move →
  Button's rendered props change), using the self-contained stateful-hook mock pattern shipped in
  `packages/react/tests/overlay-hooks.test.ts` (no real renderer in this repo; Bun `mock.module`
  is global and last-writer-wins — keep the mock self-contained).
- The input **driver** (arrow/tab moving focus) is M1b, not here.

**Done when:** focus-move test proves a consumer re-render with the new focused id; no provider-level
force-render hack remains.

### OSS-B16 · react: GameView per-frame churn (P1, 1 session)

**Scope:** `packages/react/src/game-view.tsx`, tests.
`game-view.tsx:177-179`: `setPasses(built)` unconditionally every frame with a fresh array from
`buildPostFxPasses` (fresh `[]` even for the empty chain — `frame-renderer.ts:823-831`), defeating
bailout; `:235-237` re-creates `RuntimeShader` elements every render; 4 inline handlers + style
array per render.

- `setPicture` per frame is the RN-Skia render model — keep.
- Gate `setPasses` on a shallow signature (length + per-pass id + shader ref); empty chain → one
  module-level `EMPTY_PASSES` constant. Memoize the `RuntimeShader` element array from the `passes`
  state; hoist the 4 handlers (`useCallback`) and the style array (`useMemo`).
- Tests with a controllable fake rAF (model: `packages/react/tests/overlay-hooks.test.ts`): frame
  ticks with an unchanged chain cause zero `setPasses` calls after the first; empty-chain mounts
  never re-render from passes; changed chain still propagates.

**Done when:** render-count assertions pass fail-old/pass-new (write the old-behavior test first);
no behavior change to postfx output (existing suite green).

### OSS-B17 · audio: kill the dead API + false claim (P1, 1 session)

**Scope:** `packages/audio/src/sfx-pool.ts`, `audio-manager.ts` (docs only), README, `docs/design/api-specs.md:140`, tests.
`sfx-pool.ts:8` declares `rate?` that `play()` (`:72-126`) never applies; README:3 + api-specs:140
claim auto-suspend on background — zero AppState/visibilitychange wiring exists (suspend is manual,
`audio-manager.ts:85`).

- Implement `rate`: extend the structural source-node type with optional
  `playbackRate: { value: number }` (Web-Audio shape `react-native-audio-api` mirrors); apply when
  present, ignore when the injected node lacks it. If implementation proves unsound against the
  structural types, DELETE the option instead — no dead API ships.
- Replace the auto-suspend claim in README + api-specs with the honest manual recipe: a short
  `AppState`/`visibilitychange` → `suspend()`/`resume()` snippet.
- Clean the `onended` readonly-cast noted in the findings ledger while in-file.

**Done when:** rate test (fake node observes `playbackRate.value`; node without the field → no
throw); README/api-specs no longer claim auto-suspend; audio README's three wrong example counts
fixed (this row owns the audio README end-state; Arc D skips it).

### OSS-B18 · pathfinding: heap integrity (P2 — cuttable, 1 session)

**Scope:** `packages/pathfinding/src/astar.ts`, `jps.ts`, README, tests.
`astar.ts:163` / `jps.ts:117`: heap capacity `min(total, 4096)` with no growth; `heapPush`
(`astar.ts:69-86`, `jps.ts:31-46`) writes OOB silently (typed arrays) while `size++` — past 4096
open entries the open set corrupts (NaN bubbles).

- Grow the heap arrays (double on `size === capacity`, copy into new Float64Array/Int32Array) —
  amortized, allocation only at growth, never per-push.
- Document the A*-blocks vs JPS-permits corner-cutting divergence (README + api-specs) — do not
  rewrite JPS corner rules here.
- Label the package honestly wherever it's listed (root README package table row + package README):
  "beta — no production consumer yet". The phantom documented signatures get fixed in Arc D.
- **Cut rule:** if the calendar is red, ship ONLY the honesty label pre-flip; heap fix lands 0.4.x.

**Done when:** worst-case fixture (open-set > 4096 — e.g. a large serpentine maze) returns a valid
optimal path with no NaN; growth covered by a unit test on the heap primitive.

### OSS-B19 · postfx: correctness slivers + public-surface scrub (P1, 1 session)

**Scope:** `packages/postfx/src/`, README, tests.
From the findings ledger: array-uniform truncation (the documented-workaround bug from the launch
audit); weather `speed`/`direction` uniforms are silent no-ops; the first-compile `console.info` is
unsilenceable; controller doc comments cite the private game / "Phase 11.14" / session numbers in
the public surface.

- Fix the array-uniform truncation so full-length uniform arrays reach the shader (regression test
  with a >4-element array).
- Weather uniforms: wire `speed`/`direction` for real or remove them from the public type — no
  silent no-ops ship.
- Gate the compile `console.info` behind a dev/verbose flag.
- Scrub game/session/phase vocabulary from all shipped doc comments (public `.d.ts` must be
  project-neutral — same standard XP8 enforced).
- Out of scope: per-frame `buildPass` allocation (post-flip hot-path arc), README examples (D3).

**Done when:** uniform-array regression test green; grep for `PT|Phase 11|session #` over
`packages/postfx/src` returns zero; weather uniforms either observable in output or gone.

### OSS-B20 · ui-shop: name collision + purchase-flow guard (P1, 1 session)

**Scope:** `packages/ui-shop/src/`, README, api-specs, tests.
From the findings ledger: `ShopPanel` collides with ui's different `ShopPanel` (two exports, same
name, different APIs — must be resolved inside the pre-1.0 breaking window, after which it's frozen);
`PaywallModal.tsx:71` lets the backdrop dismiss mid-purchase (only the buttons are gated).

- Rename ui-shop's component (recommend `ShopScreen`; keep a deprecated alias export only if the
  rename would break PT — check PT's imports via its public dep usage, and note the break in the
  launch-cut changelog either way).
- Gate backdrop dismissal on the same in-flight-purchase state that gates the buttons.
- Replace the self-parity tests touched by the rename with behavioral ones (purchase-in-flight →
  backdrop press is a no-op).

**Done when:** no duplicate export names across ui + ui-shop (grep-proven); mid-purchase dismissal
impossible in test; changelog note recorded in the todo row.

---

## 5. Arc C — packaging correctness (the 0.4.0 shape)

### OSS-C1 · peer-dependency bump + skia decoupling + render-web export (P0, 1-2 sessions — seam: C1a manifests + render-web export / C1b validation fixtures; runs after B14)

**Scope:** all `packages/*/package.json` with peers, `packages/render-web/src/index.ts`, `docs/design/api-specs.md`, README notes; validation scaffold.
Verified matrix (2026-07-03): react `>=18.0.0` in exactly 12 pkgs (achievements, analytics, devtools,
engine, errors, haptics, iap, iap-revenuecat, leaderboards, react, ui, ui-shop); react-native in 5
(devtools/engine/react/ui `>=0.73.0`, ui-shop `>=0.74.0` outlier); skia `>=1.0.0` in 6 (assets,
engine, postfx(optional), react, render, shapes) with **zero runtime imports in render/assets and a
single type-only import in shapes** (`draw.ts:11`); gesture-handler `>=2.0.0` dead weight in
input/react/engine (zero references); safe-area-context imported only by react
(`game-view.tsx:22`, peer `>=4.0.0` declared only there) while engine re-exports react without
declaring it; render-web canvaskit `>=0.40.0` already optional.

July-2026 reality (fact-checked 2026-07-03): RN-Skia 2.x requires react ≥19 and **RN ≥0.79** (Skia
≤1.12.4 for RN ≤0.78 — so ≥0.78 + Skia ≥2 is self-contradictory); current Skia 2.6.6; Expo SDK 57
(shipped 2026-06-30) = RN 0.86 / React 19.2.

- Floors: react `>=19.0.0` (all 12); react-native `>=0.79.0` (all 5 — normalizes the ui-shop
  outlier; corrected from 0.78 per §16); `@shopify/react-native-skia` `>=2.0.0` where kept.
- Skia peers: **drop** from render and assets (zero imports — move to devDependencies if their tests
  need types); **optional** (peerDependenciesMeta) in shapes with a "types-only" README note; keep
  required in react + engine; postfx stays optional.
- **Drop** `react-native-gesture-handler` from input, react, engine (never imported).
- **Add** `react-native-safe-area-context >=4.0.0` peer to engine (it re-exports react's GameView
  which imports it at module scope).
- Leave as-is: `react-native-audio-api >=0.3.0` (audio, engine), `@sentry/react-native` optional
  (errors), `react-native-purchases >=8.0.0` (iap-revenuecat), canvaskit-wasm `>=0.40.0` optional
  (rationale: render-web drives CanvasKit's stable drawing subset directly; RN-Skia's exact 0.41.0
  pin governs only RN projects, where RN-Skia itself resolves it — no floor bump needed).
- **render-web export fold-in (owned by C1 — NOT the packaging row; packaging polish is the real OSS-C2, §17):** `createWebFrameRenderer` does NOT exist in source —
  the XP2 todo row's export claim is drift (verified 2026-07-03: zero hits in `packages/render-web/src`).
  **Implement it**: a thin composition mirroring `packages/react`'s `createSkiaFrameRenderer` shape
  — `createWebFrameRenderer(kit, canvas)` = `createFrameRenderer(createWebSkiaModule(kit), createWebSurface(kit, canvas), …)`
  — export from `index.ts`, author its api-specs entry (none exists), extend the CPU-surface
  conformance test to render one frame through it, and correct the XP2 todo row per the standing
  one-line-correction rule. If the composition is not truly 1:1, STOP the fold-in, correct the XP2
  row + game-migration E1 note to "not shipped", and leave implementation to a post-flip row.
- **Validation (the row's gate, C1b):** `bun pm pack` the affected packages and install the
  tarballs via `file:` specifiers into two temp fixtures (no registry needed — verdaccio belongs to
  F2): (1) the topdown template scaffolded against the Expo 57 / RN 0.86 / React 19.2 / RN-Skia
  2.6.x stack — assert `npm install --dry-run` reports **zero peer conflicts** (npm's resolver is
  the authority; bun's peer-warning surface differs) and `tsc` green; (2) a web-only fixture
  depending on render + render-web + assets — assert **no react-native / @shopify/react-native-skia
  in its lockfile** (the page repo's install pain, fixed at the source).

**Done when:** peer matrix matches the table above exactly; web-only install pulls no RN tree; both
validation fixtures green; api-specs "Peers" rows updated; **the render-web `postfx-surface.ts:184`
onscreen-surface resize fix ships here** (C1 owns the surface `createWebFrameRenderer` composes over —
resolves the §16 "fold here or into C1" ambiguity).

---

## 6. Arc M — launch-window modules (mission-serving)

### OSS-M1 · keyboard input (P0 for the mission, 2 sessions: M1a input, M1b ui driver)

**Scope:** `packages/input/src/keyboard.ts` (new), `input-manager.ts`, `remap.ts`; then `packages/ui` focus driver; README + api-specs + tests.
The only missing input modality (verified: zero keyboard code in packages/input); unlocks
desktop-web games; also the missing driver behind ui's focus navigation.

- **M1a:** `createKeyboard()` → state with `isDown(code)` / `wasPressed(code)` / `wasReleased(code)`
  (edge semantics buffered per frame, mirroring pointer/gamepad); `attachKeyboardListeners(kb, target)`
  where `target` is a structural `{ addEventListener, removeEventListener }` (web `KeyboardEvent.code`
  — no DOM types dependency; ambient structural types like the rest of input); wire into
  `InputManager.update()` frame lifecycle + `applyRemap` so actions can bind keys; `blur`/visibility
  clears held state (stuck-key guard). Document scope honestly: web/desktop first; RN hardware-keyboard
  caveat noted, no RN driver shipped.
- **M1b:** `packages/ui` gains `createFocusKeyboardDriver(manager, keys)` where `keys` is the
  structural `{ wasPressed(code) }` shape (no hard dep on input) — arrows/tab move linear focus,
  enter/space activates. Wire onto the B15 reactive focus. README keyboard/gamepad claim becomes
  true for keyboard.

**Done when:** synthetic-event tests pin edge semantics (down/held/released across frames, blur
clears); remap binding test; ui driver test moves focus + activates via the B15 reactive path.

### OSS-M2 · engine headless entry + barrel honesty (P0, 1-2 sessions — seam: M2a headless subpath / M2b barrel curation + collision fix)

**Scope:** `packages/engine/src/index.ts`, new `headless.ts`, `package.json` exports map + tsup config, README, api-specs, tests.
Verified: `index.ts:32` `export * from '@flare-engine/react'` pulls react-native at module scope
(react has top-level RN VALUE imports); `index.ts:2` explicit `GameConfig` (createGame's
`GameLoopConfig + assetLoader`) silently shadows react's richer GameView `GameConfig`. Bit PT
scripts twice; blocks every web/headless consumer.

- Add `"./headless"` subpath export: the current barrel minus react — exactly math, events, core,
  ecs, render, input, physics, audio, assets, scene, animation, particles, tilemap, debug, plus
  engine's own `createGame` + tier2-wiring exports (all structural-injection, RN-free; render
  qualifies after C1 drops its skia peer). Dual-entry tsup + `exports` map with correct `types`
  conditions.
- Root barrel: replace `export * from '@flare-engine/react'` with an explicit curated re-export
  list; resolve the collision by re-exporting react's config type as `GameViewConfig` (engine's own
  `GameConfig` for `createGame` keeps the name). Document the curation (the package.json
  "re-exports all packages" claim is false — it's a curated 15; fix the description).
- Tests: import `./headless` in a bun test and assert key exports; a module-graph guard test walks
  `headless.ts`'s static import chain and asserts no `@flare-engine/react` / `react-native`
  specifier appears (string-level walk is fine).

**Done when:** a bare `bun` script can `import { createWorld, createGameLoop } from '@flare-engine/engine/headless'`
with react-native absent from the resolution graph; barrel curation documented; both type names
importable without collision.

### OSS-M3 · assets: default loaders (P1, 1 session)

**Scope:** `packages/assets/src/loaders.ts` (new), parser warning, README, api-specs, tests.
Verified gap: manifest-driven loading is 100% caller-supplied plumbing; `Promise.all` load rejects
all on one failure; rotated/trimmed TexturePacker frames silently mis-render.

- `createFetchAssetLoader({ fetch?, decodeImage })` (web) and `createFileAssetLoader({ readFile, decodeImage })`
  (RN — structural injection, no RN import): both satisfy the existing `AssetLoader` type.
- Partial-failure policy: keep fail-fast default; add `loadManifestSettled()` returning
  `{ loaded, failed: { key, error }[] }` (allSettled path).
- TexturePacker parser: on `rotated: true` frames emit a dev-mode warning naming the frame
  ("rotation unsupported — re-export without rotation"); README documents the limitation. Full
  rotated-frame support is post-flip.
- README shows real end-to-end wiring for both platforms (incl. a CanvasKit `decodeImage` example
  wiring `kit.MakeImageFromEncoded`) — replaces the current await-a-sync-function drift.

**Done when:** fake-fetch/fake-fs loader tests load a manifest; settled path surfaces failures
typed; rotated-frame fixture warns.

### OSS-M4 · tilemap: authoring story polish (P1, 1 session — after B8)

**Scope:** `packages/tilemap/src/ldtk-parser.ts` (entities), `packages/cli` README, api-specs; docs-site guide lands in the page repo (§10).
Tiled 1.12.x is the primary authoring answer (three 2026 releases); B8 made parsing correct — this
row makes it teachable.

- `parseLDtkEntities(map)` → typed `{ id, x, y, width, height, fields }[]` (the LDtk-entity → ECS
  spawn convention), with an api-specs example wiring entities to `world.spawn`.
- cli README: fix the `--embed-tilesets` drift (real flag is `--no-embed-tilesets`) + wrong
  programmatic option names (verified in the findings ledger).
- api-specs: an "Authoring pipeline" subsection — Tiled export settings that work (CSV, embedded or
  external-with-cli tilesets), what throws and why (B8's validation), LDtk support matrix.

**Done when:** entity fixture test; docs describe exactly what the parsers accept post-B8; cli
README flags match `--help` output.

### OSS-M5 · tier-2 local providers (P0 — kills shipped false promises, 1-2 sessions — seam: M5a providers + tests / M5b README + api-specs sweep)

**Scope:** `packages/leaderboards`, `packages/achievements`, `packages/analytics`, `packages/iap` (doc fix), READMEs, api-specs (§ tier-2 rows, incl. the `:666-779` promise sweep), tests.
Verified: all three interface-only packages' READMEs promise "adapters land at 0.2.0" at v0.2.1
(`README.md:3,29,33` each); leaderboards documents nonexistent submit/fetch methods; achievements'
unlock/progress semantics undefined for adapter authors; analytics exports a dead `AnalyticsEvent`
type; iap's `priceMicros` JSDoc says "cents".

- `createMemoryLeaderboards()` — real submit/top/around-me over in-memory per-board score lists
  (documented tie/ordering semantics); make the README document the REAL interface methods.
- `createMemoryAnalytics()` (inspectable ring buffer) + `createConsoleAnalytics()`; wire or delete
  the dead `AnalyticsEvent` type (prefer wiring it as the event union the providers accept).
- `createMemoryAchievements()` + a storage-backed variant via structural `{ get, set }` injection;
  DEFINE the semantics in README (progress is monotonic 0–1, unlock latches at 1, re-unlock is a
  no-op) — this is the adapter-author contract the audit called ambiguous.
- iap: `priceMicros` JSDoc → micros (matches name + RevenueCat adapter).
- All four READMEs + api-specs stale-promise sweep: replace "adapters land at 0.2.0" with what's
  true (local providers shipped; platform adapters post-launch, RevenueCat exists for IAP). This
  row also strips the `.claude/skills` + private-game links from these READMEs (`README.md:33`
  each, iap-revenuecat `:35`) — it owns their end-state; the D-passes verify, not rewrite.

**Done when:** three packages each ship a usable local provider with behavioral tests (submit→top
ordering, achievement latch, analytics capture); zero "0.2.0" promises left in tier-2 READMEs or
api-specs.

### OSS-M6 · haptics: real adapter via injection (P1, 1 session)

**Scope:** `packages/haptics/src/`, README, `docs/design/api-specs.md:797`, tests.
Verified: 72-LOC stub, zero consumers anywhere, README + api-specs promise a `@flare-engine/haptics-expo`
adapter "at 0.2.0" that never shipped; Noop `setEnabled` is inert (consumer toggle code untestable).

- `createExpoHapticsProvider(expo)` where `expo` is the structural
  `{ impactAsync, notificationAsync, selectionAsync }` shape of expo-haptics (injection — **no**
  expo dependency, matching the repo's adapter pattern); map the existing HapticKind surface onto it.
- `createWebVibrationProvider(vibrate)` over structural `navigator.vibrate`.
- Fix the Noop: `setEnabled`/`isEnabled` become real state so consumer toggles are testable.
- README + api-specs:797: the adapter ships **inside** `haptics` via injection — rewrite the
  separate-package promise, and strip the haptics README's `.claude/skills` link while in-file.
  PT wiring is a game-repo row post-flip (§10).

**Done when:** fake-expo tests map kinds→calls + respect enabled state; web provider gates on
vibrate presence; docs promise only what ships.

### OSS-M7 · errors: global capture (P2 — cuttable, 1 session)

**Scope:** `packages/errors/src/global-capture.ts` (new), README, api-specs, tests.
Verified gap: only React render-phase capture exists; game-loop/async crashes (the majority) never
reach any transport; Sentry transport is native-only.

- `installGlobalErrorCapture(targets)` with structural `targets`
  (`{ addEventListener? }` for web `error`/`unhandledrejection`, `{ ErrorUtils? }` for RN) routing
  into the existing transport chain; returns `uninstall()`; a small pre-transport ring buffer
  (e.g. 20) preserves early errors until a transport attaches.
- `createClientTransport({ captureException })` — structural Sentry-browser-like injection for web.

**Done when:** fake-global tests capture sync throw, rejection, and RN handler path; uninstall
restores prior handlers; early-error buffer drains into a late-attached transport.

### OSS-M8 · particles v2 (P2 — cuttable, 2 sessions)

**Scope:** `packages/particles/src/` (emitter shapes + render adapter), README, api-specs, tests.
Two consumers proved two missing shapes: the page uses the pool for creative coding; PT rolled its
own ECS FX stack rather than use this package.

- Emitter shapes: typed union `point | circle | ring | rect | cone` (position + velocity sampling,
  zero-alloc via out-params + the B7 injectable seed).
- Render adapter: `drawParticles(pool, batch, frame)` writing into a caller-owned `SpriteBatch` via
  `drawRaw` (zero-alloc loop; the XP5 `drawInto` idiom).
- README: replace the phantom documented API (speed ranges / packed colors / shared pool / texture
  field — none exist) with the real one.
- **Cut rule:** if M8 is cut to post-flip, the README phantom-API fix does NOT get cut with it —
  the D3 pass then replaces the phantom API with the real current surface (docs-only), so the P0
  `check:readme` criterion never hangs on this P2 row.

**Done when:** shape-sampling tests (distribution bounds, determinism under seed), adapter test
queues correct sprites without allocation; README compiles.

### OSS-M9 · math: curves + RNG state (P2 — cuttable, 1 session)

**Scope:** `packages/math/src/` (`curves.ts` new, `random.ts`), README, api-specs, tests.

- `bezier2Into` / `bezier3Into` / `catmullRomInto` point sampling (+ allocating twins per repo
  convention), approximate arc-length helper; `segmentIntersectionInto` (the boolean-only gap).
- `SeededRNG.getState()` / `setState(s)` — unlocks deterministic saves/replays.

**Done when:** known-answer tests (reference curve points, intersection cases incl. collinear),
state round-trip determinism test.

### OSS-M10 · render table-stakes (P2 — cuttable, likely post-flip, 2 sessions)

**Scope:** `packages/render/src/sprite-batch.ts`, `frame-renderer.ts`, `packages/react` bridge, render-web module, api-specs, tests.
No sprite mirror path exists at all; additive blend is a shmup/particle staple.

- `SpriteData.blend?: 'normal' | 'additive'` → batch split by blend mode, plumbed to both backends'
  `drawAtlas` blend param.
- `flipX`/`flipY`: a single RSXform cannot express one-axis mirrors (KG5 finding) — route flipped
  sprites through the existing stretch/`drawImageRect` path with negative scale; document the perf
  trade (per-sprite draw call when flipped).
- 9-slice helper + opt-in camera-bounds culling on the batch.

**Done when:** readback parity tests on render-web for blend + flip; native bridge unit tests;
api-specs documents the RSXform constraint honestly.

### OSS-M11 · physics: detection upgrades (P2 — cuttable, 1-2 sessions)

**Scope:** `packages/physics/src/`, README, api-specs, tests.
The deep audit's "in the window instead [of planck]" list, minus the duplicate-add guard B11 owns:

- MTV/overlap-depth helper (`overlapInto(a, b, out)` → axis + depth) for the detection-only pairs —
  the missing piece between "collided" and "resolve it yourself".
- `CollisionWorld.raycast(origin, dir, maxDist, mask)` wired to the broadphase (today's raycast is
  disconnected and allocates per hit — reuse pooled hit records).
- Grid spatial-hash broadphase replacing the brute-force pair loop (its own comment prescribes it
  at ~1000+ entities) — keep the `SpatialIndex` surface, swap the internals; the perf headroom item
  the C++ adjudication named as the real answer.
- Also align the boundary-semantics inconsistency (aabbVsAabb/circleVsCircle strict `<` vs
  aabbVsCircle `<=`) — pick strict `<`, document it.

**Done when:** MTV known-answer tests; raycast mask + ordering tests; broadphase swap proven
behavior-identical on the existing suite + a 2k-entity pair-count benchmark showing the win.

---

## 7. Arc D — the docs truth pass (runs AFTER B/C/M so docs describe the shipped state)

### OSS-D1 · README snippet-compile harness (P0, 1 session, [main-thread] — writes `scripts/` + root package.json)

**Scope:** `scripts/check-readme-snippets.mjs` (new), root package.json script, initial failure inventory.
Verified systemic: README examples fail to compile in ~24 of 41 packages; 34 READMEs link
api-specs by relative path (404 on npmjs.com).

- Bun script: extract fenced ` ```ts` / ` ```tsx ` blocks from every `packages/*/README.md`,
  typecheck each against the workspace (per-snippet virtual file + one `tsc --noEmit` run over a
  generated project referencing workspace paths). ` ```ts no-check ` opt-out marker for
  intentionally partial fragments (use sparingly; the goal is compiling docs).
- `bun run check:readme` wired in root package.json. Output = per-package pass/fail list.
- Commit the initial failure inventory into this doc's D2–D4 rows (the fixer's worklist).

**Done when:** the harness runs green on at least one already-correct package and red on a known-bad
one (proves detection); inventory produced.

### OSS-D2 / D3 / D4 · README truth passes (P0, 3 sessions; D4 is [main-thread] for the root files)

**Exact package split** (no tier-name guessing — this list is the commit scope per session):
- **D2 (15):** math, events, core, ecs, render, render-web, shapes, postfx, input, physics, audio,
  assets, simulation, progression, storage. (storage: also kill the README's phantom
  react-native-mmkv peer claim — prose only, no manifest change.)
- **D3 (13):** scene, animation, particles, tilemap, pathfinding, dialogue, debug, errors,
  localization, deep-links, share, a11y, haptics.
- **D4 (13 + root):** ui, ui-shop, react, engine, devtools, testing, cli, create-flare-app,
  leaderboards, achievements, analytics, iap, iap-revenuecat — plus root `README.md`,
  `CONTRIBUTING.md`, `docs/README.md:25`.
Per package: make every snippet pass D1's harness; replace relative api-specs links with absolute
`https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#...`; install lines
become the public form (`bun add @flare-engine/x` / `npm i` — write the post-flip truth now);
strip remaining `.claude/skills` + private-game links (M5/M6 already own the tier-2 + haptics
ones; still open here: iap-revenuecat `:35` if M5 missed it, create-flare-app `:31`, shapes `:7`)
— showcase references point at flareengine.dev; sweep the deferred "8 package READMEs still say
apps/pan-tvardowski" note from S8.

Rows B3/B17/B19/B20/M5/M6 own their packages' README content — D-passes verify those (except
link/install/date mechanics, which the D-pass may still normalize anywhere). If a P2 row that owns
a README fix was cut (M8 particles being the known case), the D-pass makes the docs-only fix
itself — the `check:readme` criterion never waits on a P2 row.

**D4 extras (verified drift list):** root README — status block rewrite (0.4.0, October, public
quickstart via `npm create flare-app@latest`, delete the "Consuming from npm (restricted)" section
`:126-136` incl. its .npmrc setup instructions, fix `:49` "independently versioned" + `:159`
"independent SemVer" → lockstep story, add the flarerpg.org disambiguation line, October at `:14`/`:129`);
CONTRIBUTING — `:5` October, `:93` independent-SemVer; `:114` CoC promise is E1's (whichever of
D4/E1 runs second verifies the link resolves); AGENTS.md — verify only (both the `:13` SemVer line
and the `:47` status line were fixed 2026-07-03, as was `roadmap.md`); docs/README.md `:25` October.

**Done when:** `bun run check:readme` green across all 41; grep for `October 2026`, `restricted`,
`.claude/skills`, `Pan-Tvardowski` across READMEs+CONTRIBUTING returns only intentional hits
(disambiguation/none); every install line is the public form; **`grep -rE 'Pan.?Tvardowski|Phase 11|folio|session #' packages/*/src` returns zero** (carries B22's src-vocab scrub, §16); **`MIT` appears in shipping files only inside the 0.1–0.2.1 immutability note** (carries E2's MIT-grep, §16).

**D1 failure inventory** — generated 2026-07-11 by `bun run check:readme` (regenerate before each D-pass; it typechecks every README `ts`/`tsx` block against workspace source). 9 green, 32 failing, 62 snippets checked, 137 errors. A `Cannot find name` on an undeclared placeholder means "declare it or tag the fence ` ```ts no-check `". Green (no snippet work — link/install/date normalization only): a11y, analytics, cli, create-flare-app, engine, iap-revenuecat, leaderboards, progression, simulation.

_D2 (15) worklist_
- **math** (1): L22 TS2554 Expected 2 arguments, but got 0. (`rng.float()` needs `(min, max)`)
- **events** (3): L17 TS2344 `GameEvents` does not satisfy constraint `EventMap`; L18 TS2345 handler shape; L18 TS7006 implicit-any param `e`.
- **core** (1): L17 TS2304 Cannot find name `updateGame`.
- **ecs** (1): L16 TS2353 `hp` not in `() => { hp: number }` (prefab component shape).
- **render** (10): L20 `skiaCanvas`; L22 TS2554 drawSprite expected 6 args got 1; L23 `image`/`frame`/`x`/`y`/`w`/`h` undeclared; L23 TS2345 `number` vs `SpriteColor`; L24 `skia`.
- **render-web** (13): L22 TS2554 `loadCanvasKit()` needs `wasmUrl` (prose also mislabels it "locateFile"); L32/44/65 `kit`/`canvasEl`; L47 `width`/`height`; L48 `atlasImage`/`commands`; L50 `surface`; L75 `newW`/`newH`.
- **shapes** (7): L24/33 `Skia`/`canvas`/`paint` undeclared; L85 `playerShip`.
- **postfx** (7): L19/20 TS2554+TS2345 create* effect signature (id string, not options); L22 `skia`; L23 `width`/`height`.
- **input** (4): L46/47 `input`/`player` undeclared.
- **physics** (6): L17 TS2339 `CollisionPair` has no `a`/`b`; L19 TS2353 `shape` not in `Shape`; L20 `entityA`/`x`/`y`.
- **audio** (8): L22/25/29 DOM `AudioContext` not structurally `AudioContextLike` (missing `onended`); L32 `shootBuffer`; L44/45/53 `manager`.
- **simulation** — clean; **progression** — clean.
- **storage** (2): L17/44 TS2307 `react-native-mmkv` (phantom peer — kill the prose claim per D2 note).

_D3 (13) worklist_
- **scene** (2): L17 TS2739 scene object missing `name`/`world`/`camera`; L23 TS2554 arg count.
- **animation** (4): L15 TS2305 no `easeOutQuad` export (it's in `math`); L17 `sheet`; L19/22 `dt`.
- **particles** (7): L18 TS2322 `number[]` vs `number`; L19 `number` vs `Color` (×2); L23 `dt`/`gravityX`/`gravityY` + TS2554 arg count.
- **tilemap** (6): L16 `json`; L17 `atlas` + TS2554; L18 `camera`/`skia`/`gameRenderer`.
- **pathfinding** (5): L19 TS2554 expected 5-6 got 4; L23 `result` possibly null (×2) + `PathResult` has no `found`/`cells`.
- **dialogue** (5): L16/21/27 TS2554 arg counts; L24 TS7006 implicit-any `id`/`args`.
- **debug** (7): L18 TS2554; L21/23/24 `StatsTracker`/`FpsWidget` API drift (`beginFrame`/`endFrame`/`formatLine`/`snapshot`); L23 `drawCalls`/`entityCount`.
- **errors** (3): L20 TS2554; L25 `CrashScreen`; L29 `App`.
- **localization** (3): L17 TS2353 `fallback` not in `LocalizationManagerOptions`; L18 `enJson`/`plJson`.
- **deep-links** (2): L20 `Linking`; L21 `sceneManager`.
- **share** (2): L17 `skiaCanvasRef`; L20 `Share`.
- **a11y** — clean.
- **haptics** (2): L16 TS2307 `expo-haptics`; L42 `Button`.

_D4 (13) worklist_
- **ui** (3): L22 TS2322 `ButtonProps` (variant/onPress); L22 `resume`; L35 `keys`.
- **ui-shop** (6): L40 `provider`; L46/56/64 `t`; L51 `paywallOpen`; L57 `setPaywallOpen`.
- **react** (1): L28 TS1109 Expression expected (`onChange={(v) => /* … */}` empty arrow body — real syntax error).
- **engine** — clean.
- **devtools** (4): L19 TS2741 `DevtoolsProvider` missing `snapshot` + `world`/`loop`; L26 TS2339 `EntityInspectorView.components`.
- **testing** (2): L25 `expect` undeclared + TS2571 unknown (bun-test snippet).
- **cli** — clean; **create-flare-app** — clean; **leaderboards** — clean; **analytics** — clean; **iap-revenuecat** — clean.
- **achievements** (1): L38 `myStore`.
- **iap** (1): L29 `showZone4`.

### OSS-D5 · design-docs honesty (P0, 2-3 sessions per 2026-07-05 audit, [main-thread] — seam: D5a architecture.md / D5b api-specs.md)

**Scope:** `docs/design/architecture.md`, `docs/design/api-specs.md`, `packages/math` easing headers.
Verified drift: architecture.md presents planck.js (`:32,110,182`), rbush SpatialIndex (`:110,193`)
and flow-fields (`:222`) as shipping — none exist; `shapes` has zero mentions in architecture.md
and no api-specs section; easing count is 42 (`easings.ts:1`), 32 (`math/README.md:3`), 42
(`architecture.md:121`) vs actual **35**; `architecture.md:11`'s historical "36 packages" prose
reads as current.

- architecture.md: move planck/rbush/flow-fields into an explicit **"Post-launch roadmap"**
  subsection (labeled not-shipped); add `shapes` to the layer table + a section; fix `:121` easing
  count to 35; rewrite `:11` so the only asserted count is 41 dirs / 40 scoped + create-flare-app.
- api-specs.md: author the missing `@flare-engine/shapes` section (public surface: ShapeSpec-family,
  draw/atlas exports — document what IS, including the PT-vocabulary surface as-is; renaming
  `ShipSpec` etc. is a post-flip API-generality item, not a docs edit); verify B4/M4/M5/M6 already
  updated their sections; easing count; sweep any remaining "0.2.0" forward-promises.
- **Concrete stale api-specs sections found 2026-07-05 (re-derive from each `src/index.ts`):** dialogue
  `createDialogueRunner` (api-specs:233 — real sig is `createDialogueRunner(options?: { conditions?, actions? })`;
  graph+variables go to `runner.start`; onLine/onChoice/onEnd/onAction are Signals) and `createTextReveal`
  (api-specs:235 — no opts; state is `visibleText`/`complete`; `speed`/`punctuationDelay` live on
  `updateTextReveal`); devtools "Hard deps" (api-specs:655 overstates events + @flare-engine/react —
  real deps are core+ecs, react/react-native are peers); progression section header tier label. The
  easing count is **32 (api-specs:22) vs 42 (architecture:94,:121) vs real 35** — set all to 35.
- `easings.ts:1` header count → 35 (or drop the number — prefer dropping counts from headers).
- Add two one-line positioning notes to architecture.md's roadmap subsection: networking is
  deliberately out of scope; the convention is factories + plain objects (Layer-3-era classes are
  grandfathered, new API is factory-shaped) — the class-vs-factory decision, documented before the
  API freezes.

**Done when:** grep `planck|rbush|flow.?field` in architecture.md hits only the roadmap subsection;
shapes documented in both files; a single easing count (35) or none anywhere; **D1's snippet harness
compiles the api-specs `​```ts` fences** (§16 expansion — the stale sections above must compile, not
just the READMEs), or, if that harness extension slips, the four named sections are re-derived + hand-verified.

---

## 8. Arc E — governance files (1 session)

### OSS-E1 · community minimum (P0, 1 session, [main-thread] — writes `.github/` + root files)

**Scope:** repo root + `.github/`.

- `SECURITY.md` — GitHub private vulnerability reporting as the channel; supported-versions table
  (the latest published minor). `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1, contact = the commit author email
  unless the owner supplies a different address at review; fix `CONTRIBUTING.md:114`'s "lands at
  0.1.0-rc" promise to link it (whichever of D4/E1 runs second verifies the link resolves).
- `.github/ISSUE_TEMPLATE/bug_report.yml` (engine version, platform RN/web, repro), `feature_request.yml`,
  `config.yml` (blank issues on; Discussions link placeholder until the owner enables Discussions).
- `.github/PULL_REQUEST_TEMPLATE.md` — gate checklist (lint/typecheck/test/build, api-specs+README
  updated, no `any`, zero-alloc note for hot paths).
- `FUNDING.yml` — `github: [grzott]`.
- README: the flarerpg.org disambiguation line if D4 hasn't landed yet (whichever runs first adds
  it; the other verifies).

**Done when:** all six files exist and self-review against GitHub's community-standards checklist
(repo Insights → Community) would show green post-flip.

---

## 9. Arc F — flip mechanics (rehearse everything irreversible)

### OSS-F1 · flip runbook + CI backstop (P0, 1 session, [main-thread])

**Scope:** `docs/plans/flip-runbook.md` (new), `.github/workflows/ci.yml`, `scripts/flip-access.mjs` (new).

- Author the runbook with owner/agent lanes and exact commands. Required ordering invariants
  (verified mechanics): **(1)** GitHub repo → public FIRST (acknowledge side effects: stars/watchers
  reset, Actions history becomes public, private forks detach, push rulesets disabled);
  **(2)** re-add provenance (S4b removed it — set `NPM_CONFIG_PROVENANCE: "true"` in release.yml or
  root publishConfig; requires public repo + public package, GitHub-hosted runner, npm ≥11.5.1;
  `release.yml` already has `id-token: write`); **(3)** npm access flip — `scripts/flip-access.mjs`
  runs `npm access set status=public` over the 40 scoped packages (serial, resumable, `--otp` pass-through);
  **(4)** the flip commit — 40× `publishConfig.access` restricted→public + `.changeset/config.json`
  `access: "public"` + create-flare-app `private: false` **+ a version-bump-only lockstep patch
  changeset** in ONE tagged commit (without the changeset, `changeset publish` would skip the 40
  already-published scoped packages and only create-flare-app would ship — no fresh
  provenance-stamped release would exist); **(5)** `bun run version` + publish — the fresh 0.4.x
  lockstep release for all 41, now public + provenance-stamped, via `bun run release`
  (ENABLE_RELEASE already gates release.yml on push to main); **(6)** docs-site domain bind + final
  deploy; **(7)** verification battery (I2). Abort points + what is/isn't reversible at each step
  (npm visibility is retroactive for ALL published versions and effectively one-way).
- CI backstop: add `push: { branches: [main] }` trigger to ci.yml (currently PR-only — the flip
  commit itself must be CI-validated) + the D1 `check:readme` step + a concurrency group.

**Done when:** runbook reviewed against §12; ci.yml runs on a push to main; flip-access script
dry-run mode lists exactly the 40 scoped names.

### OSS-F2 · verdaccio rehearsal (P0, 1-2 sessions, [main-thread], **owner-paired**)

**Scope:** local verdaccio, throwaway branch; no repo changes beyond runbook corrections.
Precedent: the S5 rehearsal caught a publish-breaking `workspace:*` leak — rehearse the public flip
the same way. **Exemptions (this row only):** the owner drives the branch/commit steps (builders
never run git); verdaccio publishes are registry-scoped + discarded, exempt from the §2.5
no-publishes rule.

- Stand up verdaccio; apply the F1 flip commit on a branch; `bun run version` + publish ALL 41
  (40 scoped + create-flare-app) to verdaccio with `access public`.
- From a clean temp dir against the verdaccio registry: `npm create flare-app@latest` (all three
  templates), install, typecheck; `bun add @flare-engine/engine` resolves the full tree with zero
  `workspace:`/`0.0.0` leaks; the C1 web-only fixture installs with no RN tree.
- Assert every published tarball's manifest `license == "Apache-2.0"` and that `LICENSE` + `NOTICE`
  are present in the tarball file list (E2 relicense — added 2026-07-12).
- Feed every delta back into the runbook (F1 doc rev).

**Done when:** cold scaffold + installs green from verdaccio; runbook updated with any corrections;
branch discarded.

### OSS-F3 · tarball + published-versions audit (P0, 1 session, [main-thread])

**Scope:** `scripts/audit-tarballs.mjs` (new), report to `docs/plans/_local/`.
The access flip exposes **all previously published versions** (0.1.0, 0.2.0, 0.2.1) retroactively —
audit them, not just 0.4.0.

- Script: `npm pack` every workspace package at HEAD **and** fetch published tarballs for each
  released version of all 40 names (authenticated); extract; scan for private-project vocabulary,
  local paths, tokens/env files, private URLs, and session/plan references — the full pattern list
  lives IN the script and the `_local/` report, not in this public doc. Names absent at a given
  version are expected (only 36 packages existed at 0.1.0) — record as n/a, never as failure.
  Report per package×version.
- Also assert each HEAD-packed tarball manifest carries `"license": "Apache-2.0"` and ships both
  `LICENSE` and `NOTICE` (E2 relicense — added 2026-07-12). Published 0.1.0–0.2.1 tarballs stay MIT
  by design (immutable) — record, do not flag.
- Hits in OLD versions go to the owner for disposition before the flip (§14); the per-hit ledger
  and remediation choices live in the `_local/` report and the runbook's owner lane. HEAD hits =
  fix rows.

**Done when:** report exists with zero unresolved hits, or each hit has an owner decision recorded.

### OSS-F4 · history/exposure re-scan at freeze (P0, 1 session, [main-thread] — run Oct 2-5)

**Scope:** read-only scan + a short report to `docs/plans/_local/`.

- Re-run the full-history secret scan (June pass was clean over 847 files — re-verify the delta
  since); grep SESSION_LOG.md + docs/ for tokens/keys/emails/paths beyond the known author email.
- Confirm `docs/plans/_local/` is ignored-and-untracked, `.claude/` content is the
  deliberate-publish set (the AI-transparency decision — owner ratifies in §14), scrubbed paths
  from F0 stayed scrubbed.
- Author-email note: the git author email is on every commit; history rewrite is NOT recommended
  (breaks every SHA + the game-repo split tags). Owner accepts exposure or switches to the GitHub
  noreply email going forward only.

**Done when:** report shows clean or owner-accepted items only; nothing new tracked that shouldn't be.

---

## 10. Cross-repo lanes (each runs in its own repo with its own harness/gate)

**flare-engine-page** (deploy-ready but never deployed; wrangler Workers Static Assets):
- **G1 (pre-flip, before freeze):** first real deploy to the workers.dev preview URL (owner auth) +
  WASM MIME verify + Lighthouse re-run (owner's bar: 100 mobile+desktop). Domain bind to
  flareengine.dev happens at flip (runbook step 6).
- **G2 (pre-flip):** `GENERATE_API=1` typedoc dry-run NOW + fix fallout (verified: gated off, never
  run in CI); October strings sweep (7 verified locations: SiteFooter.astro:3,58, index.astro:290,
  architecture.mdx:134, packages.mdx:34, getting-started.mdx:14, overview.mdx:119); getting-started
  rewrite to the public install (drop the restricted-token install block). The 6 links into the
  currently-private engine repo go LIVE at flip — keep, they're correct post-flip. **At freeze:**
  bump the page's 8 `@flare-engine/*` deps to `^0.4.0` (the H1/H2 prerequisite — same move as
  PT2/BK1).
- **G3 (post-flip OK):** the page repo's own dogfood rows PAGE-D1 browser-verify + PAGE-D2–D5
  (distinct from this doc's D-rows; already defined in that repo's todo — closes the
  simulation/render-web declared-not-imported Tier-B gap); PT showcase assets + Berek entry.

**Pan-Tvardowski** (clean at e0f35f5):
- **PT1 (pre-freeze):** declare `@flare-engine/debug` (real src imports ×3) — the phantom dep that
  breaks on strict install; move the test-only `@flare-engine/input` use to a devDep or drop;
  remove dead deps `particles` + `tilemap` (declared, never imported).
- **PT2 (manual window):** bump all 32 deps to `^0.4.0` at freeze; full gate + the §11 device sweep.
- **PT3 (post-flip):** wire haptics (M6's adapter) — PT's own docs call it "the one true engine gap".

**Berek:** **BK1 (manual window):** bump 7 deps to `^0.4.0` (the 0.2.1 migration is confirmed
committed at 2b1733f); fix README:23's reference to deleted `src/movement.ts` (folded into
`@flare-engine/physics` at 0.2.1); gate + a short play check.

**grzott-portfolio** (outside this workspace): **PF1 (owner, minutes, any time before flip):** align
the portfolio's engine copy with the engine's actual role there (the site's demo predates its
engine integration); the `dynamics` lift stays a post-flip option and must not block October.

---

## 11. Freeze + the two-week manual test window (Oct 5–18)

### OSS-H1 · freeze + 0.4.0 restricted publish (P0, 1 session + owner publish, [main-thread])

- Last pre-freeze commit lands; author ONE changeset (minor, lockstep — summary assembled from the
  Arc B/C/M intentional-change notes in todo rows); `bun run version` (concretize runs
  automatically — verify no `workspace:*` survives, the S5 landmine); owner publishes 0.4.0
  **restricted** (owner session); PT2/BK1/G2 bump their repos to `^0.4.0`.
- From freeze to flip: **only fixes for manual-window findings.** No API changes, no new features,
  no docs restructuring. Each fix ships as a lockstep 0.4.x restricted patch when a consumer needs
  it re-tested.

#### Perf gate (single source)

The freeze perf gate lives **here and nowhere else**. `flip-runbook.md` and
`manual-test-protocol.md` each carry ONE checkbox pointing at this block and restate nothing —
a perf item copied into three files is three items that drift. Spec + rationale:
[perf-measurement-2026-07.md](perf-measurement-2026-07.md) §4 (why counters gate and wall-clock
does not) and §11.5.

**Hard — the freeze does not happen until these are green:**

- [ ] `bun run check:perf` green: Track A counters reconcile with `.perf-baseline.json`, and no
      unjustified baseline edit rode in with an engine change.
- [ ] `bun run check:perf-bytes` green: every published package under its byte ceiling.
- [ ] `.perf-baseline.json` populated — a counter row per alloc scenario, a ceiling per package.
      An empty file is red, not green (B8: it shipped as `{}` and gated nothing, while the published render numbers drifted 3.1x out of date between April and July).
- [ ] Microbench captured **≤7 days before freeze**, **≥5 runs from a clean tree**, published with
      spread bands: `bun run bench` ×5 → `bench:promote` → `bench:md`. A single-run
      capture has no band, so nothing downstream can separate a regression from this machine's noise.
- [ ] `bun run check:perf-freshness` green: no commit under any measured package or under
      `benchmarks/src` since the capture commit. **Never close this one with
      `FLARE_PERF_ALLOW_STALE`** — at freeze the whole point is that the numbers describe the
      frozen tree.

**Dated-or-declared-unmeasured — recorded, does not block:**

- Native device (PERF-7) and web (PERF-6) numbers: either a dated capture, or `PERFORMANCE.md`
  names that surface as unmeasured, iOS first. Consistent with §7's fallback and §13. Shipping
  "we have not measured this" is honest; shipping a stale number as current is not.

**Freeze-window rule (Oct 5–18):** any commit-back perf cron **pauses**, or diverts to
artifact-only upload, for the duration — H1 is fix-only, and a bot pushing a results file into a
frozen tree is exactly the kind of unplanned commit the freeze exists to prevent. Resumes after the
flip.

### OSS-H2 · manual-test protocol (P0, author ~Sep 28, [main-thread]; owner executes Oct 5–18)

Written as `docs/plans/manual-test-protocol.md` by an agent session; the checklist to cover:

1. **First-run funnel (the launch-critical path):** cold-machine `npm create flare-app@latest` ×3
   templates on Windows AND in a Linux container, **against the F2 verdaccio registry** (reuse that
   harness — create-flare-app and the public versions don't exist on npmjs until the flip; the
   true tokenless PUBLIC-registry run is deliberately I2's job on flip day); `bun install` +
   `bunx expo run:android` for topdown on a real device; every root-README quickstart executed
   verbatim (same registry override).
2. **PT** on the reference device at ^0.4.0: full campaign sweep (saves/settings round-trip, shop,
   locale PL↔EN, reduced-motion, colorblind atlas), plus the B5 scene-restart and B12 IAP-restore
   paths explicitly.
3. **Berek** walk on 0.4.0 (tilemap + solid-grid path).
4. **Web:** page hero demos at ^0.4.0 on desktop Chrome/Firefox/Safari + Android Chrome + iOS
   Safari (real devices), WASM load on throttled 4G, Lighthouse 100 re-check.
5. **New surfaces:** keyboard demo on desktop web (M1); headless bun script (M2); a Tiled map
   authored fresh in Tiled 1.12 through cli → template (B8/M4); haptics on device (M6).
6. **Docs site:** every page + link, typedoc reference pages, on real phone; getting-started
   followed verbatim by the owner pretending to be a stranger.
7. Findings → todo rows tagged `FREEZE-FIX`, fixed in priority order; anything non-blocking →
   post-flip backlog.

---

## 12. Flip week (Oct 19–23, target Tue Oct 20)

- **OSS-I1 · execute the runbook** (owner + agent pairing session): the F1 sequence, each step
  checked off in the runbook file. Time-critical mechanics were rehearsed (F2), so this is
  execution, not discovery.
- **OSS-I2 · post-flip verification battery:** cold `npm create flare-app@latest` from the PUBLIC
  registry on a machine with no token; `npm view @flare-engine/engine` shows public + provenance on
  the fresh release; docs-site links into the now-public repo resolve; README badges live (add CI
  badge now); GitHub community-standards checklist green; Discussions on (owner);
  `docs/plans/roadmap.md` + this file flipped to "shipped" state; memory updated.
- **Quiet-launch close:** no announcement required. The repo being findable (GameFromScratch,
  GitHub topics) is the discovery channel until the owner chooses to post.

## 13. Post-flip backlog (announce-when-ready — owner's schedule, no dates)

Ranked start: **devtools live-tweak inspector arc** (ecs prerequisites landed in B2; Tweakpane 4
web overlay; Expo devtools-plugin transport — directly unblocks PT's deferred holistic balance
pass) → **docs playground** (3–5 curated editable examples, static client-only, esbuild-wasm or
import maps; skip WebContainers/Sandpack — licensing/stalled) → README GIF + 20-line snippet →
page D2–D5 dogfood + PT showcase assets + Berek entry → real web benchmark numbers →
Trusted Publishing OIDC (per-package config ×40, kills token rotation) → `physics-rigid` (planck
v1.5.x, opt-in, thin facade, fixed-timestep + B7's alpha) → pathfinding consumer (Berek
enemy-chase or template example) + B18 leftovers → `dynamics` lift decision (portfolio-credibility
milestone vs planck overlap — pick ONE rigid-body story) → game-driven API generality (per the
keep-local dedup ledger in the game repo's private docs — six recorded candidates — plus `shapes`
de-gaming: rename the game-flavored public types, neutralize the hardcoded palette) → hot-path
allocation arc (Signal emit rest-args, SpriteBatch buckets, postfx buildPassInto, localization t()
cache, gamepad polling) → B19/B20/M7–M11 if cut → share native-transport screenshot path +
ScreenshotTarget dims (deferred from B3) → ecs module-global 32-type cap redesign (deferred from
B2) → assets rotated-frame support (deferred from M3) → OG images for the docs site →
localization plurals/ICU escaping + missing-key diagnostics → a11y MotionPolicy + OS-preference
source (⚠ must not pull react-native into the RN-free packages — separate entry points or
structural injection) + quality governor + procedural SFX (one small arc) →
Tier-2 platform adapters (Game Center / Play Games / PostHog) → 2.5D lighting (SkSL, per
lighting-2-5d.md) → scene pause/resume + push/pop transitions → the extraction-audit §5 deferred
slivers (scroll-wrap parallax, telegraph indicator, pulse flipbook, UIRoot scaffold, timed-window
ability, ascii map builder, FX budget governor — all 2nd-consumer-gated, unchanged) → the harness
modernization notes (todo.md Closed arcs, docs+harness section — opportunistic).

## 14. Owner ledger (out-of-band actions — nothing here is agent work)

Credential specifics, per-hit audit dispositions, and anything business-candid live in
`docs/plans/_local/owner-ledger.md` (never committed). The public schedule:

| When | Action | Notes |
|---|---|---|
| **NOW (this week)** | Rotate the npm publish credential | Owner action; specifics tracked privately. Calendar note for the post-flip follow-up (or land Trusted Publishing instead). |
| NOW | Ratify this plan's defaults | Flip date (Tue Oct 20), private-docs move (A0), showcase-links policy (§0.7), haptics=adapter (M6), lockstep SemVer story (§0.4). Silence = defaults stand. |
| NOW | PF1 portfolio copy alignment | Minutes; see §10. |
| Jul (A0 lands) | Confirm private-docs disposition | `docs/plans/_local/` gitignored; nothing candid gets committed. |
| Aug (F3 report) | Disposition of any flagged OLD published versions | Options + per-hit ledger in `_local/`. |
| Oct 2–5 | Ratify F4 exposure report | incl. author-email stance + `.claude/`-goes-public + SESSION_LOG-goes-public (the AI-transparency asset decision). |
| **Oct 5** | Publish 0.4.0 restricted | Owner session; S5-style flow. |
| Oct 5–18 | Execute §11 manual protocol | The requested two weeks. |
| **Oct 20 (flip)** | GitHub repo → public; run flip-access script; flip commit + fresh public release; bind flareengine.dev; enable Discussions | I1 pairing session; runbook is the checklist. |
| Post-flip | Blog/announce whenever ready | Decoupled by design; reconcile any pre-existing public blog schedule titles at leisure. |

## 15. Risks + standing rules

- **Capacity slip** → §1 rules; the two-week manual window is never compressed; "October" is the
  only hard wall.
- **RN-Skia / Expo releases mid-window** → template pins re-validated once at freeze (B14 note);
  never chase upstream after Sep 29. Graphite/`@next` stays out entirely.
- **Verdaccio ≠ npmjs** → F2 rehearses mechanics, F3 audits real tarballs, and the S5/S6 precedent
  (concretize-workspace-deps) is already wired into `bun run version`.
- **Manual window finds a design flaw** → fix-forward only if launch-critical (first-run funnel,
  data loss, money path); otherwise it's a documented limitation + post-flip row. The freeze exists
  to protect the flip date.
- **One-way doors** (repo visibility, npm access, provenance) execute only inside the rehearsed
  runbook, never ad-hoc — each has a pre-flight check in F1.
- **Standing rule for every row:** if execution reveals the spec here is wrong, the builder notes
  the deviation in the todo row on completion and this doc gets a one-line correction — never a
  silent divergence (one source per fact).

---

## 16. Final-audit addendum (2026-07-03) — new + amended rows

A 53-agent final deep audit (41 package auditors + cross-cutting + docs/strategy + license lanes)
ran on 2026-07-03 before the queue was frozen for execution. It **confirmed the direction** (October
+ Apache-2.0 + quiet launch + services model — keep all four) and confirmed most Arc-B rows, but
surfaced launch-blockers and correctness traps the pre-existing rows do not cover, plus stale facts
inside existing rows. Full evidence ledger (with reproductions + candid strategy notes):
`docs/plans/_local/final-audit-2026-07-03.md` (private). The rows below are the actionable delta;
they slot into Arc B / Arc E and amend C1/D5/M2/B12/B20. Evidence file:line is in the ledger.

### New rows

#### OSS-B21 · create-flare-app: bin crashes at module load (P0 — launch-blocker, 1 session)

**Scope:** `packages/create-flare-app/tsup.config.ts`, `package.json`, tests.
Reproduced: the shipped `dist/bin.js` (the CJS build `bin` points at) throws at module load on every
platform — tsup emits `var import_meta = {}` for `scaffold.ts:37`'s `import.meta.url`, so
`fileURLToPath(undefined)` → `ERR_INVALID_ARG_TYPE` before argument parsing. `npm create flare-app`
is dead until fixed; `dist/bin.mjs` works. **B13 touches this package (version stamping) but never
addresses the bin/shims — do B21 in the same session as B13 or immediately after.**

- Add `shims: true` to `tsup.config.ts` (injects the `import.meta.url` shim into the CJS build) OR
  repoint `bin` at `dist/bin.mjs`. Prefer `shims: true` (keeps a single bin target, fixes the CJS
  `index.js` require path the deps lane also flagged).
- Add a test that actually **executes** the built bin (`node dist/bin.js --help` exits 0 with usage
  text) — not just an import. **F2's verdaccio rehearsal must run the scaffolded bin, not only
  install it** (add to F2's done-when).

**Done when:** `node packages/create-flare-app/dist/bin.js --help` and `--version` exit 0 on win32 +
posix; a bin-execution test guards it; F2 runs the bin end-to-end.

#### OSS-B22 · engine-wide: private-game vocabulary scrub in shipping src (P0 — leak/embarrassment, 1 session)

**Scope:** `packages/*/src/**` JSDoc; grep gate added to D4 done-when. **[covers the D.d.ts gap]**
`git grep` for `Pan Tvardowski|Phase 11|folio|session #` + the private repo URL over shipping source
hits ~10 `src` files whose JSDoc compiles into published `dist/index.d.ts` (confirmed at
`packages/assets/dist/index.d.ts:222`): `a11y/src/bridge.ts:10`, `assets/src/procedural-atlas.ts:88`,
`engine/src/tier2-wiring.ts:10`, `iap/src/catalog.ts:6`, `iap/src/entitlements.ts:8`,
`postfx/src/controller.ts:9`, `shapes/src/types.ts:159`, `share/src/screenshot-scene.ts:10`,
`ui/src/dialogue-panel.tsx:41`, `ui/src/main-menu-kit.tsx:36`, **`ui/src/shop-panel.tsx:43`** (11th
file the enumerated list missed — 2026-07-05 audit) **+ `postfx/src/controller.ts:45` `@session #196`
beyond the `:9` above**. The enumerated list is a floor — **the grep is authoritative; scrub every hit.**
B19's scrub is postfx-only; D4 greps READMEs+CONTRIBUTING only; F3 is a freeze-time detector, not a scrub.

- Rewrite each JSDoc block to project-neutral language (describe the pattern, not the game); keep the
  technical content. No `.d.ts` may reference the private game, its repo, or internal phase/session
  numbers.
- Add `grep -rE 'Pan.?Tvardowski|Phase 11|folio|session #' packages/*/src` returns zero to **D4's**
  done-when (alongside the existing README grep). READMEs that link the private repo
  (achievements/analytics/create-flare-app/iap-revenuecat/leaderboards/shapes/share) are already in
  D-pass scope — this row owns the `src` JSDoc; the D-passes own the READMEs.

**Done when:** grep over `packages/*/src` for the vocabulary + private-repo URL is clean; rebuilt
`dist/*.d.ts` carry no private references; D4 done-when gains the src grep.

#### OSS-B23 · input-validation + prototype-safety hardening batch (P1, 1 session)

**Scope:** `packages/animation/src/sprite-animator.ts`, `packages/audio/src/sfx-pool.ts`,
`packages/core/src/{game-loop.ts,clock.ts,coroutine.ts,app-lifecycle.ts}`,
`packages/dialogue/src/{graph.ts,runner.ts}`, `packages/localization/src/{manager.ts,format.ts}`,
tests. A class of unvalidated-input hangs + inherited-key leaks, several **reproduced live**.

- **Hang guards (throw on non-positive):** `sprite-animator.ts:75` (`frameDuration <= 0` infinite
  loop — match the package's own `periodicTween`/`createStepSequence` which already throw);
  `sfx-pool.ts:36/77` (`maxPolyphony <= 0` busy-spin — CONFIRMED); `game-loop.ts:46/108`
  (`fixedDt <= 0` hard hang — validate in ctor AND guard `step()`).
- **Prototype-safe lookups (`Object.hasOwn` / `Object.create(null)` tables):** `dialogue/graph.ts:98`
  (`getNode('__proto__')` returns `Object.prototype`, soft-locks the runner — CONFIRMED; also
  un-blocks B10's `onError` which currently never fires); `dialogue/runner.ts:43` (`{constructor}`
  leaks the native function into dialogue — CONFIRMED); `localization/manager.ts:70` +
  `format.ts:64` (`t('constructor')`, `has('constructor')`, `{constructor}` interpolation).
- **Re-entrancy (fold into B1's counter work if same session):** `core/clock.ts:96` schedule-mutation
  during `tickSchedules`, `core/coroutine.ts:64` `clear()` inside a running coroutine,
  `core/app-lifecycle.ts:30` non-idempotent `background()` (second call discards the resume flag →
  game frozen). These are the same live-index-iteration class as B1/events.

**Done when:** each hang input throws a typed error (no infinite loop) with a known-input test;
prototype-key tests prove `__proto__`/`constructor`/`toString` return `undefined`/leave-as-is; the
three core re-entrancy paths have a callback-mutates-during-iteration regression test.

#### OSS-B24 · render: shader-effect + z-order correctness (P1, 1-2 sessions)

**Scope:** `packages/render/src/{frame-renderer.ts,shaders.ts,sprite-batch.ts,camera2d.ts}`,
`packages/react/src/game-view.tsx`, api-specs, tests. The "same code renders on Web + RN" headline
depends on these; **spot-check confirmed** the shader + resolution sites.

- **water/fog/fire cannot render on a real backend** (`frame-renderer.ts:483/504/527`): the SkSL
  declares a child shader (`shaders.ts:85 uniform shader src;`) but the effects call
  `makeShader(uniforms)` with no children (the `makeShaderWithChildren` path at `:166` is unused),
  and resolution is hardcoded `waterUniforms[0]=[1]=0` so `coord/resolution` divides by zero. Bind
  the child correctly (or drop the `uniform shader src` if these are meant to be source-free) and
  feed real resolution; add a render-web readback test that proves non-zero output.
- **frame time is hardcoded 0** (`react/game-view.tsx:161` `beginFrame(w,h,0,pd)`): plumb a real
  time source (GameLoop elapsed) through GameView so time-driven shaders animate; add a prop/config.
- **z-order lost across buckets** (`sprite-batch.ts:200`): `flush()` draws `(image,effect,alpha)`
  buckets in first-encounter order, discarding relative z between buckets — contradicts
  api-specs.md:91/:203. Preserve global z (stable-partition or per-flush z-key) or document the
  limitation honestly; prefer preserving.
- **stretch bucket drops effects + mis-sizes** (`sprite-batch.ts:187` + `frame-renderer.ts:782`): add
  `stretch` to the bucket key; call `resolveEffectPaint` in the stretch branch (today only alpha is
  honored) — api-specs recommends `custom()` shaders for backgrounds, which are typically stretched.
- **dead-zone follow double-counts** (`camera2d.ts:229`): fix the math to `relX - dz.x` (currently
  `2*relX + offsetX - dz.x`); add the missing dead-zone test.
- `render-web/postfx-surface.ts:184` resize bug (onscreen WebGL surface never recreated) — **owned by
  C1** (it implements `createWebFrameRenderer` over this surface); added to C1's done-when 2026-07-05,
  removed from B24's scope so it can't fall between the two rows.

**Done when:** water/fog/fire correctness proven by real-CanvasKit `makeShader` uniform spies
(resolution slots [0]/[1] = sprite `dstW`/`dstH`; time slot advances across `beginFrame`) for all
three effects, plus a non-throwing end-to-end smoke readback — **pixel-level shader execution is NOT
observable on CPU CanvasKit** (software `drawAtlas` does not rasterize `RuntimeEffect`; verified
2026-07-08 by driving the effect with a discriminating atlas color and reading back the raw atlas,
not shader output), so GPU-visual validation of the three effects is deferred to the owner manual-test
window; z-order test proves cross-texture ordering preserved; stretch-with-effect test drives a
`stretch:true`+effect command through the frame-renderer (not just the batch key); dead-zone follow
test; api-specs updated to match. **If the calendar is red, the water/fog/fire binding + the z-order
fix are the launch-critical subset (the headline claim); stretch/dead-zone can slip to 0.4.x.**

#### OSS-E2 · MIT → Apache-2.0 relicense (P0, 1 session, [MT]) — the missing owning row

**Scope:** root `LICENSE`, `NOTICE`, `TRADEMARK.md`, all 41 `packages/*/LICENSE`, all 41
`packages/*/package.json` + root + `benchmarks/package.json` `"license"`, ~35 package READMEs, root
`README.md` badge+link, `CONTRIBUTING.md:120`. Contributor history is clean (`git shortlog`: owner +
3 `github-actions[bot]` version-bump commits — no third-party copyright), so this is a safe
unilateral relicense. §0.2's stated scope ("swap LICENSE + badge, add NOTICE + TRADEMARK.md") misses
most of the surface below. license-compat lane is CLEAN (zero copyleft; §16 ledger).

- Root `LICENSE` → Apache-2.0 full text; **all 41 per-package `LICENSE` files** → Apache-2.0 (each is
  in its package `files` array and ships in the tarball — verified); `"license": "Apache-2.0"` (SPDX)
  in all 41 manifests + root + benchmarks.
- Add `NOTICE` (one copyright line — no vendored third-party code exists) at root AND add `NOTICE` to
  **every package's `files` array** so it ships (Apache-2.0 §4d propagates NOTICE per tarball).
- `TRADEMARK.md` reserving "Flare Engine" — matters because the name collision is **live** (see the
  amended §0.3 / §8 note); Apache-2.0 §6 grants no trademark rights.
- Prose: all ~35 package README MIT sections + root README badge (`:5`) + link (`:181`) +
  `CONTRIBUTING.md:120` inbound-license clause → Apache-2.0.
- **Do NOT** stamp a license on `create-flare-app` templates (verified: no `license` field today —
  scaffolded projects stay unlicensed / user's choice; keep it that way).
- Skip per-file SPDX headers (pure churn; root + per-package LICENSE + NOTICE is sufficient).
- Add a one-line note (README/CHANGELOG) that 0.1.0–0.2.1 were published MIT and stay MIT on npm
  forever; only 0.3.0+ is Apache-2.0.
- **Cross-row gates:** add `license == "Apache-2.0"` to F2's verdaccio tarball assertion and F3's
  scan; add an MIT-grep (`grep -rE '\bMIT\b'` over LICENSE/READMEs/manifests returns only intentional
  hits) to D4's done-when.

**Done when:** every LICENSE (root + 41) is Apache-2.0; every manifest SPDX is Apache-2.0; NOTICE
ships in all tarballs; no `MIT` in prose except the immutability note; TRADEMARK.md exists; F2/F3/D4
gates updated. **Run E2 with E1 (both [MT] governance) — one session.**

### Amendments to existing rows

- **OSS-C1 (§5): the RN peer floor is `>=0.79.0`, not `>=0.78.0`.** Fact-checked 2026-07-03:
  `@shopify/react-native-skia` 2.x requires `react-native >=0.79` (Skia ≤1.12.4 for RN ≤0.78), so a
  `>=0.78.0` + Skia `>=2.0.0` pairing is self-contradictory. Set the react-native floor to
  `>=0.79.0` in all 5 packages. (React `>=19.0.0` and Skia `>=2.0.0` are correct.) Confirmed
  available: current Skia is 2.6.6; **Expo SDK 57 shipped 2026-06-30** = RN 0.86 / React 19.2, so
  the B14/C1 target stack is real and current before freeze.
- **OSS-B12 (§4): two additions.** (1) `provider.ts:98/109` `Purchases.getProducts(ids)` passes no
  product category → react-native-purchases defaults to SUBSCRIPTION, so on Android one-time products
  return empty (blank catalog, `purchase()` "Product not found"); pass the category (the local type
  `types.ts:11` already models `type?: string`). (2) `provider.ts:86` `await import('react-native')`
  with no declared RN peer — declare `react-native >=0.79.0` as a peer (the deps lane flagged this;
  C1's matrix must add iap-revenuecat as a 6th RN-peer package). Also drop the phantom `react` peer
  it never imports.
- **OSS-D5 (§7): expand to a full api-specs re-derivation, not a 5-item spot-fix.** The audit found
  api-specs sections that **do not compile** against HEAD beyond D5's known list: animation
  `spring(config)` (`:175`), errors `send`/`createConsoleTransport`/`onError` (`:361-364`), iap
  EntitlementStore (`:720`, whole section wrong), testing MockInputManager + FakeClock units
  (`:383`). Re-derive each package's api-specs section from its `src/index.ts` surface; ideally have
  D1's snippet harness also compile the ` ```ts ` blocks inside api-specs.md (not just READMEs).
- **OSS-B20 (§4): also rename `ShopPanelProps`** (it collides too, not just `ShopPanel`).
- **OSS-M2 (§6): de-dup two barrel collisions.** `CompiledShader` (postfx + render) and `SkImageLike`
  (assets + postfx) both re-export through the engine barrel and clash for umbrella consumers —
  alias/namespace them during the barrel curation (they're per-package structural duck-types; fix at
  the barrel, not the packages).
- **§0.3 (name): the collision is LIVE, not dormant.** flarerpg.org's Flare shipped v1.15 on
  2026-05-03 and its GitHub repo is literally `github.com/flareteam/flare-engine` (identical repo
  name). Keep the disambiguation line (rename unwarranted — owner holds domains + npm org) but it
  should name the identical repo, and TRADEMARK.md (E2) is now worth doing, not optional.
- **§14 (owner ledger): token rotation timing moved.** The npm publish-credential rotation was
  rescheduled so a fresh credential covers the freeze publish + manual window + Oct 20 flip; timing
  specifics live in the private owner-ledger. Alternatively, pull Trusted Publishing OIDC forward.
  The private owner-ledger has been updated to October dates (2026-07-03).

### Completed cross-cutting lanes (2026-07-03)

- **license-compat: CLEAN.** 37 external deps, all MIT / Apache-2.0 / BSD-3-Clause; zero copyleft.
  Apache-2.0 relicense unblocked. (Recommend one `license-checker --production` run at freeze to
  seal the transitive layer; direct surface is clean.)
- **api-consistency: consistent surface,** 3 barrel collisions (folded into B20/M2 above) + one
  `…Opts`→`Options` P2 (pre-1.0 breaking window).
- **deps lane:** `engines` field missing on 39/41 packages; exports maps point ESM consumers at the
  CJS `.d.ts` (unused `.d.mts` never referenced — nested types conditions fix); stale
  `packageManager bun@1.2.0`; unused root `maxrects-packer` devDep; 10 packages carry dead
  `@types/react ^18` letters. → the **now-real OSS-C2 packaging-polish row (§17)** (was homeless — no
  C2 row existed; created 2026-07-05). The ESM-`.d.mts`/exports-condition item is additionally
  validated by **C3's `publint` + `@arethetypeswrong` gate**; `packageManager` currency → C4, CI
  `bun-version` pin → C3.

---

## 17. Deep-audit addendum (2026-07-05) — new + amended rows

26-agent audit (plan coherence · SOLID/DRY/KISS/YAGNI · repo/tooling · TS/RN/Skia conformance vs
current official docs), every finding adversarially re-verified. Full evidence ledger:
`_local/deep-audit-2026-07-05.md`. **Direction CONFIRMED:** all version floors validate correct
(Skia 2.x→RN≥0.79/react≥19, Expo 57/RN 0.86/React 19.2, gesture-handler-drop safe, React-19 compat,
New-Arch mandatory at the target). What follows is only what the queue MISSED.

### New pre-freeze correctness rows (Arc B)

- **OSS-B25 · share + deep-links: platform-adapter correctness (P1).**
  - share `share.ts:127`: `dispatched: res.action !== 'dismissed'` is wrong — RN returns `'sharedAction'`/`'dismissedAction'`, never the bare `'dismissed'`, so an iOS Cancel reports `dispatched:true`. Fix `=== 'sharedAction'`; the test at `share.test.ts:71` fakes `{action:'dismissed'}` (agrees with the bug) — rewrite it against the real RN constants.
  - deep-links `sources.ts:42-66`: `createWebSource` adds one shared `onPop` closure per subscriber; DOM dedupes identical `(type,cb,capture)` registrations, so the first `removeEventListener` kills navigation for every remaining subscriber. Fix: ref-count the DOM listener (add on first, remove on empty) or register a distinct per-subscriber closure. `manager.test.ts` only uses one subscriber — add a two-subscriber test.
  - **(2026-07-08 audit adds — same file, distinct angle):** `onPop` dispatches with `for (const l of listeners) l(href)` over the **live** `listeners` Set (`sources.ts:48`), so a handler that subscribes mid-dispatch is visited in the same dispatch (CONFIRMED); `notify` at `:63` shares the pattern. Snapshot with `[...listeners]` before the loop as part of this row's `sources.ts` fix.
  - **Done when:** iOS-cancel returns `dispatched:false` against real constants; two web subscribers both keep firing after one unsubscribes; a listener that (un)subscribes during a `popstate` dispatch does not change who receives that dispatch (snapshot test).

- **OSS-B26 · shapes: ShipSpec bounds include weapons + engine (P1).** `bounds.ts:39-40,:69-70`: `singleShapeRadius('ship')`/`boundsR('ship')` use hull only; a weapon `RectSpec` at `ox` beyond the hull radius (or the engine `SquareSpec`) is rasterized into a hull-sized atlas tile and its `draw.ts:108` glow ring clips. Fix: return `max(hullRadius, max_weapons(hypot(ox,oy)+weaponRadius), engineRadius)` in both. **Done when:** a wing-weapon ship's atlas tile + glow ring contain the full silhouette (add a fixture).

- **OSS-B27 · iap-revenuecat: configure-once race (P1).** `provider.ts:82-92`: `configured` flips only after two awaits, so `Promise.all([getProducts(), restore()])` double-calls `Purchases.configure`. Fix: memoize `configurePromise ??= (async () => {…})()` awaited by every entrypoint. **Done when:** two concurrent first calls invoke `configure` exactly once (mock-count test). NOT covered by B12 (which is restore/listener/tx-id/peer).

- **OSS-B28 · ui + ui-shop: focus side-effect + shop refetch (P1; coordinate B15/M1).**
  - ui `focus.ts:88-95`: `register()` calls `setFocused` as a side effect → on a touch-first engine the first enabled `Button` renders a permanent focus ring with no input; it also picks mount order over sorted `tabIndex` (contradicts `focus.ts:12`). Fix: no focus inside `register()`; leave `focusedId` null until a driver focuses; if an initial focus is wanted, make it explicit opt-in selecting `orderedIds()[0]`.
  - ui-shop `ShopPanel.tsx:39-53`: `fetched` ref guard makes the fetch run once for the component's life while the effect deps are `[catalog, provider, onError]`; a Noop→concrete IAP provider swap never refetches. Fix: key the fetch to catalog/provider identity (reset products to null on change) or drop those deps and document a mount snapshot.
  - **Done when:** mounting a `FocusProvider` renders zero focus rings until a driver acts; swapping the provider refetches products. Sequence after B15 (reactive focus) / with M1.

- **OSS-B29 · render: SpriteBatch bucket pooling (P1, hot-path). — SUPERSEDED by B24.** The premise (`flush()` re-allocating a `{…,commands:[]}` bucket per unique key, discarded via `batches.length=0`, with a dead `commands.length=0` loop) predates the B24 streaming refactor (`e271eb2`), which replaced the multi-bucket-per-key allocator with a single reused run-bucket (`_batches[0]`): allocated once, reused every frame, its `commands` array reset in place (identity preserved). There is no `batches.length=0`, and the two `commands.length=0` calls are required run/frame resets, not dead work. The "Done when" (zero bucket allocation in an effect/alpha-heavy frame after warm-up) was thus already met; the proposed multi-bucket-pool-with-live-count would *regress* memory/complexity vs the streaming design. **Delivered instead:** the zero-alloc invariant is now locked by an instrumented guard (`sprite-batch.test.ts` — "bucket pooling (zero-alloc)": eight-run interleaved frame flushed 100× keeps `_batches.length` at 1 with stable bucket + `commands`-array identity). No `src` change → no changeset.

- **OSS-B30 · API-freeze alignment (P1 — frozen after flip; land before H1).**
  - postfx `effect.ts:209-212`: `createColorGradingLut(uniforms, id)` inverts the `(id='…', uniforms={})` order of all 11 sibling factories. Align to `(id='color-grading-lut', uniforms)`; update README/api-specs.
  - create-flare-app `manifest.ts:16,41,43`: `TEMPLATES: Record<string, TemplateManifest>` makes `keyof` = `string|number`, so `TemplateId` gives zero narrowing and `isTemplateId` narrows nothing. Fix: `const TEMPLATES = {…} satisfies Record<string, TemplateManifest>` so `keyof` collapses to `'blank'|'topdown'|'shmup'`; `isTemplateId` becomes a real guard both CLIs reuse (with B13/HYG8).
  - **Done when:** postfx factory signatures are uniform; `TemplateId` is the literal union and `isTemplateId` narrows (type-level test).

- **OSS-B31 · latent web/devtools correctness (P2 — no shipping consumer today).**
  - render-web `postfx-surface.ts:114-141`: `blit()` never reads `pass.children`, so `color-grading-lut`'s LUT sampler is unbound (native binds it via `skia-bridge`). Wrap each child SkImage via `makeShaderOptions`, append after `srcShader` before `makeShaderWithChildren`; fix the stale `runtime.ts:80` "no extra children" doc. (Overlaps C1's `createWebFrameRenderer`; do whichever runs first, note the other.)
  - devtools `time-scrubber.ts:57-99`: `resume()` hardcodes `timescale=1`, clobbering an active slow-mo. Fix: save the prior timescale on `pause()` and restore it (mirror `debug` `TimeControl`). The shared pause/step core → HYG7.
  - **Done when:** a web color-grading-lut pass reads back graded pixels; resuming a 0.5× scrub returns to 0.5×.

- **OSS-B23b · deep-links + input-package input-hardening spillover (P2 — surfaced by the 2026-07-08 B23 web-input scope-check).** The same input-validation / prototype-safety classes B23 fixes on the animation/audio/core/dialogue/localization data paths also exist on the **web URL surface** + the **input package**, outside B23's 5-package scope. Adversarially verified (3-auditor sweep + per-finding refute pass):
  - **deep-links prototype read-leak (CONFIRMED, UNASSIGNED):** `parse.ts:76` builds the URL query map as a plain `{}` (`query[key] = safeDecode(rawVal)` at :85) and `router.ts:38` re-wraps it (`const combined: Params = {...parsed.query, ...params}`; `tryMatch`'s `out` at :57 shares the shape), so a read of an **absent prototype-colliding key** — `parseUrl('x?a=1').query['constructor']`, `match.params['toString']`, `…['__proto__']` — returns the inherited native member instead of `undefined` (empirically executed). Same class as B23's dialogue `getNode('__proto__')` + localization `t('constructor')`, but on genuinely web-supplied input. Fix: base both maps on `Object.create(null)`. NOTE: prototype *pollution* via a `__proto__` **write** is REFUTED (string assignment to that key is a spec no-op) — only the **read-leak** needs the fix. Not owned by B25 (which touches deep-links only for the `createWebSource` listener ref-count).
  - **input-package hang-guards (CONFIRMED by audit, UNASSIGNED):** `virtual-joystick.ts:74` (`maxRadius === deadZone` + touch ≥ deadZone → 0/0 = NaN magnitude) and `:77` (`deadZone <= 0` + centre touch → `1/dist` = Infinity direction); `gamepad.ts:82` raw `updateGamepadFromSnapshot(…, deadZone === 1)` → `1/(1-deadZone)` divide-by-zero (the `InputManager` wrapper clamps to `[0,0.95]`; only the **raw export** is unguarded). Same non-positive-arg class as B23's `frameDuration`/`maxPolyphony`/`fixedDt`. Fix: validate/throw or clamp the degenerate config. No row owns `virtual-joystick.ts`/`gamepad.ts` (M1 = keyboard/input-manager/remap; B11 = pointer). Shared touch/gamepad math (not DOM-specific).
  - **Deliberately NOT in this row:** `render-web/postfx-surface.ts:185` NaN-resize (REFUTED as a live bug — zero/neg dims **are** clamped, NaN only blanks a frame + warns — and **C1** already rewrites that resize path); `deep-links/sources.ts:48` popstate iterate-during-dispatch (CONFIRMED but folded into **B25**'s done-when — see B25's deep-links bullet).
  - **Done when:** deep-links query/param reads of `constructor`/`toString`/`__proto__` for absent keys return `undefined` (test both `parseUrl().query` and `router` `match.params`); joystick/gamepad reject-or-clamp non-positive/degenerate deadZone+radius (no NaN/Infinity in the output vector). **P2** — latent (bites only when a consumer reads a colliding key / a caller passes a degenerate config); pre-freeze desirable, not launch-blocking.

### New packaging / CI / toolchain rows (Arc C)

- **OSS-C2 · packaging polish + manifest fixes (P1) [MT].** `engines: {"node": ">=…"}` on all 41 shipping manifests; each `exports["."]` gains an ESM `import.types` → `.d.mts` (or prove `attw`-clean without it under C3); ~~ui-shop `react-native` peer `>=0.74.0`→`>=0.73.0`~~ **(SUPERSEDED by C1 2026-07-09: C1 raised `ui` AND `ui-shop` to `>=0.79.0` — the Skia-2.x RN floor; do NOT lower ui-shop to 0.73, it would regress below that floor)**; `@types/react ^18.0.0`→`^19.0.0` across react/errors/devtools/ui/ui-shop/achievements/analytics/haptics/leaderboards/iap; drop the unused root `maxrects-packer` devDep; fix engine umbrella `description` ("re-exports all packages"→core-set) + add the dropped `react-native-safe-area-context` peer (or drop the redundant re-declared peers). testing/share `homepage` grzott/engine→flare-engine stays with **A0**. Retires the ambiguous "(was draft C2)" alias (done in §5). **Done when:** every manifest has `engines`; the peer/type versions above are consistent; `bun run build` + `check:deps` green. **DONE 2026-07-09 (session #237) — full record: todo.md ## Done.** Two corrections vs this spec: (1) the "add the dropped `react-native-safe-area-context` peer" item was **already satisfied by C1** (engine peer present since #236) → C2 made no peer change; (2) exports shipped via the `.d.mts` route (Form-A: per-condition `import.types`→`.d.mts` / `require.types`→`.d.ts`, `"."`-level `types` **dropped** so ESM resolves `.d.mts` instead of the shadowing CJS `.d.ts`), proven attw-clean on math/core/react/engine/ui-shop/cli across all four resolution modes — not the deferred "prove-clean-under-C3" fallback.

- **OSS-C3 · CI + guardrail + publish-safety gate (P0) [MT].**
  - Add `publint` + `@arethetypeswrong/cli` as devDeps; run per publishable package after build in CI (and gate release.yml). This is the current standard gate for hand-authored exports + dual CJS/ESM going public.
  - Add a **nodenext validation pass**: `tsconfig.publish.json` (`module`/`moduleResolution: nodenext`) run `tsc --noEmit` over `packages/*/src` in CI — dev keeps `bundler` for speed, but this proves the exports map + dual-format resolve for Node/Metro consumers (bundler never checks this; F1 finding).
  - Resolve the **create-flare-app publish landmine**: it is `private:true` + `version:0.0.0` + `publishConfig.access:"public"` + a `bin` → cannot publish. Decide with B13 (join the fixed group / real version) and add a release preflight: no package with `publishConfig.access:"public"` may be `private`.
  - ci.yml `push: branches:[main]` trigger (with F1's runbook/CI work — one edit to ci.yml, not two); pin `bun-version: 1.2.0` in ci.yml + release.yml (match `packageManager`); broaden lint to `tests/` + root `scripts/*.mjs` (`.mjs` into lint-staged glob); publish preflight hard-fails on any `workspace:` at pack time (concretize is a no-op today).
  - **Already landed 2026-07-05 (this row records them):** turbo `globalDependencies` (root config cache-correctness); `check-deps-tiers` LAYER_MAP filled to all 40 scoped + progression→2 + persistence tier 2.5, and an **unmapped-scoped-package hard error** (was `continue` past 9 packages); biome `noDefaultExport: error` (+ `**/*.config.ts`/`apps/**` override) enforcing "named exports only".
  - **Done when:** CI runs publint+attw+nodenext green; a push to main runs the full gate; no publishable package is `private`; the three landed items are in CI.

- **OSS-C4 · toolchain upgrade (P1) [MT]; owner said "all upgrades now" (2026-07-05).**
  - Biome `^1.9`→`^2` — run `biome migrate --write` (`organizeImports`→assist model, `files.ignore`→`files.includes` negated globs, schema URL); review the v2 import-organizer behavior change.
  - tsup→tsdown across all 41 `tsup.config.ts` (Rolldown-based successor; tsup README says "not actively maintained") — gains built-in publint/attw (can subsume part of C3).
  - TS floor `^5.5`→`^5.9` (evaluate 6.0 GA) + optional `isolatedDeclarations` on published packages for faster/tool-agnostic `.d.ts`.
  - `bun-types`→`@types/bun` with `"types":["bun"]`, scoped to a **test-only** tsconfig so the shipped-src typecheck carries no Bun ambient globals (RN/Web packages validated against their real runtime); add `moduleDetection:"force"` to `tsconfig.base.json`; bump `packageManager` bun to current.
  - Document the **New-Architecture requirement** (engine is arch-agnostic pure-TS, but the RN≥0.79 floor still admits old-arch 0.79–0.81; reanimated 4 is New-Arch-only) in the engine README/getting-started.
  - **Done when:** `bun run lint`/`build`/`test` green on Biome 2 + tsdown; typecheck floor bumped; shipped-src typecheck has no Bun ambient; New-Arch note published.

### Post-flip Arc HYG (SOLID/DRY/KISS/YAGNI cleanup — NOT before the flip)

Verified duplication / dead code / leaky idiom (ledger §6). Correctness-neutral. Rows HYG1–HYG8 are
listed in `todo.md` below the P2 line; run after the October flip. Representative scope: dedupe
math collision predicates + the misnamed `spring*`(=Back) easings; `Prefab.spawn` dead `overrides`
param + honest `AppLifecycle` docstring; six zone-bg effects → descriptor table + shared SkSL
snippet constants (render/postfx); `fillStrokePath` + shared `argbToFloat4Into` (shapes ×5 sites);
`nbody`→`verletStep`, Map-keyed `SpatialIndex`, `applyRemapInto`, dead `AudioManager.factory`;
`_teardownStack`, math `linear` reuse, shared pathfinding `heap.ts`, sync-or-await `ActionHandler`;
dead version-key writes + `nowMs`/`StatsTracker`/`resolveTier` dedupe + `devtools.enabledOnNative`
wire-or-drop; shared subsystem-wiring factory (`GameView`/`createGame`), shared CLI parsers,
`getGrantsForProduct`/`ProductType` dedupe, `createWebSurface` flush/dispose handle. Full per-item
file:line in the ledger.
