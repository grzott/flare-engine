---
name: flare-localization
description: Deep knowledge of the @flare-engine/localization package — LocalizationManager, string tables, ICU-style plurals, locale resolution, message formatting with interpolation. Use when adding i18n / translations / pluralization / locale switching to a Flare game.
---

# `@flare-engine/localization`

Layer 2.5. Pure TS — no native deps. ICU-style plurals (zero/one/two/few/many/other) + `{name}` interpolation.

## Exports

```ts
import {
  type LocaleCode,
  type StringTable,
  type MessageValue,
  type MessageValues,
  pluralCategory,
  type PluralCategory,
  formatMessage,
  resolveLocale,
  LocalizationManager,
  type LocalizationManagerOptions,
} from "@flare-engine/localization";
```

## Usage sketch

```ts
const loc = new LocalizationManager({
  defaultLocale: "en",
  fallbackLocale: "en",
  tables: {
    en: {
      greeting: "Hello, {name}!",
      enemies: "{count, plural, one {# enemy} other {# enemies}}",
    },
    es: {
      greeting: "¡Hola, {name}!",
      enemies: "{count, plural, one {# enemigo} other {# enemigos}}",
    },
  },
});
loc.setLocale(resolveLocale(["es-AR", "en"], loc.availableLocales));
loc.format("greeting", { name: "Ana" });
loc.format("enemies", { count: 3 });
```

## Rules

- `pluralCategory(locale, n)` returns the CLDR category for the given locale — use it if you're formatting outside `LocalizationManager`.
- Missing keys fall back to the `fallbackLocale` table, then to the key itself — never throw at render time.
- Hot-reload: tables can be swapped at runtime; consumers subscribed via `onLocaleChange` re-render.

Spec: [docs/design/api-specs.md § @flare-engine/localization](../../../docs/design/api-specs.md).
