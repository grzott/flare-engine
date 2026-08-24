import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import { App } from "./src/App";

// On web, CanvasKit has to finish loading before any Skia object is built, so
// registration waits on LoadSkiaWeb. `bun run web` copies the wasm into public/
// first; Expo serves that directory at the web root, which is where locateFile
// points. Native registers synchronously and never evaluates the web module.
if (Platform.OS === "web") {
  void (async () => {
    const { LoadSkiaWeb } = await import(
      "@shopify/react-native-skia/lib/module/web"
    );
    await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
    registerRootComponent(App);
  })();
} else {
  registerRootComponent(App);
}
