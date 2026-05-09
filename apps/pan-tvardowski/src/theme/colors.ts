import { THEME_SPEC } from '../visual-spec/theme';
import { ZONE_PALETTES } from '../visual-spec/zones-palette';

const spec = THEME_SPEC.colors;

const ui = {
  // ColorTokenId keys sourced from THEME_SPEC
  gold: spec.gold,
  goldDeep: spec.goldDeep,
  crimson: spec.crimson,
  crimsonDeep: spec.crimsonDeep,
  hazard: spec.hazard,
  hazardOrange: spec.hazardOrange,
  inkBlack: spec.inkBlack,
  void: spec.void,
  parchment: spec.parchment,
  parchment2: spec.parchment2,
  parchmentDim: spec.parchmentDim,
  bogGreen: spec.bogGreen,
  moss: spec.moss,
  verdigris: spec.verdigris,
  bone: spec.bone,
  rust: spec.rust,
  terracotta: spec.terracotta,
  safe: spec.safe,
  // Derived aliases — not in ColorTokenId; deleted in VS-S8
  primary: spec.gold,
  secondary: spec.crimson,
  neutralLight: '#E8DCC4' as const,
  neutralMid: '#D9C9A8' as const,
  border: spec.gold,
  lockedBadge: spec.rust,
  bodyBg: 'rgba(14, 26, 18, 0.92)' as const,
  overlay: 'rgba(0, 0, 0, 0.55)' as const,
  tint60: 'rgba(255, 255, 255, 0.6)' as const,
  tint55: 'rgba(255,255,255,0.55)' as const,
  onPrimary: spec.inkBlack,
  backdropModal: 'rgba(14, 26, 18, 0.88)' as const,
  divider: 'rgba(255,255,255,0.06)' as const,
  dividerStrong: 'rgba(255,255,255,0.12)' as const,
  cb: {
    player: spec['cb-player'],
    hazard: spec['cb-hazard'],
    safe: spec['cb-safe'],
  },
} as const;

export const colors = { zone: ZONE_PALETTES, ui } as const;
