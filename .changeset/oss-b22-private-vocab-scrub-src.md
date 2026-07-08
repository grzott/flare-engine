---
"@flare-engine/a11y": patch
"@flare-engine/assets": patch
"@flare-engine/engine": patch
"@flare-engine/iap": patch
"@flare-engine/shapes": patch
"@flare-engine/share": patch
"@flare-engine/ui": patch
---

engine-wide: scrub private-game vocabulary from shipping JSDoc. Doc comments in a11y (`bridge.ts`), assets (`procedural-atlas.ts`), engine (`tier2-wiring.ts`), iap (`catalog.ts`/`entitlements.ts`), shapes (`types.ts`), share (`screenshot-scene.ts`), and ui (`dialogue-panel.tsx`/`main-menu-kit.tsx`/`shop-panel.tsx`) are rewritten project-neutral, so no game name, private repo URL, or internal phase/session numbers reach the published `.d.ts`. Comment-only — no API or behavior change.
