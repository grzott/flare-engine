# @flare-engine/localization

String tables + locale negotiation + ICU-style plural / interpolation + hot-reload. `LocalizationManager.t(key, values?)` renders messages with active → fallback → raw-key fallthrough. `formatMessage` is stateless; supports `{var}` interpolation and `{count, plural, =0 {…} one {# x} other {# xs}}`. CLDR-inspired `pluralCategory` covers `en`, `pl`, `ru`, `fr`, `ar`, `ja/ko/zh`, etc.

## Install

```sh
bun add @flare-engine/localization
```

## Usage

```ts
import { LocalizationManager } from '@flare-engine/localization';

const lm = new LocalizationManager({
  fallback: 'en',
  tables: { en: enJson, pl: plJson },
});

lm.setLocale('pl');
lm.t('shop.bought', { count: 3 }); // -> "Kupiono 3 przedmioty"
lm.onChange.add((locale) => console.log('locale ->', locale));
```

See [API spec](../../docs/design/api-specs.md#flare-enginelocalization--7kb-raw) and [skill reference](../../.github/skills/flare-localization/SKILL.md).

## License

MIT
