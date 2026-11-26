---
'@flare-engine/localization': patch
---

`pluralCategory` now classifies negative and non-integer counts the way `Intl.PluralRules` does
(#508). `formatMessage` and `LocalizationManager.t` pick their `plural` branch through it, so they
change with it. No exported symbol or signature changes.

- **Negative counts.** The sign is ignored, so `-n` gets the category of `n`. Before, the locale
  rule ran on the raw number: `pl -1` and `pl -2` gave `many` (now `one` and `few`), and `-1` gave
  `other` in `en`, `ru` and `ar` (now `one`).
- **Non-integer counts.** In `pl`, `ru`, `uk` and `ar` every non-integer is `other`. Before, `pl 0.5`
  and `pl 1.5` gave `many`, and `ru 2.5` gave `few`.
- **`fr`.** A count below 2 is `one`, so `0.5` and `1.5` are `one`; they were `other`.
- **`pt`.** `pt` now uses the same rule as `fr` instead of the English one: `0`, `0.5` and `1.5` are
  `one`; they were `other`. `pt-PT` (also `pt_PT`, any case) keeps the English rule, as CLDR has it,
  so `pt-PT 0` is still `other`. Every other `pt-*` tag, `pt-BR` included, follows `pt`.
- **`NaN` and the infinities** are `other` in every locale when `pluralCategory` is called directly;
  `pl` gave `many` for them. `formatMessage` already used `other` for a non-finite count.

A locale tag is now looked up whole (lower-cased, `_` read as `-`) before its language subtag.
`pt-pt` is the only regional entry, so no other tag resolves differently.

A test compares every locale in the rule table, and `pt-PT`, with `Intl.PluralRules` over the
integers -100 to 100 and ±0.5, ±1.5, ±2.5. Outside that range the rules are not checked against
`Intl`. The rules stay hand-written; `Intl.PluralRules` is not used at runtime.
