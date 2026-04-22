import { LocalizationManager, type StringTable } from '@flare-engine/localization';
import en from '../../locales/en.json' with { type: 'json' };
import pl from '../../locales/pl.json' with { type: 'json' };

export const SUPPORTED_LOCALES = ['en', 'pl'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface CreateLocalizationOptions {
  readonly initialLocale?: SupportedLocale;
}

export function createLocalization(options: CreateLocalizationOptions = {}): LocalizationManager {
  return new LocalizationManager({
    tables: {
      en: en as StringTable,
      pl: pl as StringTable,
    },
    initialLocale: options.initialLocale ?? 'en',
    fallbackLocale: 'en',
  });
}
