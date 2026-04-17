/**
 * String table → `{ key: message }` per locale.
 *
 * Messages support `{var}` interpolation and ICU-style plural selectors:
 *   "You have {count, plural, =0 {no items} one {# item} other {# items}}."
 *
 * Keys may be dotted for namespacing; there's no nesting — the table is flat.
 */

export type LocaleCode = string; // BCP-47 tag, e.g., "en", "en-US", "pl"
export type MessageValue = string | number;
export type MessageValues = Record<string, MessageValue>;
export type StringTable = Record<string, string>;
