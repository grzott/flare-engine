import { Signal } from '@flare-engine/events';
import { formatMessage } from './format.js';
import { resolveLocale } from './resolve.js';
import type { LocaleCode, MessageValues, StringTable } from './types.js';

export interface LocalizationManagerOptions {
  tables: Record<LocaleCode, StringTable>;
  initialLocale: LocaleCode;
  fallbackLocale: LocaleCode;
}

/**
 * Owns the active locale + string tables. `t(key, values?)` renders a message
 * using the active locale, falling back to the fallback locale, then the raw
 * key. `onChange` fires whenever the active locale is swapped. `setTable`
 * replaces a locale's table in place — enables hot-reload in dev.
 */
export class LocalizationManager {
  private _tables: Record<LocaleCode, StringTable>;
  private _locale: LocaleCode;
  private readonly _fallback: LocaleCode;
  readonly onChange = new Signal<LocaleCode>();

  constructor(options: LocalizationManagerOptions) {
    this._tables = { ...options.tables };
    this._fallback = options.fallbackLocale;
    this._locale = options.initialLocale;
  }

  get locale(): LocaleCode {
    return this._locale;
  }

  get fallback(): LocaleCode {
    return this._fallback;
  }

  availableLocales(): LocaleCode[] {
    return Object.keys(this._tables);
  }

  setLocale(locale: LocaleCode): void {
    if (this._locale === locale) return;
    this._locale = locale;
    this.onChange.emit(locale);
  }

  /** Pick the best-matching locale from the given requests and make it active. */
  negotiateLocale(requested: readonly LocaleCode[]): LocaleCode {
    const chosen = resolveLocale(requested, this.availableLocales(), this._fallback);
    this.setLocale(chosen);
    return chosen;
  }

  /** Replace (or install) a locale's table. Emits `onChange` if it targets the active locale. */
  setTable(locale: LocaleCode, table: StringTable): void {
    this._tables[locale] = table;
    if (locale === this._locale) this.onChange.emit(locale);
  }

  has(key: string): boolean {
    const active = this._tables[this._locale];
    const fallback = this._tables[this._fallback];
    return (
      (active !== undefined && Object.hasOwn(active, key)) ||
      (fallback !== undefined && Object.hasOwn(fallback, key))
    );
  }

  t(key: string, values?: MessageValues): string {
    const active = this._tables[this._locale];
    const fallback = this._tables[this._fallback];
    const template =
      (active !== undefined && Object.hasOwn(active, key) ? active[key] : undefined) ??
      (fallback !== undefined && Object.hasOwn(fallback, key) ? fallback[key] : undefined) ??
      key;
    return formatMessage(template, values, this._locale);
  }
}
