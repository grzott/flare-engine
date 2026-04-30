import type { LocalizationKey } from '../localization/keys';

export interface CreditsSection {
  readonly titleKey: LocalizationKey;
  readonly lineKeys: readonly LocalizationKey[];
}

export const CREDITS_SECTIONS: readonly CreditsSection[] = [
  {
    titleKey: 'credits.legend.title',
    lineKeys: [
      'credits.legend.line1',
      'credits.legend.line2',
      'credits.legend.line3',
      'credits.legend.line4',
      'credits.legend.line5',
    ],
  },
  {
    titleKey: 'credits.bestiary.title',
    lineKeys: [
      'credits.bestiary.line1',
      'credits.bestiary.line2',
      'credits.bestiary.line3',
      'credits.bestiary.line4',
      'credits.bestiary.line5',
      'credits.bestiary.line6',
    ],
  },
  {
    titleKey: 'credits.artifacts.title',
    lineKeys: [
      'credits.artifacts.line1',
      'credits.artifacts.line2',
      'credits.artifacts.line3',
      'credits.artifacts.line4',
    ],
  },
  {
    titleKey: 'credits.engine.title',
    lineKeys: ['credits.engine.line1', 'credits.engine.line2', 'credits.engine.line3'],
  },
  {
    titleKey: 'credits.license.title',
    lineKeys: ['credits.license.line1', 'credits.license.line2'],
  },
  {
    titleKey: 'credits.thanks.title',
    lineKeys: ['credits.thanks.line1'],
  },
];
