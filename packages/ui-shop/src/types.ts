/** Per-product copy the host provides; never touches i18n directly. */
export interface ShopItemCopy {
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  ownedLabelKey: string;
}

export interface ShopPanelStrings {
  headingKey: string;
  emptyKey: string;
  loadingKey: string;
  errorKey: string;
  ownedSectionKey: string;
  availableSectionKey: string;
}

export interface PaywallStrings {
  headingKey: string;
  bodyKey: string;
  ctaKey: string;
  dismissKey: string;
  loadingKey: string;
  errorKey: string;
}

export interface RestoreStrings {
  ctaKey: string;
  loadingKey: string;
  successKey: string;
  emptyKey: string;
  errorKey: string;
}

/**
 * Host-supplied localizer. Keeps the engine free of any i18n framework
 * dependency — the caller owns the translation lookup.
 */
export type LocalizeFn = (key: string) => string;
