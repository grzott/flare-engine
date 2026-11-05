# Flare Engine — 2.5D Lighting Proposal

> Status: **proposal — not approved, not scheduled**
> Drafted: 2026-05-08
> Revised: 2026-05-08 (research validation)
> Author: design discussion (Otto + Claude)
> Scope: new packages `@flare-engine/lighting`, `@flare-engine/asset-normals`; extension to `@flare-engine/render`.
> Consumer: Berek, named by the owner on 2026-11-05. Gate 0 spike: [#206](https://github.com/grzott/flare-engine/issues/206).

---

## Review notes (2026-11-05)

Berek's design (its decision `V2-08`) sent four notes on this proposal. **They are review notes. They
do not approve the proposal, schedule it, or change any gate except Gate 0, which L6 re-aims.** The
text below stands except where a note corrects a fact, and those passages point here. Berek's other
lighting needs wait until its look-target screen has measured numbers, so they are not recorded here.

**L1. World shadows are ground-plane sprites. 1D polar shadow maps are for interiors and caves only.**
The world model is a shadow sprite lying on the ground plane and rotated around the caster's foot
anchor. Each caster gets one for the sun and one for each of the 2–3 nearest lights, drawn from
about ten reusable shapes. Small things get a blob, and tall props may take an optional height-map
shadow.

- **Why not polar maps in the world.** A 1D polar map casts its shadow in the screen plane. In a 3/4
  view the screen plane is not the ground, so the shadow slides up walls and over roofs. Inside an
  interior or a cave, walls bound the space, and the polar map stays a useful tool there.
- **Precedent.** *Graveyard Keeper* draws its shadows as sprites rotated around a point: at most four
  per object, the sun's plus one for each of the three nearest dynamic lights, from about ten
  reusable shadow sprites ([Svyatoslav Cherkasov, "Graveyard Keeper: How the graphics effects are
  made", Game Developer, 2018-10-23](https://www.gamedeveloper.com/programming/graveyard-keeper-how-the-graphics-effects-are-made)).
- **Cost.** The reference polar technique makes two offscreen passes per shadowed light before the
  lit draw: occluders into a light-centred target, then a reduction to the 1D map ([mattdesl,
  2D Pixel-Perfect Shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows)).
  That page's own optimisation notes pack several lights into shared targets, but every pass is still
  a render-target switch. On a tile-based mobile GPU, each switch writes the finished tiles back to
  main memory, and Arm advises keeping the number of render passes to a minimum ([Arm, *Understanding
  Render Passes*, 2021](https://documentation-service.arm.com/static/6560a5942c8b3557fee70a16)).
  Shadow sprites draw in the existing sprite batch with no offscreen pass.

**L2. Hand-authored normal and height maps are the primary input.** `flare gen-normals --algo bevel`
is a fallback for props whose geometry really is bevelled. Sobel from colour is only for texture-like
tiles. This replaces the proposal's "default to bevelling" (Research Validation, change 2). The
runtime is unaffected, because it never cares where a normal map came from.

**L3. The normal-map citation is corrected.** arXiv 2212.09692, ["Analysis and Compilation of Normal
Map Generation Techniques for Pixel Art"](https://arxiv.org/abs/2212.09692), is by Rodrigo D.
Moreira, Flávio Coutinho and Luiz Chaimowicz (SBGames 2022), not "Araujo et al. 2022".

- **What it compares.** Six methods: hand painting, Sobel on the colour map, Sobel on a hand-painted
  height map, bevelling, merging four painted light directions, and a generative model. It compares
  them qualitatively, on one sprite, and ranks none of them. The 1st-to-6th ranking this proposal
  quoted is not in the paper.
- **What it finds.** Only the hand-painted normal map and the four-light merge are geometrically
  consistent with the expected shape. It calls bevelling useful for objects expected to have a
  bevelled geometry, and does not recommend it as a default.

**L6. Gate 0 is re-aimed: measure the cost, not the uniform ceiling.** The uniform-buffer ceiling is
unlikely to bind. OpenGL ES 2.0 guarantees only 16 fragment uniform vectors ([Khronos, `glGet`](https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml)),
but even an Adreno 320 reports 224 ([gpuinfo report](https://opengles.gpuinfo.org/displayreport.php?id=17)).
At two vectors a light (position and radius, colour and intensity), 16 lights need about 32. The
spike measures these instead, on one Mali phone and one Adreno phone at Berek's device floor, a
mid-range Android phone:

1. the light loop's cost per lit fragment, as the light count grows;
2. lighting computed at art resolution and scaled up, against lighting computed at screen resolution;
3. the cost of an offscreen pass, which prices both the polar maps L1 keeps and any art-resolution
   light buffer.

Filed as [#206](https://github.com/grzott/flare-engine/issues/206).

---

## Research Validation (2026-05-08)

The original proposal was validated against current 2026 research (Skia/RN Skia capabilities, reference 2D lighting implementations, normal-map literature, WebGPU alternatives). Three substantive changes follow; the rest of the document stands.

**Confirmed unchanged:**
- SkSL `RuntimeEffect` on RN Skia (Ganesh) is sufficient. WebGPU / Graphite / TypeGPU not production-viable for 12–18 months and offer no lighting-specific advantage.
- C++ via Nitro Modules is irrelevant for lighting. The GPU does per-pixel math; CPU-side uniform packing for ≤32 lights × ≤128 occluders is microsecond-scale on Hermes. Revisit only if profiling exceeds 1ms — implausible at 2D mobile scale.
- PT's shape-primitive renderer produces analytical normals (rect face = (0,0,1), circle = radial). Skips the entire normal-map asset pipeline for the prototype.

**Changed:**

1. **Shadow algorithm: switch from raymarched SkSL to 1D polar shadow maps.** The LWJGL/mattdesl technique (render occluders to FBO → reduce to 1D shadow map per light → sample in polar space during light render) is production-proven by Defold's official sample and LibGDX Box2D Lights. Cost: ~0.5–1ms per light on mid-tier mobile, scales linearly with light count, fill-rate efficient, GLES2-compatible. Raymarched shadows have parallel-edge pathologies and worse cost curves. References: [LWJGL 2D Pixel-Perfect Shadows](https://github.com/mattdesl/lwjgl-basics/wiki/2D-Pixel-Perfect-Shadows), [Defold sample](https://github.com/defold/sample-lights-and-shadows).

2. **`asset-normals` default algorithm: beveling, not Sobel-from-luminance.** Moreira, Coutinho and Chaimowicz (SBGames 2022, [arXiv 2212.09692](https://arxiv.org/abs/2212.09692)) compared 6 normal-map generation methods for pixel art. Default the CLI tool to beveling; offer Sobel-from-height as a fast fallback with quality caveat in docs. *(This paragraph credited the paper to "Araujo et al." and quoted a ranking the paper does not contain; review note L3 states what it finds, and L2 replaces the bevel default.)*

3. **Reference target: Don't Starve, not Hades.** Hades' "2D lighting" is pre-baked 3D rendering (Maya → Substance → ambient occlusion + curvature + thickness maps baked into 2D animation frames) composited at runtime — it is art-direction quality, not runtime technique. Don't Starve uses a single darkness overlay + additive light discs and feels excellent at near-zero cost. Realistic Flare aim: Don't Starve baseline + normal-mapped sprites + 1D polar shadows. Higher than that requires asset-pipeline investment, not engine code.

**New blocker before any package work:**

- *(Re-aimed by review note L6: the spike measures cost, not this ceiling.)* **Spike: measure RN Skia uniform-buffer ceiling on a 2018-class Android device.** Spec floor is 16 vec4 fragment uniforms; practical maximum varies 16–256 across drivers. Need to compile + run a SkSL shader with `uniform float4 lights[16]` and confirm 60fps. ~2 hours. Gates the entire design — if the ceiling is 8 lights, the architecture changes (deferred / additive-blend path required).

**One sobering data point:**

No published RN Skia or CanvasKit game implements runtime 2D dynamic lighting in 2026 (researcher found none after surveying GitHub, npm, blog posts). Flare would be the first. Treat as either opportunity or warning sign — strengthens the "PT prototype before package" gate below.

**Two adjacent free wins — both SHIPPED, ahead of any lighting work:**

These are postfx-only effects with disproportionate visual leverage. Both extend the existing `@flare-engine/postfx` `EffectChain` and required no new package:

- **God rays** — `createGodRays`, exported from `@flare-engine/postfx`. Single-pass volumetric light scattering per [GPU Gems 3 Ch. 13](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process). Boss intros, sky scenes.
- **Color grading LUT** — `createColorGradingLut` + `createNeutralLutBytes`, exported from `@flare-engine/postfx`. Zone/boss mood shift via texture swap.

Both are higher-leverage-per-line than starting the lighting package and ship without gating on the uniform spike or PT prototype. Recommend scheduling these into a postfx-extension session ahead of any lighting work.

---

## Motivation

Plain 2D rendering is no longer a visual differentiator on mobile. Reference titles — Hades, Don't Starve, Sea of Stars, Diablo 2 — are technically 2D but feel premium because of five overlapping techniques:

1. Normal-mapped sprites (per-pixel surface direction)
2. Dynamic point / spot / directional lights
3. 2D shadow casting (raymarched or precomputed)
4. Y-sort + parallax layers (cheap depth illusion)
5. Color grading + bloom (mood, "expensive" feel)

Items 4 and 5 are already trivial on the current stack (CPU sort; [packages/postfx](../../packages/postfx) for grading/bloom). Items 1–3 are the gap.

**Key insight:** SkSL `RuntimeEffect` is exposed by both `@shopify/react-native-skia` and CanvasKit. [packages/postfx](../../packages/postfx) already runs custom SkSL shaders successfully. Therefore 2.5D lighting is reachable on the existing renderer — **no WebGPU migration required**.

---

## Non-Goals

- Real 3D meshes / depth buffer / Z-prepass — that is a different engine, not 2.5D.
- WebGPU compute (particles, fluids) — separate future tier; see [memory: WebGPU Watch List].
- Shadow-map textures from arbitrary 3D occluders — out of scope; we use 2D occluder primitives.
- Global illumination, reflections, refractions — out of scope.

---

## Architecture

### New package: `@flare-engine/lighting`

**Layer:** 2 (Systems) — depends on `math`, `events`, `ecs`, `render`.

**Surface:**

```ts
// Components
export const Light = defineComponent('Light', {
  kind: 'point' | 'spot' | 'directional',
  position: Vec2,        // world-space; ignored for directional
  direction: Vec2,       // unit vector; ignored for point
  color: Color,
  intensity: number,     // 0..N
  radius: number,        // point/spot falloff distance
  coneAngle?: number,    // spot only, radians
  castShadows: boolean,
});

export const Occluder = defineComponent('Occluder', {
  shape: 'rect' | 'circle' | 'polygon',
  // shape data: AABB, Circle, or Vec2[] in local space
});

// Systems
export const LightingSystem = defineSystem('Lighting', { ... });
//   - Each frame: query all Light entities, pack into Float32Array uniform buffer
//   - Per-camera frustum cull
//   - Cap N (e.g. 16 active lights per draw call) — overflow uses tile/cluster fallback (deferred)

// Shadow pass
export function createShadowPass(opts: {
  maxOccluders?: number,    // default 32
  maxLights?: number,       // default 8 shadow-casters
  resolution?: number,      // shadow texture size, default 512
}): ShadowPass;

// API mirrors postfx EffectChain pattern:
// const shadow = createShadowPass({ ... });
// shadow.render(ctx, lights, occluders) → Skia image
```

**Shadow algorithm (revised 2026-05-08): 1D polar shadow maps.** *(Review note L1 limits these to interiors and caves; the world model is ground-plane shadow sprites.)* For each shadow-casting light: (1) render occluders into a small FBO centered on the light; (2) reduce that occlusion map to a 1D shadow map (one distance-to-nearest-occluder per angle, typically 256 angles); (3) in the lit-sprite shader, sample the 1D shadow map in polar space using `atan2(fragPos − lightPos)`. Cost ~0.5–1ms per light on mid-tier mobile, scales linearly with light count, fill-rate efficient on GLES2. Production-proven in Defold's official `sample-lights-and-shadows` and LibGDX Box2D Lights. Originally proposed raymarched approach has parallel-edge pathologies and worse cost curves — superseded.

### Extension: `@flare-engine/render`

Add an opt-in lit path. The existing unlit path remains the default — no perf regression for games that don't need lighting.

```ts
class SpriteBatch {
  // existing:
  draw(sprite, x, y, opts?): void;

  // new (lit path):
  drawLit(sprite, normalMap, x, y, opts?): void;
}

// New built-in shader
export const LitSpriteEffect: SpriteEffect;
//   Inputs:
//     - diffuse texture (existing)
//     - normal texture (new)
//     - light uniform buffer (from LightingSystem)
//     - shadow attenuation texture (optional, from createShadowPass)
//   Output: lit RGBA, dotted N lights with normal map, shadow-multiplied
```

Implementation note: `SpriteBatch` already supports per-sprite `SpriteEffect`. The lit path is a new effect plus a second texture binding — no architectural change to the batcher. Atlas pipeline must pack diffuse + normal as paired textures.

### New package: `@flare-engine/asset-normals` (CLI / build-time only)

**Layer:** tooling — depends on `cli` infrastructure, not runtime.

```bash
flare gen-normals --in assets/sprites --out assets/sprites/normals --algo bevel
flare gen-normals --in sprite.png --algo sobel-height --strength 1.5
```

- **Default algorithm: beveling** (revised 2026-05-08 from Moreira, Coutinho and Chaimowicz 2022). Sobel-from-height-map offered as fast fallback when a height map exists. *(The ranking once quoted here is not in the paper, see review note L3; review note L2 makes hand-authored maps the primary input and bevelling a fallback for bevelled props.)*
- Hand-authored normal maps (Aseprite Normal Map Preview / Normal Toolkit plugins, Laigter, SpriteIlluminator) bypass this entirely. Runtime doesn't care where the normal came from.
- This package is optional. Games can ship without it. **Defer authoring this package** until a sprite-based Flare game (not PT — PT uses analytical normals from shape primitives) needs it.

---

## Validation Plan: PT-First

Before promoting shaders into the package, gates run in order:

0. *(Re-aimed by review note L6; filed as #206.)* **Spike: uniform-buffer ceiling on a 2018-class Android device.** Compile + run a SkSL shader with `uniform float4 lights[16]` (= 48 vec4 = 192 floats per draw). Confirm it compiles, links, and renders at 60fps on the lowest target device. ~2 hours. **Gates the entire design** — if practical ceiling is <16 lights, the architecture changes (deferred / additive-blend path required, not a single forward pass).
0.5 **Free postfx wins (parallel, no dependency on lighting work):** add **god rays** (~20 lines SkSL, GPU Gems 3 single-pass) and **color-grading LUT** (~15 lines SkSL, 64×64×64 texture sample) to the existing `EffectChain`. These ship visible upgrades without waiting on lighting and validate that boss-tier presentation is engine-budget-feasible.
1. **Single boss, single rim light.** Pick the next boss intro. Add one moving point light overhead. PT's shape-primitive renderer computes normals analytically (no normal map asset). Measure FPS impact on lowest target device.
2. **Add one shadow-caster (1D polar shadow map).** Per folio XIIIa (ship anatomy: hull + N rect weapons + 1 square engine), the rect weapons cast shadows from the rim light using the 1D polar shadow map technique. Visual + perf assessment.
3. **Promote.** If the prototype sells visually and stays in frame budget, lift the shaders + uniform-packing + 1D-polar-shadow code into `@flare-engine/lighting`. PT becomes the first consumer.

This avoids speculative module work — if 2.5D doesn't sell on PT's shape-primitive style, it likely doesn't sell at all, and we save the package work. **Sobering data point:** no published RN Skia or CanvasKit game implements runtime 2D dynamic lighting in 2026 — Flare would be the first. Treat as opportunity *and* warning.

PT specifically: shape-primitive rendering (no sprite atlas) means **no normal maps needed for stage 1**. Lights interact with shape geometry directly (analytical normals from rect/circle math). This actually simplifies the prototype — we can skip the asset-normals tool until a sprite-based game wants in.

---

## Out-of-Stack Deferrals

These belong to a future renderer tier, not this proposal:

| Capability | Why deferred | Trigger to revisit |
|---|---|---|
| GPU-compute particles | Skia has no compute path | Add `@flare-engine/render-wgpu` adapter |
| Tiled/clustered light culling for >16 lights | Mobile budget rarely supports this many anyway | If a game design demands it |
| ~~Volumetric / god-rays~~ | ~~Multi-pass; better as postfx, not lighting~~ | **Shipped as postfx `createGodRays`** — single-pass, no postfx 2.0 needed |
| Real shadow maps | Requires depth buffer | Out of scope — that's 3D, not 2.5D |

---

## Open Questions

1. Does `LightingSystem` live in the lighting package or in `render`? Leaning toward lighting (keeps `render` agnostic of light concept; opt-in via the lit shader).
2. Shadow texture lifecycle — recreated per camera per frame, or persistent + cleared? Bench both.
3. Maximum active light count — soft cap of 16 vs hard cap. Tied to uniform buffer size on lowest-target Skia GL ES driver.
4. Should `Occluder` reuse `physics` collider shapes, or stay independent? Reuse risks coupling 2 layers; independence risks duplicate authoring. Likely independent now, with optional `physicsToOccluder()` adapter.

---

## Decision Pending

This document is **proposal-only**. Promoting to a build-plan slice requires:

- PT prototype (steps 1–2 of validation plan) clears 60fps on a 2018-class Android device.
- Visual judgment that the technique meaningfully differentiates Flare-built games.
- Resolution of open questions 1 and 3.

Do not start engine work on `@flare-engine/lighting` until those gates pass.
