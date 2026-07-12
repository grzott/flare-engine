# @flare-engine/localization

String tables + locale negotiation + ICU-style plural / interpolation + hot-reload + timestamp formatting. `LocalizationManager.t(key, values?)` renders messages with active → fallback → raw-key fallthrough. `formatMessage` is stateless; supports `{var}` interpolation and `{count, plural, =0 {…} one {# x} other {# xs}}`. CLDR-inspired `pluralCategory` covers `en`, `pl`, `ru`, `fr`, `ar`, `ja/ko/zh`, etc. `formatTimestamp` wraps `Intl.DateTimeFormat` safely for all target runtimes.

## Install

```sh
bun add @flare-engine/localization
```

## Usage

```ts
import { LocalizationManager } from '@flare-engine/localization';
import type { StringTable } from '@flare-engine/localization';

declare const enJson: StringTable;
declare const plJson: StringTable;

const lm = new LocalizationManager({
  initialLocale: 'en',
  fallbackLocale: 'en',
  tables: { en: enJson, pl: plJson },
});

lm.setLocale('pl');
lm.t('shop.bought', { count: 3 }); // -> "Kupiono 3 przedmioty"
lm.onChange.add((locale) => console.log('locale ->', locale));
```

Locale-aware timestamp formatting for slot previews and save UI:

```ts
import { formatTimestamp } from '@flare-engine/localization';

// Date + time (default when no options passed)
formatTimestamp(Date.now(), 'en'); // e.g. "1/15/24, 2:30 PM"
formatTimestamp(Date.now(), 'pl'); // e.g. "15.01.2024, 14:30"

// Date-only: pass options object but omit timeStyle
formatTimestamp(Date.now(), 'en', { dateStyle: 'long' }); // e.g. "January 15, 2024"

// Returns fallback for missing/zero timestamps
formatTimestamp(0, 'en'); // ""
formatTimestamp(0, 'en', { fallback: 'N/A' }); // "N/A"
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginelocalization--7kb-raw).

## License

MIT
