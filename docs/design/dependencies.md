# Flare Engine — Technology Dependencies

> Last updated: 2026-04-20

---

## Peer Dependencies (user installs)

### Core (Phases 1–6)

| Package                        | DL/week | Stars | Role in Flare                                  | Required by                                                                                 |
| ------------------------------ | ------- | ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@shopify/react-native-skia`   | 708K    | 8.3K  | GPU rendering, Atlas API, Canvas               | `@flare-engine/render`, `@flare-engine/react`                                               |
| `react-native-gesture-handler` | —       | —     | Touch/gesture input on native thread           | `@flare-engine/input`                                                                       |
| `react-native-reanimated`      | —       | —     | UI thread worklets for rendering               | `@flare-engine/render`                                                                      |
| `planck.js`                    | 142K    | —     | Box2D physics (optional tier; deferred)        | `@flare-engine/physics` (optional)                                                          |
| `react-native-audio-api`       | 37K     | —     | Native C++ audio engine (Software Mansion)     | `@flare-engine/audio`                                                                       |
| `react`, `react-native`        | —       | —     | Required by every Layer 4 / UI / React package | `@flare-engine/react`, `@flare-engine/ui`, `@flare-engine/errors`, `@flare-engine/devtools` |

### Phase 11 additions

| Package             | Role in Flare                                                          | Required by                             |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| `react-native-mmkv` | Synchronous C++ KV store (MMKV adapter — interface-gated, no hard dep) | `@flare-engine/storage` (adapter param) |
| `expo-sharing`      | Native share sheet fallback when Web Share API absent                  | `@flare-engine/share`                   |
| `expo-linking`      | Native URL handling for deep links                                     | `@flare-engine/deep-links`              |

### Tooling (dev-only, bundled by CLIs)

| Package           | Role                                            | Used by                                 |
| ----------------- | ----------------------------------------------- | --------------------------------------- |
| `commander`       | CLI argument parsing                            | `@flare-engine/cli`, `create-flare-app` |
| `sharp`           | Image decode / resize / encode for atlas packer | `@flare-engine/cli` (`pack-atlas`)      |
| `maxrects-packer` | Rectangle bin-packing for texture atlases       | `@flare-engine/cli` (`pack-atlas`)      |

---

## Internal Dependencies (bundled/used at build)

| Package | DL/week | Role                                   | Used by                 |
| ------- | ------- | -------------------------------------- | ----------------------- |
| `rbush` | 4.3M    | R-tree 2D spatial index for broadphase | `@flare-engine/physics` |

---

## ECS Options Evaluated

| Library  | DL/week | Stars | Approach                                           | Verdict            |
| -------- | ------- | ----- | -------------------------------------------------- | ------------------ |
| bitECS   | 4.4K    | —     | SoA data-oriented, high performance, ~5KB          | Good perf, weak DX |
| miniplex | 2.5K    | 1K    | Object entities, archetype queries, React bindings | Best DX, npm stale |

**Decision:** Build custom hybrid ECS. miniplex-style ergonomics (entities as typed objects) with optional SoA escape hatch for hot components. Avoids dependency on potentially unmaintained libraries.

---

## Physics Options Evaluated

| Library   | DL/week | TS?      | Approach                                                  | Verdict               |
| --------- | ------- | -------- | --------------------------------------------------------- | --------------------- |
| planck.js | 142K    | Yes      | Box2D TS port, idiomatic API. Published 8 days ago.       | Best for full physics |
| matter.js | 267K    | No       | JS, community @types. DOM assumptions. 2yr since publish. | Aging, DOM-coupled    |
| rapier2d  | 839     | Bindings | Rust/WASM. Hermes WASM support limited.                   | Not viable on RN      |

**Decision:** Two-tier physics. Built-in AABB (zero deps) for simple games. planck.js integration as optional peer dep for full Box2D.

---

## Audio Options Evaluated

| Library                | DL/week | Approach                                    | Verdict                    |
| ---------------------- | ------- | ------------------------------------------- | -------------------------- |
| react-native-audio-api | 30K     | Web Audio API, native C++, Software Mansion | Best — low latency, native |
| expo-av                | —       | Expo managed, higher latency                | Not game-oriented          |
| react-native-sound     | —       | Community, aging                            | Deprecated direction       |

**Decision:** `react-native-audio-api` as peer dep. Web Audio API gives `AudioBufferSourceNode.start()` for lowest latency JS playback. Same team as Reanimated.

---

## Skia Rendering Capabilities Detail

### Atlas API

```tsx
<Atlas
  image={texture} // SkImage — sprite sheet
  sprites={sprites} // SkRect[] — source rectangles
  transforms={xforms} // RSXform[] — pos/rot/scale per sprite
  colors={colors} // Optional tinting per sprite
/>
```

- `useRSXformBuffer` — worklet on UI thread, zero FFI cost
- `useRectBuffer` — animate source rectangles (sprite animation)
- `useTexture` — create GPU textures from React elements
- Single GPU draw call regardless of sprite count

### Picture API (Immediate Mode)

```tsx
const picture = usePicture((canvas) => {
  canvas.drawCircle(x, y, r, paint);
  // dynamic draw commands each frame
});
return <Picture picture={picture} />;
```

Best for particles and dynamic entity counts.

### Available Skia Effects for Games

| Game effect       | Skia API                                   |
| ----------------- | ------------------------------------------ |
| Tint              | `<BlendColor color="red" mode="multiply">` |
| Hit flash (white) | `<BlendColor color="white" mode="srcIn">`  |
| Grayscale         | `<ColorMatrix matrix={grayscaleMatrix}>`   |
| Outline           | `Skia.RuntimeEffect.Make(skslShader)`      |
| Colorblind modes  | `<ColorMatrix matrix={protanopiaMatrix}>`  |

---

## Storage for Game Saves

| Library           | DL/week | Stars | Approach                                                |
| ----------------- | ------- | ----- | ------------------------------------------------------- |
| react-native-mmkv | 784K    | 8.3K  | Synchronous C++ KV store, ~30x faster than AsyncStorage |

MMKV is the standard for game save data on RN. Synchronous reads mean no async loading screens for save files.

---

## Build Tooling Decisions

| Tool       | Role                     | Why chosen                                            |
| ---------- | ------------------------ | ----------------------------------------------------- |
| Bun        | Runtime, PM, test runner | Fast, built-in test runner, Zig-based                 |
| Turborepo  | Monorepo orchestrator    | Simple, fast, works with Bun                          |
| Biome      | Lint + format            | Single Rust binary, ~100x faster than ESLint+Prettier |
| tsup       | Package bundler          | Mature dual CJS+ESM, .d.ts generation                 |
| Changesets | SemVer versioning        | Manual control, independent versioning per package    |
