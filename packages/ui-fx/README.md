# @flare-engine/ui-fx

Animated wrappers for React Native, react-native-web and React DOM components.

**Status: private, not published.** The package is being built towards 0.5.0 and has no public API
yet. Design: [docs/plans/ui-fx-2026-11.md](../../docs/plans/ui-fx-2026-11.md).

## Entry points

- **`.`** — React Native and react-native-web. Never imports Skia.
- **`./dom`** — plain React DOM. Never imports `react-native`, Reanimated or Skia.
- **`./core`** — the headless maths. Imports `@flare-engine/math` only.
- **`./fx`** — the snapshot-effect host. Conditional exports pick the file: `react-native` resolves
  the RN-Skia host, `browser` and `default` resolve the CanvasKit host.

Each entry currently exports only `UI_FX_ENTRY`, a marker naming the entry that was resolved.

## Peer dependencies

`react >=19.0.0` is required. Every other peer is optional and belongs to one platform: `react-dom`,
`react-native`, `react-native-reanimated`, `react-native-worklets`, `@shopify/react-native-skia`,
`canvaskit-wasm`, `modern-screenshot` and `react-native-safe-area-context`.
