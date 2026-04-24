---
name: flare-ui
description: Deep knowledge of the @flare-engine/ui package — Panel, Button, Label, List, Modal, HUDBar, ProgressBar, ThemeProvider, FocusProvider, focus navigation, flex-like layout resolver. Use when building HUDs, menus, pause screens, or modal dialogs in a Flare game.
---

# `@flare-engine/ui`

Layer 3.5. React-Native-only peer deps — no Skia. Menus render through the platform view tree so Skia canvas stays focused on the game.

## Exports

```ts
import {
  darkTheme,
  lightTheme,
  type Theme,
  ThemeProvider,
  useTheme,
  createFocusManager,
  type FocusManager,
  FocusProvider,
  FocusContext,
  useFocusManager,
  resolveLayout,
  type LayoutRect,
  Panel,
  Label,
  Button,
  ProgressBar,
  HUDBar,
  List,
  Modal,
} from "@flare-engine/ui";
```

## Usage sketch

```tsx
<ThemeProvider theme={darkTheme}>
  <FocusProvider>
    <Panel variant="elevated">
      <Label variant="lg">Pause</Label>
      <List direction="column" gap="md">
        <Button variant="primary" onPress={resume}>
          Resume
        </Button>
        <Button variant="ghost" onPress={quit}>
          Quit
        </Button>
      </List>
      <HUDBar kind="hp" value={playerHP} max={100} />
    </Panel>
  </FocusProvider>
</ThemeProvider>
```

## Phase 11.14 kits: `MainMenuKit`, `DialoguePanel`, `ShopPanel`

Three higher-level compositions extracted from Pan Tvardowski. All three are localization-free — caller supplies pre-translated strings.

### `MainMenuKit`

Title screen primitive: headline + optional subtitle + vertical focusable button list + optional footer slot. Save-slot / settings / credits panels are built _on top_ of the kit by the consumer; the kit itself is a pure title-menu.

```tsx
<MainMenuKit
  title={t("menu.title")}
  subtitle={t("menu.subtitle")}
  items={[
    { id: "play", label: t("menu.play"), onPress: () => scenes.go("save-select") },
    { id: "settings", label: t("menu.settings"), onPress: () => scenes.go("settings"), variant: "secondary" },
    { id: "credits", label: t("menu.credits"), onPress: () => scenes.go("credits"), variant: "ghost" },
  ]}
  footer={<Label variant="sm" tone="muted">v0.1.0 · EN</Label>}
/>
```

Each item's `id` is used as both the focus id and React key. `variant` defaults to `"primary"`.

### `DialoguePanel`

Dialogue panel with a portrait slot. Pairs with `@flare-engine/dialogue` — subscribe to `runner.onLine`, look up the portrait by `event.speakerPortraitKey`, and pass the resolved node as `portrait`.

```tsx
<DialoguePanel
  speaker={t(`dialogue.speaker.${event.speaker}`)}
  text={event.text}
  portrait={portraits[event.speakerPortraitKey ?? "default"]}
  choices={event.choices?.map((c, i) => ({ label: c.label, onPress: () => runner.choose(i) }))}
  onAdvance={() => runner.advance()} // used only when choices is empty/omitted
/>
```

When `choices` is empty/omitted, the whole panel is `Pressable` and tap-advances. Portrait resolution is caller-owned so the UI kit stays asset-agnostic.

### `ShopPanel`

List-style shop. Caller builds `items` by joining a `ProductCatalog` (`@flare-engine/iap`) with `Product[]` from `IAPProvider.listProducts`. `isEntitled` typically points at `EntitlementStore.isEntitled`.

```tsx
<ShopPanel
  items={[
    {
      productId: "pan_tvardowski.full_game",
      title: t("shop.full_game.title"),
      description: t("shop.full_game.desc"),
      priceDisplay: product.priceDisplay,
      ownedKeys: ["zones_4_8"],
    },
  ]}
  isEntitled={(k) => entitlements.isEntitled(k)}
  onPurchase={(productId) => provider.purchase(productId).then((r) => r.transaction && entitlements.grantProduct(r.transaction.productId))}
  ownedLabel={t("shop.owned")}
/>
```

When any `ownedKeys` entry is entitled, the purchase button is replaced with the `ownedLabel` ghost button.

## Rules

- `FocusManager.register(node)` returns a `dispose` — wire it to `useEffect` cleanup.
- Button/List auto-register with `FocusManager` when one is in scope — use `tabIndex` to control traversal order.
- `resolveLayout` is pure math — no React — use it for custom components.
- The 11.14 kits are localization-free by design. Pass already-translated strings; never put `t()` calls inside the kit.

Spec: [docs/design/api-specs.md § @flare-engine/ui](../../../docs/design/api-specs.md).
