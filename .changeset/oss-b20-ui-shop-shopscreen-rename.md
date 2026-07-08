---
"@flare-engine/ui-shop": minor
---

ui-shop: rename `ShopPanel`/`ShopPanelProps` → `ShopScreen`/`ShopScreenProps` to eliminate the name collision with `@flare-engine/ui`'s own `ShopPanel`. No deprecated alias — an alias would re-introduce the collision. Also fixes `PaywallModal` so backdrop tap is a no-op while a purchase is in flight (`onBackdropPress` is set to `undefined` when `purchasing` is true).
