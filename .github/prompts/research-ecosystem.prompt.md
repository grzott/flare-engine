---
description: "Research the latest React Native, Skia, and 2D game development ecosystem — new libraries, releases, community trends"
mode: agent
agent: researcher
---

# Research: RN Game Dev Ecosystem Survey

Survey the **current state of the React Native game development ecosystem** and identify new developments, libraries, techniques, and community trends relevant to the Flare engine.

## Research Areas

### 1. React Native & Skia Updates
- Latest `@shopify/react-native-skia` releases — new APIs, performance improvements, breaking changes
- `react-native-wgpu` progress — is WebGPU becoming viable for RN games?
- React Native New Architecture adoption — how does it affect game engine performance?
- Expo SDK updates — new modules relevant to gaming (haptics, sensors, audio)

### 2. JavaScript/TypeScript Game Libraries
- New or updated 2D game libraries on npm (last 6 months)
- ECS frameworks: bitECS, miniplex, becsy — any new contenders or major updates?
- Physics: planck.js, matter.js, rapier-js — latest versions, WASM support in RN
- Particle systems, tweening libs, spatial indexing implementations

### 3. Community Activity
- GitHub repos: new RN game projects, Skia-based games, game jams using RN
- Reddit: r/reactnative, r/gamedev — threads about mobile game dev with RN
- Discord: Shopify Skia server, React Native community — game dev channels activity
- Blog posts & tutorials: anyone building games with RN Skia? What patterns emerged?

### 4. Competitor Engine Updates
- **Phaser 4** — what shipped? What can Flare learn from their API design?
- **Excalibur.js** — latest release, any features Flare should adopt?
- **KAPLAY** — successor to Kaboom.js, what's their approach to simplicity?
- **PixiJS v8** — rendering innovations applicable to Skia?
- **Defold / Godot** — any 2D features trending that Flare should consider?

### 5. Mobile Game Development Trends
- What genres are trending in mobile 2D games?
- Monetization patterns affecting engine design (ads SDK integration, IAP)
- Performance benchmarks: what FPS targets are realistic for RN Skia games?
- Device fragmentation: minimum specs to target

### 6. Standards & Specifications
- Tiled Map Editor — latest TMX format changes
- LDtk — latest version, JSON format updates
- Aseprite — sprite export format changes
- TexturePacker — atlas format compatibility

## Cross-Reference With Flare

For each finding, assess:
1. **Does Flare already handle this?** (check against current package status)
2. **Should Flare adopt this?** (fits architecture? worth the complexity?)
3. **Priority**: Critical / Nice-to-have / Watch-and-wait
4. **Effort estimate**: Small (1 module) / Medium (1 package) / Large (multiple packages)

## Output

Produce a structured report following the researcher agent's report format. End with a prioritized "Action Items" list that the @architect or @builder can act on.
