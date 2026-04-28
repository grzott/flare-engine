import { ZONE_PALETTES } from '../palette';

const ui = {
  primary: '#F3C262',
  hazard: '#C0392B',
  secondary: '#E67E22',
  tertiary: '#5BCFFF',
  neutralLight: '#f3d6a4',
  neutralMid: '#d7cbb8',
  border: '#d6a54e',
  lockedBadge: '#a05c2a',
  bodyBg: 'rgba(10, 6, 16, 0.92)',
  overlay: 'rgba(0, 0, 0, 0.55)',
  tint60: 'rgba(255, 255, 255, 0.6)',
  onPrimary: '#1a0e0a',
  tint55: 'rgba(255,255,255,0.55)',
} as const;

export const colors = { zone: ZONE_PALETTES, ui } as const;
