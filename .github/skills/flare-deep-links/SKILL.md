---
name: flare-deep-links
description: Deep knowledge of the @flare-engine/deep-links package — DeepLinkRouter, parseUrl, route definitions, URL → scene navigation, web history + native Linking integration. Use when handling deep-link URLs, external entry points, or sharable in-game routes in Flare.
---

# `@flare-engine/deep-links`

Layer 2.5. URL → scene routing with param extraction. Platform adapters for web history API and RN `Linking`.

## Exports

```ts
import {
  type DeepLinkMatch,
  type Params,
  type ParamValue,
  parseUrl,
  type ParsedUrl,
  DeepLinkRouter,
  type RouteDefinition,
  // platform adapters
  createWebHistoryAdapter,
  createLinkingAdapter,
} from "@flare-engine/deep-links";
```

## Usage sketch

```ts
const router = new DeepLinkRouter([
  {
    pattern: "/play/:level",
    handler: ({ level }) => scenes.go("play", { level: Number(level) }),
  },
  { pattern: "/shop", handler: () => scenes.go("shop") },
]);
router.attach(createLinkingAdapter()); // or createWebHistoryAdapter()
router.navigate("/play/3");
```

## Rules

- Patterns are path-only — query strings are auto-parsed into `params` (string values; coerce yourself).
- Unmatched URLs emit `onUnmatched` so you can log or redirect to a 404 scene.
- On web, the adapter writes to `history.pushState`; in RN the `Linking` adapter handles launch URLs + runtime events.

Spec: [docs/design/api-specs.md § @flare-engine/deep-links](../../../docs/design/api-specs.md).
