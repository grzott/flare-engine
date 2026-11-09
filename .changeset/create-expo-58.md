---
'@flare-engine/create': patch
---

Moves the `blank`, `topdown` and `shmup` templates from Expo SDK 57 to Expo SDK 58: React Native
0.88.1, React 19.3.0, `@shopify/react-native-skia` 2.14.0, Reanimated 4.7.1 with worklets 0.13.0,
`react-native-safe-area-context` ~5.11.1 and `react-native-web` ~0.21.4, as listed in
`expo@58`'s `bundledNativeModules.json`. Every `@flare-engine/*` peer floor is satisfied by the
new set; `canvaskit-wasm` stays at 0.41.0, the version RN-Skia 2.14.0 pins.
