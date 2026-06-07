/**
 * Primitive leaf types — no visual-spec deps.
 */

export type EntityId =
  | 'skrzat'
  | 'latawiec'
  | 'czart'
  | 'bies'
  | 'licho'
  | 'strzyga'
  | 'topielec'
  | 'mamuna'
  | 'nocnica'
  | 'poludnica'
  | 'wapierz'
  | 'hound'
  | 'dziwozona'
  | 'moon-wraith'
  | 'rokita'
  | 'leszy'
  | 'nocny-lowca'
  | 'madej'
  | 'smok-krzemionkowski'
  | 'borowy-krol'
  | 'wodnik-wislanny'
  | 'boruta'
  | 'baba-jaga'
  | 'bazyliszek-warszawski'
  | 'mefistofeles'
  | 'lucyper-ksiezycowy'
  | 'kogut-zloty'
  | 'alembik'
  | 'zwierciadlo'
  | 'iskry'
  | 'piorun'
  | 'sol-swiecona'
  | 'znak-pentagramu'
  | 'czarna-ksiega'
  | 'siedmiomilowe-buty'
  | 'amulet-wegrowski'
  | 'koguci-pioro'
  | 'srebrna-tarcza'
  | 'kamien-filozoficzny';

/**
 * CSS-style hex color: `#rrggbb` or `#rrggbbaa`. Validated at runtime by the
 * invariant test against `/^#[0-9A-F]{6}([0-9A-F]{2})?$/i`.
 */
export type Hex = `#${string}`;

/** Position in design coordinates (1080×1920 mobile-portrait reference frame). */
export interface Pos {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'mid-left'
  | 'mid-center'
  | 'mid-right'
  | 'bot-left'
  | 'bot-center'
  | 'bot-right';

/** Pixel offset (number) or viewport-percentage offset (`'38%'` etc.). */
export type InsetValue = number | `${number}%`;

export interface Inset {
  readonly dx?: InsetValue;
  readonly dy?: InsetValue;
}

export type PostFxKind = 'bloom' | 'vignette' | 'chrom' | 'flash' | 'crt' | 'grayscale';

export type ExplosionTier = 'chip' | 'pop' | 'burst' | 'detonation' | 'cataclysm';
