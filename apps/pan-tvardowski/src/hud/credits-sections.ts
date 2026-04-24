/**
 * Static credits content for the credits-scroll overlay. Sourced from
 * `apps/pan-tvardowski/CREDITS.md` (see that file for full citations +
 * links). We embed a scroll-friendly subset here so the overlay renders
 * without shipping a Markdown parser.
 */

export interface CreditsSection {
  readonly title: string;
  readonly lines: readonly string[];
}

export const CREDITS_SECTIONS: readonly CreditsSection[] = [
  {
    title: 'Legend & literature',
    lines: [
      'Pan Twardowski — Polish folk legend, 16th c.',
      'Adam Mickiewicz, "Pani Twardowska" (1822)',
      'Józef Ignacy Kraszewski, "Mistrz Twardowski" (1840)',
      'King Sigismund II Augustus, Queen Barbara Radziwiłłówna',
      'Wawel Castle — historical frame',
    ],
  },
  {
    title: 'Folk bestiary (Slavic mythology)',
    lines: [
      'Boruta · Rokita · Licho · Strzyga',
      'Topielec · Mamuna · Nocnica · Południca',
      'Wąpierz · Dziwożona · Leszy · Baba Jaga',
      'Bazyliszek Warszawski · Smok Wawelski',
      'Wodnik · Skrzat · Latawiec · Czart',
      'Bies · Mefistofeles · Madej',
    ],
  },
  {
    title: 'Artifacts & places',
    lines: [
      'Zwierciadło Twardowskiego — Węgrów',
      'Karczma "Rzym" — canonical inn',
      'Kogut — rooster mount',
      'Pentagram & alchemical sigils — public-domain',
    ],
  },
  {
    title: 'Engine',
    lines: ['Built on Flare engine', 'github.com/flare-engine', 'MIT licensed'],
  },
  {
    title: 'License',
    lines: ['Pan Tvardowski ships under', 'PolyForm Noncommercial 1.0.0'],
  },
  {
    title: 'Thank you for playing',
    lines: ['— Studio & engine team'],
  },
];
