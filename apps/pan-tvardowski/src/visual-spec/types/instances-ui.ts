import type { AmbienceKind } from '../zones-palette';
import type { Anchor, Hex, Inset, Size } from './foundations';

export type HudSlotId =
  | 'score'
  | 'combo'
  | 'zone-banner'
  | 'bombs'
  | 'hp-bar'
  | 'weapon-meter'
  | 'boss-bar'
  | 'miniboss-bar';

/** Token id from `ThemeSpec.typography`. */
export type TypeTokenId =
  | 'displayXl'
  | 'displayL'
  | 'displayM'
  | 'lede'
  | 'bodyL'
  | 'bodyM'
  | 'bodyS'
  | 'label'
  | 'monoHud'
  | 'monoDebug'
  | 'smallcap';

export interface HudSlot {
  readonly id: HudSlotId;
  readonly anchor: Anchor;
  readonly inset?: Inset;
  readonly size?: Size;
  readonly type?: TypeTokenId;
  readonly fg?: Hex;
  readonly bg?: Hex;
  readonly notes?: string;
}

export interface HudSpec {
  readonly slots: readonly HudSlot[];
}

export type OverlayId =
  | 'inventory'
  | 'codex-shards'
  | 'achievements'
  | 'shop'
  | 'pause'
  | 'dialogue'
  | 'paywall'
  | 'privacy'
  | 'boot'
  | 'menu';

export type OverlayPanelSize = 'sm' | 'md' | 'lg';

export type OverlaySectionType =
  | 'text'
  | 'list'
  | 'buttons'
  | 'logo'
  | 'progress'
  | 'image'
  | 'tabs'
  | 'grid';

interface BaseSectionDef {
  readonly id: string;
  readonly title?: string;
  /** Top-to-bottom order within the panel. */
  readonly order: number;
  readonly type: OverlaySectionType;
  readonly notes?: string;
}

export interface OverlaySection extends BaseSectionDef {
  /** If `true`, this section receives focus first when overlay opens. */
  readonly focusFirst?: boolean;
}

export interface OverlaySpec {
  readonly id: OverlayId;
  readonly panel: OverlayPanelSize;
  readonly sections: readonly OverlaySection[];
  readonly closeButton?: 'top-right' | 'bot-center' | 'none';
  /** Background dimming alpha 0..1. */
  readonly backdropAlpha?: number;
}

export type ScreenId = 'boot' | 'menu' | 'save-select' | 'settings' | 'credits';

export interface ScreenSection extends BaseSectionDef {}

export interface ScreenSpec {
  readonly id: ScreenId;
  /** Background tokens — driven by ThemeSpec colors at use site. */
  readonly background: {
    readonly sky: Hex;
    readonly ground?: Hex;
    readonly ambience?: { readonly kind: AmbienceKind; readonly count: number };
  };
  readonly sections: readonly ScreenSection[];
  /** What kind of navigation this screen offers (drives back-button + flow). */
  readonly navigation: 'next' | 'choices' | 'back' | 'none';
}
