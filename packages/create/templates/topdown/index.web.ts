import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { registerRootComponent } from "expo";

// Metro picks this file over index.ts on web because package.json's `main` is
// extensionless. Keeping the web entry separate is not cosmetic: RN-Skia's web
// module builds its Skia object from global.CanvasKit at module-eval time, so
// anything that imports Skia must be loaded only after LoadSkiaWeb resolves.
// A static `import { App }` here would leave Skia permanently hollow and
// GameView would throw on Skia.Paint.
//
// `bun run web` copies canvaskit.wasm into public/, which Expo serves at the
// web root — that is what locateFile points at.
void (async () => {
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
  const { App } = await import("./src/App");
  registerRootComponent(App);
})();
