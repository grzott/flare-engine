// Ambient shims + notes for tsconfig.templates.json (kept here, not in the
// tsconfig, because biome/lint-staged parses .json as strict JSON — no comments).
//
// tsconfig.templates.json is a STRUCTURAL smoke-check for all three templates:
// it typechecks their src + tests + index.ts against the monorepo's hoisted
// deps (whatever RN/skia/flare version is in the workspace node_modules), NOT
// the templates' pinned Expo-57 versions. It catches missing exports, wrong
// import paths, and broken cross-file references. Pinned-version validation
// (verdaccio scaffold + install + tsc) is covered by OSS-F2 and freeze §11.
//
// The shim below lets index.ts typecheck without the real `expo` package
// installed in the monorepo. Templates only use expo's registerRootComponent;
// the real types resolve in the scaffolded user's project. Keep this minimal.
declare module 'expo' {
  export function registerRootComponent(component: unknown): void;
}
